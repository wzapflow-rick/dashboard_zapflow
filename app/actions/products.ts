'use server';

import { revalidatePath } from 'next/cache';
import { getMe, requireAdmin } from '@/lib/session-server';
import { saveReceitaDoProduto } from './insumos';
import { ProductSchema, CategorySchema } from '@/lib/validations';
import { logAction } from '@/lib/audit';
import { v2 as cloudinary } from 'cloudinary';
import { noco } from '@/lib/nocodb';
import { PRODUTOS_TABLE_ID, CATEGORIAS_TABLE_ID, PRODUTOS_METADADOS_TABLE_ID } from '@/lib/constants';

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

    // Buscar metadados dos produtos
    // Usando uma busca ampla e filtrando no código para evitar erros de alias de coluna na busca
    const metadataList = await noco.listAll(PRODUTOS_METADADOS_TABLE_ID).catch(() => []);
    
    return products.map((p: any) => {
      // Tentar encontrar por 'Produto ID' ou 'produto_id'
      const metadata = metadataList.find((m: any) => 
        Number(m['Produto ID'] || m.produto_id || m.Produto_ID) === Number(p.id)
      );
      
      let recomendacoes = null;
      let tamanhos = null;

      const rawRecom = metadata?.Recomendacoes || metadata?.recomendacoes || metadata?.Recomendações;
      const rawTamanhos = metadata?.Tamanhos || metadata?.tamanhos;

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
        id: p.id || p.Id,
        nome: p.nome || '',
        preco: Number(p.preco || 0),
        descricao: p.descricao || '',
        imagem: p.imagem || '',
        categoria_id: p.categoria_id || p.categorias || null,
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
      const updatePayload = { ...payload };
      delete updatePayload.empresa_id;

      const data = await noco.update(PRODUTOS_TABLE_ID, updatePayload);
      savedProduct = { 
        ...productData, 
        ...data, 
        categoria_id: productData.categoria_id || data.categoria_id,
      };
    } else {
      console.log(`[UPSERT_PRODUCT] Criando novo produto`);
      const data = await noco.create(PRODUTOS_TABLE_ID, payload);
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
      const metadataList = await noco.listAll(PRODUTOS_METADADOS_TABLE_ID).catch(() => []);
      const existingMetadata = metadataList.find((m: any) => 
        Number(m['Produto ID'] || m.produto_id || m.Produto_ID) === Number(savedProduct.id)
      );
      
      // Detectar o ID do registro - NocoDB pode usar diferentes nomes
      const metadataId = existingMetadata?.id || existingMetadata?.Id || existingMetadata?.ID || 
                         existingMetadata?.nc_id || Object.keys(existingMetadata || {}).find(k => k.toLowerCase() === 'id' && existingMetadata[k]);
      const actualId = metadataId ? (typeof metadataId === 'object' ? null : metadataId) : null;
      
      console.log(`[UPSERT_PRODUCT] Metadados existentes:`, existingMetadata ? `ID ${actualId} (keys: ${Object.keys(existingMetadata).join(', ')})` : 'Nenhum');
      
      // Preparar o payload - tentar diferentes formatos de nome de coluna
      const tamanhosStr = tamanhos ? (typeof tamanhos === 'string' ? tamanhos : JSON.stringify(tamanhos)) : null;
      const recomendacoesStr = recomendacoes ? (typeof recomendacoes === 'string' ? recomendacoes : JSON.stringify(recomendacoes)) : null;
      
      // Verificar qual formato de coluna existe no registro existente
      let metadataPayload: any = {};
      
      if (existingMetadata && actualId) {
        // Detectar o formato de colunas usado
        const hasProdutoID = 'Produto ID' in existingMetadata;
        const hasProduto_id = 'produto_id' in existingMetadata;
        const hasTamanhos = 'Tamanhos' in existingMetadata;
        const hasTamanhos_lower = 'tamanhos' in existingMetadata;
        
        console.log(`[UPSERT_PRODUCT] Formato detectado: Produto ID=${hasProdutoID}, produto_id=${hasProduto_id}, Tamanhos=${hasTamanhos}, tamanhos=${hasTamanhos_lower}`);
        
        metadataPayload = {
          id: actualId,
        };
        
        // Usar o mesmo formato que ja existe
        if (hasTamanhos) {
          metadataPayload['Tamanhos'] = tamanhosStr;
        } else if (hasTamanhos_lower) {
          metadataPayload['tamanhos'] = tamanhosStr;
        } else {
          // Tentar ambos
          metadataPayload['Tamanhos'] = tamanhosStr;
          metadataPayload['tamanhos'] = tamanhosStr;
        }
        
        if ('Recomendacoes' in existingMetadata) {
          metadataPayload['Recomendacoes'] = recomendacoesStr;
        } else if ('recomendacoes' in existingMetadata) {
          metadataPayload['recomendacoes'] = recomendacoesStr;
        } else {
          metadataPayload['Recomendacoes'] = recomendacoesStr;
        }
        
        console.log(`[UPSERT_PRODUCT] Payload de update:`, JSON.stringify(metadataPayload));
        const updateResult = await noco.update(PRODUTOS_METADADOS_TABLE_ID, metadataPayload);
        console.log(`[UPSERT_PRODUCT] Resultado update:`, JSON.stringify(updateResult));
      } else {
        // Criar novos metadados (ou se nao conseguiu encontrar o ID)
        console.log(`[UPSERT_PRODUCT] Criando novos metadados (existingMetadata: ${!!existingMetadata}, actualId: ${actualId})`);
        metadataPayload = {
          'Produto ID': savedProduct.id,
          'Recomendacoes': recomendacoesStr,
          'Tamanhos': tamanhosStr,
        };
        
        // Se ja existe um registro mas nao conseguimos o ID, tentar deletar antes
        if (existingMetadata && !actualId) {
          console.log(`[UPSERT_PRODUCT] Registro existe mas ID nao encontrado, tentando criar novo...`);
        }
        
        const createResult = await noco.create(PRODUTOS_METADADOS_TABLE_ID, metadataPayload);
        console.log(`[UPSERT_PRODUCT] Resultado create:`, JSON.stringify(createResult));
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
