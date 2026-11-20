'use server';

import { generateText, Output } from 'ai';
import { revalidatePath } from 'next/cache';
import { createOpenAI } from '@ai-sdk/openai';
import { v2 as cloudinary } from 'cloudinary';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/admin-session';
import { pg } from '@/lib/postgres';
import { CategorySchema, ProductSchema } from '@/lib/validations';
import {
  CATEGORIAS_TABLE,
  EMPRESAS_TABLE,
  PRODUTOS_METADADOS_TABLE,
  PRODUTOS_TABLE,
} from '@/lib/tables';

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const menuProductsSchema = z.object({
  produtos: z.array(
    z.object({
      nome: z.string().min(1).max(120),
      descricao: z.string().max(500).nullable(),
      preco: z.number().nonnegative().nullable(),
      categoria: z.string().max(80).nullable(),
    }),
  ).max(80),
});

const importedProductsSchema = z.array(
  z.object({
    id: z.number().int().positive().optional(),
    nome: z.string().trim().min(2).max(120),
    descricao: z.string().trim().max(500).nullable().optional(),
    preco: z.number().finite().min(0).nullable().optional(),
    categoria: z.string().trim().max(80).nullable().optional(),
    disponivel: z.boolean().optional(),
    imagem: z.string().max(2048).optional(),
    tag: z.string().max(40).nullable().optional(),
    tamanhos: z.union([
      z.string().max(4000),
      z.array(z.object({ nome: z.string().max(80), preco: z.number().nonnegative() })).max(20),
      z.null(),
    ]).optional(),
    recomendacoes: z.union([
      z.string().max(4000),
      z.array(z.number().int().positive()).max(100),
      z.null(),
    ]).optional(),
  }),
).min(1).max(80);

function isAvailable(value: unknown): boolean {
  return value !== false && value !== 0 && value !== 'false';
}

