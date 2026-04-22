'use server';

import { revalidatePath } from 'next/cache';
import { getMe, requireAdmin } from '@/lib/session-server';
import { saveReceitaDoProduto } from './insumos';
import { ProductSchema, CategorySchema } from '@/lib/validations';
import { logAction } from '@/lib/audit';
import { v2 as cloudinary } from 'cloudinary';
import { noco } from '@/lib/nocodb';
import { PRODUTOS_TABLE_ID, CATEGORIAS_TABLE_ID } from '@/lib/constants';

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface Category {
  id: number;
  nome: string;
  empresa_id: number | string;
  ordem?: number;
}

export async function getProducts() {
  try {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');

    const data = await noco.list(PRODUTOS_TABLE_ID, {
      where: `(empresa_id,eq,${user.empresaId})`,
      sort: '-id',
      limit: 1000,
    });
    const products = data.list || [];

    return products.map((p: any) => JSON.parse(JSON.stringify({
      id: p.id || p.Id,
      nome: p.nome || '',
      preco: Number(p.preco || 0),
      descricao: p.descricao || '',
      imagem: p.imagem || '',
      categoria_id: p.categoria_id || p.categorias || null,
      disponivel: p.disponivel !== false && p.disponivel !== 0,
      empresa_id: p.empresa_id,
      tamanhos: p.tamanhos || null,
      tamanhos_json: p.tamanhos || null,
      criado_em: p.criado_em || null,
    })));
  } catch (error) {
    console.error('API Error:', error);
    throw new Error('Failed to fetch products');
  }
}

export async function uploadImageAction(formData: FormData) {
  const file = formData.get('image') as File;
  if (!file || file.size === 0) return null;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = `data:${file.type};base64,${buffer.toString('base64')}`;

    const result = await cloudinary.uploader.upload(base64Image, {
      folder: 'zapflow_products',
    });

    return result.secure_url;
  } catch (error: any) {
    console.error('Cloudinary upload error:', error);
    throw new Error(error.message || 'Falha no upload da imagem para o Cloudinary');
  }
}

export async function getCategories(): Promise<Category[]> {
  try {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');

    const data = await noco.list(CATEGORIAS_TABLE_ID, {
      where: `(empresa_id,eq,${user.empresaId})`,
      limit: 1000,
    });
    const categories = data.list || [];

    return categories.map((c: any) => JSON.parse(JSON.stringify({
      id: c.id || c.Id,
      nome: c.nome || '',
      empresa_id: c.empresa_id,
      ordem: Number(c.ordem || 0),
    })));
  } catch (error) {
    console.error('API Error:', error);
    throw new Error('Failed to fetch categories');
  }
}

export async function upsertCategory(categoryData: any) {
  try {
    const user = await requireAdmin();

    const validated = CategorySchema.safeParse(categoryData);
    if (!validated.success) {
      const errorMsg = validated.error.issues.map((issue: any) => issue.message).join(', ');
      throw new Error(`Dados inválidos: ${errorMsg}`);
    }

    const category = validated.data;
    const payload: any = {
      ...category,
      empresa_id: user.empresaId,
      disponivel: true
    };

    delete payload.created_at;
    delete payload.updated_at;

    let result;

    if (payload.id) {
      const updatePayload: any = { id: payload.id };
      if (payload.nome) updatePayload.nome = payload.nome;
      if (payload.ordem !== undefined) updatePayload.ordem = payload.ordem;
      if (payload.disponivel !== undefined) updatePayload.disponivel = payload.disponivel;

      result = await noco.update(CATEGORIAS_TABLE_ID, updatePayload);
      await logAction('SAVE_CATEGORY', `Sucesso ao salvar categoria: ${category.nome}`);
    } else {
      result = await noco.create(CATEGORIAS_TABLE_ID, payload);
    }

    revalidatePath('/dashboard/categories');
    revalidatePath('/dashboard/menu');
    return { ...categoryData, ...result };
  } catch (error: any) {
    console.error('API Error:', error);
    throw new Error(error.message || 'Failed to save category');
  }
}

