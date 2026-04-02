'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from './auth';
import { saveReceitaDoProduto } from './insumos';
import { ProductSchema, CategorySchema } from '@/lib/validations';
import { logAction } from '@/lib/audit';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const TABLE_ID = 'mu3kfx4zilr5401';
const CATEGORIES_TABLE_ID = 'mv81fy54qtamim2';

// SSL check should be enabled in production
if (process.env.NODE_ENV === 'development') {
  // process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Disabling only if absolutely strictly necessary for dev
}

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
    console.error(`NocoDB Error: ${res.status} ${text}`);
    throw new Error(`NocoDB API Error: ${res.status}`);
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

  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) throw new Error('ImgBB API Key is missing');

  const imgbbData = new FormData();
  imgbbData.append('image', file);

  try {
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: imgbbData,
    });
    const data = await res.json();
    if (data.success) {
      return data.data.url;
    } else {
      console.error('ImgBB error:', data);
      throw new Error(data.error?.message || 'Falha no upload da imagem (ImgBB)');
    }
  } catch (error) {
    console.error('Falha ao conectar no ImgBB:', error);
    throw new Error('Falha na comunicação com serviço de imagens');
  }
}

export async function getCategories(): Promise<Category[]> {
  try {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');

    const res = await nocoFetch(`/records?limit=1000&where=(empresa_id,eq,${user.empresaId})&sort=ordem`, {}, CATEGORIES_TABLE_ID);
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
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');

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
      empresas: user.empresaId
    };

    // Remove IDs de sistema se presentes no payload (exceto o ID principal)
    delete (payload as any).created_at;
    delete (payload as any).updated_at;

    if (payload.id) {
      const updatePayload = { ...payload };
      delete (updatePayload as any).empresa_id;

      const res = await nocoFetch('/records', {
        method: 'PATCH',
        body: JSON.stringify({ ...updatePayload, Id: payload.id, id: payload.id })
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
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');

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
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');

    // Segurança Premium: Verificar se o produto pertence à empresa
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
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');

    // Validação Premium com Zod
    const validated = ProductSchema.safeParse(productData);
    if (!validated.success) {
      const errorMsg = validated.error.issues.map((issue: any) => issue.message).join(', ');
      throw new Error(`Dados inválidos: ${errorMsg}`);
    }

    const product = validated.data;
    const payload = {
      ...product,
      empresa_id: user.empresaId,
      empresas: user.empresaId
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