function serializeMetadata(value: unknown): string | null {
  if (value === undefined) return null;
  if (value === null || value === '') return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

async function findCompany(empresaId: number) {
  if (!Number.isInteger(empresaId) || empresaId <= 0) throw new Error('Empresa inválida.');
  const empresa = await pg.findById(EMPRESAS_TABLE, empresaId);
  if (!empresa) throw new Error('Empresa não encontrada.');
  return empresa;
}

export async function getCompanyMenuData(empresaId: number) {
  await requireAdminSession();
  await findCompany(empresaId);

  const [categoryResult, productResult, metadataList] = await Promise.all([
    pg.list(CATEGORIAS_TABLE, { where: { empresa_id: empresaId }, limit: 1000 }),
    pg.list(PRODUTOS_TABLE, { where: { empresa_id: empresaId }, sort: '-id', limit: 1000 }),
    pg.raw<any>(
      `SELECT * FROM "${PRODUTOS_METADADOS_TABLE}" WHERE produto_id::text IN (SELECT id::text FROM "${PRODUTOS_TABLE}" WHERE empresa_id = $1)`,
      [empresaId]
    ).catch(() => []),
  ]);

  const categories = (categoryResult.list || []).map((category: any) => ({
    id: Number(category.id),
    nome: String(category.nome || ''),
    empresa_id: empresaId,
    ordem: Number(category.ordem || 0),
  }));
  const categoryById = new Map(categories.map((category) => [category.id, category.nome]));
  const products = (productResult.list || []).map((product: any) => {
    const productId = Number(product.id);
    const categoryId = Number(product.categoria_id || product.categorias || 0);
    const metadata = metadataList.find((item: any) => Number(item.produto_id) === productId);
    let tamanhos = metadata?.tamanhos ?? null;
    let recomendacoes = metadata?.recomendacoes ?? null;
    try {
      if (typeof tamanhos === 'string') tamanhos = JSON.parse(tamanhos);
      if (typeof recomendacoes === 'string') recomendacoes = JSON.parse(recomendacoes);
    } catch {
      /* mantém os metadados originais para não ocultar informação */
    }

    return {
      id: productId,
      nome: String(product.nome || ''),
      descricao: String(product.descricao || ''),
      preco: Number(product.preco || 0),
      imagem: String(product.imagem || ''),
      categoria_id: categoryId || null,
      categoria: categoryById.get(categoryId) || '',
      disponivel: isAvailable(product.disponivel),
      tag: product.tag || null,
      tamanhos,
      tamanhos_json: tamanhos,
      recomendacoes,
    };
  });

  return { categories, products };
}

/**
 * Lê uma foto de cardápio e devolve produtos para revisão. Nada é gravado
 * até o administrador confirmar a lista no modal.
 */
export async function extractMenuProductsFromImage(
  empresaId: number,
  formData: FormData,
) {
  await requireAdminSession();
  await findCompany(empresaId);

  const image = formData.get('image');
  if (!(image instanceof File) || image.size === 0) {
    throw new Error('Selecione uma imagem para importar.');
  }

  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowedTypes.has(image.type)) {
    throw new Error('Use uma imagem JPG, PNG ou WebP.');
  }
  if (image.size > 750 * 1024) {
    throw new Error('A imagem continua grande. Tente uma foto menor ou mais comprimida.');
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('A importação por foto precisa da variável OPENAI_API_KEY configurada no servidor.');
  }

  const preferences = String(formData.get('preferences') || '').trim().slice(0, 1000);
  const categoryPolicy = formData.get('categoryPolicy') === 'existing'
    ? 'Use somente as categorias já existentes; escolha a mais próxima e não proponha categorias novas.'
    : 'Prefira as categorias existentes; proponha uma categoria nova apenas quando nenhum grupo atual fizer sentido.';
  const menuData = await getCompanyMenuData(empresaId);
  const existingCategories = menuData.categories.map((category) => category.nome).filter(Boolean);
  const categoryContext = existingCategories.length
    ? existingCategories.join(', ')
    : 'Ainda não existem categorias cadastradas.';

  const imageBytes = new Uint8Array(await image.arrayBuffer());
  const { output } = await generateText({
    model: openai('gpt-4o-mini'),
    system: [
      'Você organiza cardápios para um sistema de delivery brasileiro.',
      'Leia somente o que estiver visível na imagem. Não invente nomes, descrições, categorias ou preços.',
      'Se um preço não estiver legível ou não existir, retorne null. Valores devem ser números em reais, sem símbolo.',
      'Ignore telefone, endereço, promoções gerais e outros textos que não sejam produtos.',
      'Preserve os nomes e descrições em português do Brasil.',
      'Categorias já cadastradas para esta empresa: ' + categoryContext,
      'Regra de categorias: ' + categoryPolicy,
      preferences ? 'Preferências adicionais do administrador: ' + preferences : '',
      'Atribua cada produto a uma categoria apropriada. Se vários itens forem do mesmo grupo, reutilize a mesma categoria.',
    ].filter(Boolean).join(' '),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extraia os produtos da imagem, categorizando e organizando os itens de forma consistente. Não estime preços.',
          },
          {
            type: 'image',
            image: imageBytes,
            mediaType: image.type,
          },
        ],
      },
    ],
    output: Output.object({ schema: menuProductsSchema }),
  });

  if (!output || output.produtos.length === 0) {
    throw new Error('Não encontrei produtos legíveis nessa imagem. Tente uma foto mais nítida ou cadastre os itens manualmente.');
  }

  return output.produtos;
}

export async function uploadCompanyProductImage(empresaId: number, formData: FormData) {
  await requireAdminSession();
  await findCompany(empresaId);

  const image = formData.get('image');
  if (!(image instanceof File) || image.size === 0) return null;
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(image.type)) {
    throw new Error('Use uma imagem JPG, PNG, WebP ou GIF.');
  }
  if (image.size > 10 * 1024 * 1024) throw new Error('A imagem deve ter até 10 MB.');

  const buffer = Buffer.from(await image.arrayBuffer());
  const dataUrl = `data:${image.type};base64,${buffer.toString('base64')}`;
  const uploaded = await cloudinary.uploader.upload(dataUrl, {
    folder: `zapflow_products/company_${empresaId}`,
  });
  return uploaded.secure_url;
}

/**
 * Exclui um produto somente quando ele pertence à empresa selecionada.
 */
export async function deleteMenuProductForCompany(empresaId: number, productId: number) {
  await requireAdminSession();
  await findCompany(empresaId);
  if (!Number.isInteger(productId) || productId <= 0) throw new Error('Produto inválido.');

  const product = await pg.findById(PRODUTOS_TABLE, productId) as any;
  if (!product || Number(product.empresa_id) !== empresaId) {
    throw new Error('O produto não pertence à empresa selecionada ou já foi removido.');
  }

  const metadataResult = await pg.list(PRODUTOS_METADADOS_TABLE, {
    where: { produto_id: productId },
    limit: 100,
  });
  for (const metadata of metadataResult.list || []) {
    const metadataId = (metadata as any).id as number | string | undefined;
    if (metadataId) await pg.delete(PRODUTOS_METADADOS_TABLE, metadataId);
  }

  await pg.delete(PRODUTOS_TABLE, productId);
  return { success: true };
}

