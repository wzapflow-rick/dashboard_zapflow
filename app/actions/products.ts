'use server';

import { revalidatePath } from 'next/cache';
import { getMe, requireAdmin } from '@/lib/session-server';
import { saveReceitaDoProduto } from './insumos';
import { ProductSchema, CategorySchema } from '@/lib/validations';
import { logAction } from '@/lib/audit';
import { v2 as cloudinary } from 'cloudinary';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const TABLE_ID = 'mh81t2xp1uml6pc';
const CATEGORIES_TABLE_ID = 'mo5so5g7gvlbwyo';

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

async function nocoFetch(endpoint: string, options: RequestInit = {}, tableId: string = TABLE_ID) {
  const url = `${NOCODB_URL}/api/v2/tables/${tableId}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'xc-token': NOCODB_TOKEN,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    let errorMessage = text;
    try {
      const json = JSON.parse(text);
      errorMessage = json.message || json.error || text;
    } catch {}
    console.error(`NocoDB Error: ${res.status} ${errorMessage}`);
    throw new Error(`NocoDB API Error: ${res.status} - ${errorMessage}`);
  }

  return res;
}

export async function getProducts() {
  try {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');

    const res = await nocoFetch(`/records?limit=1000&where=(empresa_id,eq,${user.empresaId})&sort=-id`);
    const data = await res.json();
    const products = data.list || [];
    
    // Garantir que retornamos apenas objetos planos serializáveis
    return products.map((p: any) => JSON.parse(JSON.stringify({
      id: p.id || p.Id,
      nome: p.nome || '',
      preco: Number(p.preco || 0),
      descricao: p.descricao || '',
      imagem: p.imagem || '',
      categoria_id: p.categoria_id || p.categorias || null,
      disponivel: p.disponivel !== false && p.disponivel !== 0,
      empresa_id: p.empresa_id,
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

    const res = await nocoFetch(`/records?limit=1000&where=(empresa_id,eq,${user.empresaId})`, {}, CATEGORIES_TABLE_ID);
    const data = await res.json();
    const categories = data.list || [];
    
    // Garantir serialização
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

    // Validação Premium com Zod
    const validated = CategorySchema.safeParse(categoryData);
    if (!validated.success) {
      const errorMsg = validated.error.issues.map((issue: any) => issue.message).join(', ');
      throw new Error(`Dados inválidos: ${errorMsg}`);
    }

    const category = validated.data;
    const payload = {
      ...category,
      empresa_id: user.empresaId,
      disponivel: true
    };

    // Remove IDs de sistema se presentes no payload (exceto o ID principal)
    delete (payload as any).created_at;
    delete (payload as any).updated_at;

    if (payload.id) {
      const updatePayload: any = { 
        Id: payload.id, 
        id: payload.id 
      };
      
      if (payload.nome) updatePayload.nome = payload.nome;
      if (payload.ordem !== undefined) updatePayload.ordem = payload.ordem;
      if (payload.disponivel !== undefined) updatePayload.disponivel = payload.disponivel;

      const res = await nocoFetch('/records', {
        method: 'PATCH',
        body: JSON.stringify(updatePayload)
      }, CATEGORIES_TABLE_ID);
      revalidatePath('/dashboard/categories');
      revalidatePath('/dashboard/menu');
      const data = await res.json();
      await logAction('SAVE_CATEGORY', `Sucesso ao salvar categoria: ${category.nome}`);
      return { ...categoryData, ...data };
    } else {
      const res = await nocoFetch('/records', {
        method: 'POST',
        body: JSON.stringify(payload)
      }, CATEGORIES_TABLE_ID);
      const data = await res.json();
      revalidatePath('/dashboard/categories');
      revalidatePath('/dashboard/menu');
      return { ...categoryData, ...data };
    }
  } catch (error: any) {
    console.error('API Error:', error);
    throw new Error(error.message || 'Failed to save category');
  }
}

export async function deleteCategory(id: number | string) {
  try {
    const user = await requireAdmin();

    // Segurança Premium: Verificar se a categoria pertence à empresa
    const checkRes = await nocoFetch(`/records/${id}`, {}, CATEGORIES_TABLE_ID);
    const category = await checkRes.json();
    if (!category || Number(category.empresa_id) !== Number(user.empresaId)) {
      throw new Error('Acesso negado: Categoria não pertence a esta empresa');
    }

    await nocoFetch('/records', {
      method: 'DELETE',
      body: JSON.stringify([{ Id: id, id: id }])
    }, CATEGORIES_TABLE_ID);
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

    const checkRes = await nocoFetch(`/records/${id}`);
    const product = await checkRes.json();
    if (!product || Number(product.empresa_id) !== Number(user.empresaId)) {
      throw new Error('Acesso negado: Produto não pertence a esta empresa');
    }

    await nocoFetch('/records', {
      method: 'PATCH',
      body: JSON.stringify({ Id: id, id: id, disponivel })
    });
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

    const checkRes = await nocoFetch(`/records/${id}`);
    const product = await checkRes.json();
    if (!product || Number(product.empresa_id) !== Number(user.empresaId)) {
      throw new Error('Acesso negado: Produto não pertence a esta empresa');
    }

    await nocoFetch('/records', {
      method: 'DELETE',
      body: JSON.stringify([{ Id: id, id: id }])
    });
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

    // Garantir que preco seja um número válido
    if (productData.preco === '' || productData.preco === undefined || productData.preco === null) {
      productData.preco = 0;
    }
    productData.preco = Number(productData.preco);
    if (isNaN(productData.preco)) {
      productData.preco = 0;
    }

    // Validação Premium com Zod
    const validated = ProductSchema.safeParse(productData);
    if (!validated.success) {
      const errorMsg = validated.error.issues.map((issue: any) => issue.message).join(', ');
      throw new Error(`Dados inválidos: ${errorMsg}`);
    }

    const product = validated.data;
    const payload = {
      ...product,
      empresa_id: user.empresaId
    };

    delete (payload as any).created_at;
    delete (payload as any).updated_at;

    let savedProduct;

    if (payload.id) {
      // Update
      const updatePayload = { ...payload };
      delete (updatePayload as any).empresa_id;

      const res = await nocoFetch('/records', {
        method: 'PATCH',
        body: JSON.stringify({ ...updatePayload, Id: payload.id, id: payload.id })
      });
      const data = await res.json();
      savedProduct = { ...productData, ...data };
    } else {
      // Insert
      const res = await nocoFetch('/records', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      savedProduct = { ...productData, ...data };
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
