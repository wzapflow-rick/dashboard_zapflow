'use server';

import { revalidatePath } from 'next/cache';
import { getMe, requireAdmin } from '@/lib/session-server';
import { saveReceitaDoProduto } from './insumos';
import { ProductSchema, CategorySchema } from '@/lib/validations';
import { logAction } from '@/lib/audit';
import { v2 as cloudinary } from 'cloudinary';
import { pg } from '@/lib/postgres';
import { PRODUTOS_TABLE, CATEGORIAS_TABLE, PRODUTOS_METADADOS_TABLE } from '@/lib/tables';

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

    const data = await pg.list(PRODUTOS_TABLE, {
      where: { empresa_id: user.empresaId },
      sort: '-id',
      limit: 1000,
    });
    const products = data.list || [];

    // Buscar metadados dos produtos
    const metadataList = await pg.listAll(PRODUTOS_METADADOS_TABLE).catch(() => []);
    
    return products.map((p: any) => {
      const metadata = metadataList.find((m: any) => 
        Number(m.produto_id) === Number(p.id)
      );
      
      let recomendacoes = null;
      let tamanhos = null;

      const rawRecom = metadata?.recomendacoes;
      const rawTamanhos = metadata?.tamanhos;

      try {
        if (rawRecom && typeof rawRecom === 'string') {
          recomendacoes = JSON.parse(rawRecom);
        } else if (rawRecom && typeof rawRecom === 'object') {
          recomendacoes = rawRecom;
        }
        
        if (rawTamanhos && typeof rawTamanhos === 'string') {
          tamanhos = JSON.parse(rawTamanhos);
        } else if (rawTamanhos && typeof rawTamanhos === 'object') {
          tamanhos = rawTamanhos;
        }
      } catch (e) {
        console.error('Error parsing metadata JSON', e);
      }

      return JSON.parse(JSON.stringify({
        id: p.id,
        nome: p.nome || '',
        preco: Number(p.preco || 0),
        descricao: p.descricao || '',
        imagem: p.imagem || '',
        categoria_id: p.categoria_id || null,
        disponivel: p.disponivel !== false && p.disponivel !== 0,
        empresa_id: p.empresa_id,
        tamanhos: tamanhos || null,
        tamanhos_json: tamanhos || null,
        recomendacoes: recomendacoes || null,
        criado_em: p.criado_em || null,
        tag: p.tag || null,
      }));
    });
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

    const data = await pg.list(CATEGORIAS_TABLE, {
      where: { empresa_id: user.empresaId },
      limit: 1000,
    });
    const categories = data.list || [];

    return categories.map((c: any) => JSON.parse(JSON.stringify({
      id: c.id,
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
      const { id, ...updateData } = payload;
      delete updateData.empresa_id;
      
      result = await pg.update(CATEGORIAS_TABLE, { id, ...updateData });
      await logAction('SAVE_CATEGORY', `Sucesso ao salvar categoria: ${category.nome}`);
    } else {
      result = await pg.create(CATEGORIAS_TABLE, payload);
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

    const category = await pg.findById(CATEGORIAS_TABLE, id) as any;
    if (!category || Number(category.empresa_id) !== Number(user.empresaId)) {
      throw new Error('Acesso negado: Categoria não pertence a esta empresa');
    }

    await pg.delete(CATEGORIAS_TABLE, id);
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

    const product = await pg.findById(PRODUTOS_TABLE, id) as any;
    if (!product || Number(product.empresa_id) !== Number(user.empresaId)) {
      throw new Error('Acesso negado: Produto não pertence a esta empresa');
    }

    await pg.update(PRODUTOS_TABLE, { id, disponivel });
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

    const product = await pg.findById(PRODUTOS_TABLE, id) as any;
    if (!product || Number(product.empresa_id) !== Number(user.empresaId)) {
      throw new Error('Acesso negado: Produto não pertence a esta empresa');
    }

    await pg.delete(PRODUTOS_TABLE, id);
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
    console.log(`[UPSERT_PRODUCT] Iniciando para produto: ${productData.nome}`);

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

    const recomendacoes = productData.recomendacoes;
    const tamanhos = productData.tamanhos;

    delete payload.recomendacoes;
    delete payload.tamanhos;
    delete payload.created_at;
    delete payload.updated_at;

    let savedProduct;

    if (payload.id) {
      console.log(`[UPSERT_PRODUCT] Atualizando produto ID: ${payload.id}`);
      const { id, empresa_id, ...updateData } = payload;

      const data = await pg.update(PRODUTOS_TABLE, { id, ...updateData });
      savedProduct = { 
        ...productData, 
        ...data, 
        categoria_id: productData.categoria_id || data.categoria_id,
      };
    } else {
      console.log(`[UPSERT_PRODUCT] Criando novo produto`);
      const data = await pg.create(PRODUTOS_TABLE, payload);
      savedProduct = { 
        ...productData, 
        ...data,
        categoria_id: productData.categoria_id || data.categoria_id,
      };
    }

    // SALVAMENTO DE METADADOS (UPSell e Tamanhos)
    try {
      console.log(`[UPSERT_PRODUCT] Salvando metadados para produto ID: ${savedProduct.id}`);
      console.log(`[UPSERT_PRODUCT] Tamanhos recebidos:`, JSON.stringify(tamanhos));
      console.log(`[UPSERT_PRODUCT] Recomendacoes recebidas:`, JSON.stringify(recomendacoes));
      
      // Tentar encontrar metadados existentes
      const existingMetadata = await pg.findOne(PRODUTOS_METADADOS_TABLE, {
        where: { produto_id: savedProduct.id }
      });
      
      const tamanhosStr = tamanhos ? (typeof tamanhos === 'string' ? tamanhos : JSON.stringify(tamanhos)) : null;
      const recomendacoesStr = recomendacoes ? (typeof recomendacoes === 'string' ? recomendacoes : JSON.stringify(recomendacoes)) : null;
      
      if (existingMetadata && existingMetadata.id) {
        console.log(`[UPSERT_PRODUCT] Atualizando metadados existentes ID: ${existingMetadata.id}`);
        await pg.update(PRODUTOS_METADADOS_TABLE, {
          id: existingMetadata.id,
          tamanhos: tamanhosStr,
          recomendacoes: recomendacoesStr,
        });
      } else {
        console.log(`[UPSERT_PRODUCT] Criando novos metadados`);
        await pg.create(PRODUTOS_METADADOS_TABLE, {
          produto_id: savedProduct.id,
          tamanhos: tamanhosStr,
          recomendacoes: recomendacoesStr,
        });
      }
    } catch (metaError: any) {
      console.error('[UPSERT_PRODUCT] Erro ao salvar metadados:', metaError);
      console.error('[UPSERT_PRODUCT] Erro detalhes:', metaError.message);
    }

    if (selectedInsumos !== undefined && savedProduct && savedProduct.id) {
      await saveReceitaDoProduto(savedProduct.id, selectedInsumos);
    }

    revalidatePath('/dashboard/menu');
    return savedProduct;
  } catch (error: any) {
    console.error('[UPSERT_PRODUCT] Erro Crítico:', error);
    throw new Error(error.message || 'Failed to save product');
  }
}
