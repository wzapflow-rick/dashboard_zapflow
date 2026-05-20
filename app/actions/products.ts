'use server';

import { revalidatePath } from 'next/cache';
import { getMe, requireAdmin } from '@/lib/session-server';
import { saveReceitaDoProduto } from './insumos';
import { ProductSchema, CategorySchema } from '@/lib/validations';
import { logAction } from '@/lib/audit';
import { v2 as cloudinary } from 'cloudinary';
import { query } from '@/lib/db';

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

    const productsResult = await query(
      `SELECT * FROM produtos WHERE empresa_id = $1 ORDER BY id DESC LIMIT 1000`,
      [user.empresaId]
    );
    const products = productsResult.rows || [];

    // Buscar metadados dos produtos
    const metadataResult = await query(
      `SELECT * FROM produtos_metadados`
    ).catch(() => ({ rows: [] }));
    const metadataList = metadataResult.rows || [];

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

      return {
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
      };
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

    const result = await query(
      `SELECT * FROM categorias WHERE empresa_id = $1 ORDER BY ordem ASC, id ASC LIMIT 1000`,
      [user.empresaId]
    );
    const categories = result.rows || [];

    return categories.map((c: any) => ({
      id: c.id,
      nome: c.nome || '',
      empresa_id: c.empresa_id,
      ordem: Number(c.ordem || 0),
    }));
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
    let result;

    if (category.id) {
      await query(
        `UPDATE categorias SET nome = $1, ordem = $2, disponivel = $3 WHERE id = $4 AND empresa_id = $5`,
        [category.nome, category.ordem || 0, true, category.id, user.empresaId]
      );
      result = { ...category };
      await logAction('SAVE_CATEGORY', `Sucesso ao salvar categoria: ${category.nome}`);
    } else {
      const insertResult = await query(
        `INSERT INTO categorias (empresa_id, nome, ordem, disponivel)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [user.empresaId, category.nome, category.ordem || 0, true]
      );
      result = insertResult.rows[0];
    }

    revalidatePath('/dashboard/categories');
    revalidatePath('/dashboard/menu');
    return result;
  } catch (error: any) {
    console.error('API Error:', error);
    throw new Error(error.message || 'Failed to save category');
  }
}

export async function deleteCategory(id: number | string) {
  try {
    const user = await requireAdmin();

    const categoryResult = await query(
      `SELECT * FROM categorias WHERE id = $1`,
      [id]
    );
    const category = categoryResult.rows[0];

    if (!category || Number(category.empresa_id) !== Number(user.empresaId)) {
      throw new Error('Acesso negado: Categoria não pertence a esta empresa');
    }

    await query(`DELETE FROM categorias WHERE id = $1`, [id]);

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

    const productResult = await query(
      `SELECT * FROM produtos WHERE id = $1`,
      [id]
    );
    const product = productResult.rows[0];

    if (!product || Number(product.empresa_id) !== Number(user.empresaId)) {
      throw new Error('Acesso negado: Produto não pertence a esta empresa');
    }

    await query(
      `UPDATE produtos SET disponivel = $1 WHERE id = $2`,
      [disponivel, id]
    );

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

    const productResult = await query(
      `SELECT * FROM produtos WHERE id = $1`,
      [id]
    );
    const product = productResult.rows[0];

    if (!product || Number(product.empresa_id) !== Number(user.empresaId)) {
      throw new Error('Acesso negado: Produto não pertence a esta empresa');
    }

    await query(`DELETE FROM produtos WHERE id = $1`, [id]);

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
    const recomendacoes = productData.recomendacoes;
    const tamanhos = productData.tamanhos;

    let savedProduct;

    if (product.id) {
      console.log(`[UPSERT_PRODUCT] Atualizando produto ID: ${product.id}`);
      await query(
        `UPDATE produtos SET nome = $1, preco = $2, descricao = $3, imagem = $4, categoria_id = $5, disponivel = $6, tag = $7
         WHERE id = $8 AND empresa_id = $9`,
        [product.nome, product.preco, product.descricao || '', product.imagem || '', product.categoria_id, product.disponivel !== false, product.tag || null, product.id, user.empresaId]
      );
      savedProduct = { ...productData, id: product.id };
    } else {
      console.log(`[UPSERT_PRODUCT] Criando novo produto`);
      const insertResult = await query(
        `INSERT INTO produtos (empresa_id, nome, preco, descricao, imagem, categoria_id, disponivel, tag, criado_em)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [user.empresaId, product.nome, product.preco, product.descricao || '', product.imagem || '', product.categoria_id, true, product.tag || null, new Date().toISOString()]
      );
      savedProduct = { ...productData, ...insertResult.rows[0] };
    }

    // SALVAMENTO DE METADADOS (UPSell e Tamanhos)
    try {
      console.log(`[UPSERT_PRODUCT] Salvando metadados para produto ID: ${savedProduct.id}`);

      const tamanhosStr = tamanhos ? (typeof tamanhos === 'string' ? tamanhos : JSON.stringify(tamanhos)) : null;
      const recomendacoesStr = recomendacoes ? (typeof recomendacoes === 'string' ? recomendacoes : JSON.stringify(recomendacoes)) : null;

      const existingMetaResult = await query(
        `SELECT * FROM produtos_metadados WHERE produto_id = $1`,
        [savedProduct.id]
      ).catch(() => ({ rows: [] }));

      if (existingMetaResult.rows.length > 0) {
        await query(
          `UPDATE produtos_metadados SET tamanhos = $1, recomendacoes = $2 WHERE produto_id = $3`,
          [tamanhosStr, recomendacoesStr, savedProduct.id]
        );
      } else {
        await query(
          `INSERT INTO produtos_metadados (produto_id, tamanhos, recomendacoes)
           VALUES ($1, $2, $3)`,
          [savedProduct.id, tamanhosStr, recomendacoesStr]
        );
      }
    } catch (metaError: any) {
      console.error('[UPSERT_PRODUCT] Erro ao salvar metadados:', metaError);
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