export async function saveCompanyCategoryForAdmin(
  empresaId: number,
  untrustedCategory: unknown,
) {
  await requireAdminSession();
  await findCompany(empresaId);

  const validation = CategorySchema.safeParse(untrustedCategory);
  if (!validation.success) throw new Error('Informe um nome de categoria válido.');

  const category = validation.data;
  const existingCategories = await pg.list(CATEGORIAS_TABLE, {
    where: { empresa_id: empresaId },
    limit: 1000,
  });
  const existing = category.id
    ? (existingCategories.list || []).find((item: any) => Number(item.id) === Number(category.id))
    : null;
  if (category.id && !existing) {
    throw new Error('A categoria não pertence à empresa selecionada.');
  }

  const payload = {
    nome: category.nome,
    ordem: Number(category.ordem || 0),
    empresa_id: empresaId,
    disponivel: true,
  };
  const saved = existing
    ? await pg.update(CATEGORIAS_TABLE, { id: Number(existing.id), nome: payload.nome, ordem: payload.ordem })
    : await pg.create(CATEGORIAS_TABLE, payload);

  revalidatePath('/admin/empresas');
  return {
    id: Number((saved as any)?.id || existing?.id),
    nome: category.nome,
    empresa_id: empresaId,
    ordem: payload.ordem,
  };
}

export async function reorderCompanyCategoriesForAdmin(
  empresaId: number,
  untrustedCategoryIds: unknown,
) {
  await requireAdminSession();
  await findCompany(empresaId);
  if (!Array.isArray(untrustedCategoryIds) || !untrustedCategoryIds.every((id) => Number.isInteger(Number(id)) && Number(id) > 0)) {
    throw new Error('Lista de categorias inválida.');
  }

  const existing = await pg.list(CATEGORIAS_TABLE, {
    where: { empresa_id: empresaId },
    limit: 1000,
  });
  const currentIds = (existing.list || []).map((category: any) => Number(category.id));
  const orderedIds = untrustedCategoryIds.map(Number);
  if (
    orderedIds.length !== currentIds.length ||
    new Set(orderedIds).size !== currentIds.length ||
    currentIds.some((id) => !orderedIds.includes(id))
  ) {
    throw new Error('A lista de categorias mudou. Atualize e tente novamente.');
  }

  for (const [index, id] of orderedIds.entries()) {
    await pg.update(CATEGORIAS_TABLE, { id, ordem: index + 1 });
  }

  revalidatePath('/admin/empresas');
  return { success: true };
}

export async function deleteCompanyCategoryForAdmin(empresaId: number, categoryId: number) {
  await requireAdminSession();
  await findCompany(empresaId);
  if (!Number.isInteger(categoryId) || categoryId <= 0) throw new Error('Categoria inválida.');

  const category = await pg.findById(CATEGORIAS_TABLE, categoryId) as any;
  if (!category || Number(category.empresa_id) !== empresaId) {
    throw new Error('A categoria não pertence à empresa selecionada ou já foi removida.');
  }

  await pg.delete(CATEGORIAS_TABLE, categoryId);
  revalidatePath('/admin/empresas');
  return { success: true };
}

/**
 * Atualiza produtos selecionados e cria itens que ainda não existem.
 * Produtos ausentes da foto permanecem intactos.
 */