export async function deleteCategory(id: number | string) {
  try {
    const user = await requireAdmin();

    const category = await noco.findById(CATEGORIAS_TABLE_ID, id) as any;
    if (!category || Number(category.empresa_id) !== Number(user.empresaId)) {
      throw new Error('Acesso negado: Categoria não pertence a esta empresa');
    }

    await noco.delete(CATEGORIAS_TABLE_ID, id);
    revalidatePath('/dashboard/categories');
    revalidatePath('/dashboard/menu');
    return { success: true };
  } catch (error: any) {
    console.error('Delete Category Error:', error);
    throw new Error(error.message || 'Failed to delete category');
  }
}

export async function updateProductAvailability(id: number | string, disponivel: boolean) {
  try {
    const user = await requireAdmin();

    const product = await noco.findById(PRODUTOS_TABLE_ID, id) as any;
    if (!product || Number(product.empresa_id) !== Number(user.empresaId)) {
      throw new Error('Acesso negado: Produto não pertence a esta empresa');
    }

    await noco.update(PRODUTOS_TABLE_ID, { id, disponivel });
    revalidatePath('/dashboard/menu');
    return { success: true };
  } catch (error) {
    console.error('API Error:', error);
    throw new Error('Failed to update availability');
  }
}

export async function deleteProduct(id: number | string) {
  try {
    const user = await requireAdmin();

    const product = await noco.findById(PRODUTOS_TABLE_ID, id) as any;
    if (!product || Number(product.empresa_id) !== Number(user.empresaId)) {
      throw new Error('Acesso negado: Produto não pertence a esta empresa');
    }

    await noco.delete(PRODUTOS_TABLE_ID, id);
    revalidatePath('/dashboard/menu');
    await logAction('DELETE_PRODUCT', `Produto ID ${id} excluído permanentemente`);
    return { success: true };
  } catch (error: any) {
    console.error('Delete Product Error:', error);
    throw new Error(error.message || 'Failed to delete product');
  }
}

export async function upsertProduct(productData: any, selectedInsumos?: { insumo_id: number | string, quantidade_necessaria: number }[]) {
  try {
    const user = await requireAdmin();

    if (productData.preco === '' || productData.preco === undefined || productData.preco === null) {
      productData.preco = 0;
    }
    productData.preco = Number(productData.preco);
    if (isNaN(productData.preco)) {
      productData.preco = 0;
    }

    const validated = ProductSchema.safeParse(productData);
    if (!validated.success) {
      const errorMsg = validated.error.issues.map((issue: any) => issue.message).join(', ');
      throw new Error(`Dados inválidos: ${errorMsg}`);
    }

    const product = validated.data;
    const payload: any = {
      ...product,
      empresa_id: user.empresaId
    };

    // Garantir que o campo tamanhos está no payload se presente nos dados validados
    if (product.tamanhos !== undefined) {
      payload.tamanhos = product.tamanhos;
    }

    delete payload.created_at;
    delete payload.updated_at;

    let savedProduct;

    if (payload.id) {
      const updatePayload = { ...payload };
      delete updatePayload.empresa_id;

      const data = await noco.update(PRODUTOS_TABLE_ID, updatePayload);
      // Garantir que categoria_id e tamanhos sejam preservados no retorno para evitar bugs de UI
      savedProduct = { 
        ...productData, 
        ...data, 
        categoria_id: productData.categoria_id || data.categoria_id,
        tamanhos: productData.tamanhos || data.tamanhos || (data as any).tamanhos
      };
    } else {
      const data = await noco.create(PRODUTOS_TABLE_ID, payload);
      savedProduct = { 
        ...productData, 
        ...data,
        categoria_id: productData.categoria_id || data.categoria_id,
        tamanhos: productData.tamanhos || data.tamanhos || (data as any).tamanhos
      };
    }

    if (selectedInsumos !== undefined && savedProduct && savedProduct.id) {
      await saveReceitaDoProduto(savedProduct.id, selectedInsumos);
    }

    revalidatePath('/dashboard/menu');
    return savedProduct;
  } catch (error: any) {
    console.error('API Error:', error);
    throw new Error(error.message || 'Failed to save product');
  }
}