export async function saveMenuProductsForCompany(empresaId: number, untrustedProducts: unknown) {
  await requireAdminSession();
  await findCompany(empresaId);

  const validation = importedProductsSchema.safeParse(untrustedProducts);
  if (!validation.success) {
    throw new Error('Revise os produtos: há campos inválidos ou a lista é muito grande.');
  }

  const [existingCategories, existingProducts] = await Promise.all([
    pg.list(CATEGORIAS_TABLE, { where: { empresa_id: empresaId }, limit: 1000 }),
    pg.list(PRODUTOS_TABLE, { where: { empresa_id: empresaId }, limit: 1000 }),
  ]);
  const categoryMap = new Map<string, any>(
    (existingCategories.list || []).map((category: any) => [
      String(category.nome || '').trim().toLocaleLowerCase('pt-BR'),
      category,
    ]),
  );
  const productMap = new Map<number, any>(
    (existingProducts.list || []).map((product: any) => [Number(product.id), product]),
  );

  let created = 0;
  let updated = 0;
  let withoutPrice = 0;
  const createdProductIds: number[] = [];

  for (const item of validation.data) {
    try {
      const existing = item.id ? productMap.get(item.id) : undefined;
      if (item.id && !existing) {
        throw new Error('O produto não pertence à empresa selecionada ou foi removido.');
      }

      let categoryId: number | string | null = existing?.categoria_id || existing?.categorias || null;
      const categoryName = item.categoria?.trim();
      if (categoryName) {
        const key = categoryName.toLocaleLowerCase('pt-BR');
        let category = categoryMap.get(key);
        if (!category) {
          const parsedCategory = CategorySchema.safeParse({ nome: categoryName });
          if (!parsedCategory.success) throw new Error('Nome de categoria inválido.');
          category = await pg.create(CATEGORIAS_TABLE, {
            ...parsedCategory.data,
            empresa_id: empresaId,
            disponivel: true,
          });
          categoryMap.set(key, category);
        }
        categoryId = category.id;
      }

      const price = item.preco ?? (existing ? Number(existing.preco || 0) : 0);
      const available = item.disponivel ?? (
        existing
          ? isAvailable(existing.disponivel)
          : price > 0
      );
      const tamanhos = item.tamanhos === undefined
        ? undefined
        : item.tamanhos === null || item.tamanhos === ''
          ? null
          : typeof item.tamanhos === 'string'
            ? item.tamanhos
            : JSON.stringify(item.tamanhos);
      const recomendacoes = item.recomendacoes === undefined
        ? undefined
        : item.recomendacoes === null || item.recomendacoes === ''
          ? null
          : typeof item.recomendacoes === 'string'
            ? item.recomendacoes
            : JSON.stringify(item.recomendacoes);

      const productData: any = {
        id: existing?.id,
        nome: item.nome,
        preco: price,
        descricao: item.descricao ?? existing?.descricao ?? '',
        categoria_id: categoryId,
        categorias: categoryId,
        disponivel: available,
        imagem: item.imagem ?? existing?.imagem ?? '',
        tag: item.tag === undefined ? existing?.tag ?? null : item.tag,
        tamanhos,
        recomendacoes,
      };
      const parsedProduct = ProductSchema.safeParse(productData);
      if (!parsedProduct.success) throw new Error('Dados de produto inválidos.');

      const {
        id,
        tamanhos: parsedSizes,
        recomendacoes: parsedRecommendations,
        ...productFields
      } = parsedProduct.data as any;

      let savedProduct: any;
      if (existing) {
        savedProduct = await pg.update(PRODUTOS_TABLE, { id: existing.id, ...productFields });
        updated += 1;
      } else {
        savedProduct = await pg.create(PRODUTOS_TABLE, { ...productFields, empresa_id: empresaId });
        created += 1;
        if (savedProduct?.id) createdProductIds.push(Number(savedProduct.id));
      }

      if (parsedSizes !== undefined || parsedRecommendations !== undefined) {
        const existingMetadata = await pg.findOne(PRODUTOS_METADADOS_TABLE, {
          where: { produto_id: savedProduct?.id || existing?.id },
        });
        const metadata = {
          produto_id: savedProduct?.id || existing?.id,
          tamanhos: parsedSizes === undefined ? existingMetadata?.tamanhos ?? null : serializeMetadata(parsedSizes),
          recomendacoes: parsedRecommendations === undefined
            ? existingMetadata?.recomendacoes ?? null
            : serializeMetadata(parsedRecommendations),
        };
        const existingMetadataId = existingMetadata?.id as number | string | undefined;
        if (existingMetadataId) {
          await pg.update(PRODUTOS_METADADOS_TABLE, existingMetadataId, metadata);
        } else {
          await pg.create(PRODUTOS_METADADOS_TABLE, metadata);
        }
      }

      if (price <= 0) withoutPrice += 1;
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'erro inesperado';
      return {
        success: false,
        created,
        updated,
        withoutPrice,
        createdProductIds,
        error: created + updated > 0
          ? `Falha após salvar ${created + updated} produto(s): ${detail}`
          : detail,
      };
    }
  }

  return { success: true, created, updated, withoutPrice, createdProductIds };
}
