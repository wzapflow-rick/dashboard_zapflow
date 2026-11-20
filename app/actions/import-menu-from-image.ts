'use server';

import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/admin-session';
import { pg } from '@/lib/postgres';
import { CategorySchema, ProductSchema } from '@/lib/validations';
import { CATEGORIAS_TABLE, EMPRESAS_TABLE, PRODUTOS_TABLE } from '@/lib/tables';

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    descricao: z.string().trim().max(500).nullable(),
    preco: z.number().finite().min(0).nullable(),
    categoria: z.string().trim().max(80).nullable(),
    disponivel: z.boolean().optional(),
  }),
).min(1).max(80);

function isAvailable(value: unknown): boolean {
  return value !== false && value !== 0 && value !== 'false';
}

export async function getCompanyMenuData(empresaId: number) {
  await requireAdminSession();
  if (!Number.isInteger(empresaId) || empresaId <= 0) throw new Error('Empresa inválida.');

  const empresa = await pg.findById(EMPRESAS_TABLE, empresaId);
  if (!empresa) throw new Error('Empresa não encontrada.');

  const [categoryResult, productResult] = await Promise.all([
    pg.list(CATEGORIAS_TABLE, { where: { empresa_id: empresaId }, limit: 1000 }),
    pg.list(PRODUTOS_TABLE, { where: { empresa_id: empresaId }, sort: '-id', limit: 1000 }),
  ]);

  const categories = (categoryResult.list || []).map((category: any) => ({
    id: Number(category.id),
    nome: String(category.nome || ''),
    empresa_id: empresaId,
  }));
  const categoryById = new Map(categories.map((category) => [category.id, category.nome]));
  const products = (productResult.list || []).map((product: any) => {
    const categoryId = Number(product.categoria_id || product.categorias || 0);
    return {
      id: Number(product.id),
      nome: String(product.nome || ''),
      descricao: String(product.descricao || ''),
      preco: Number(product.preco || 0),
      categoria_id: categoryId || null,
      categoria: categoryById.get(categoryId) || '',
      disponivel: isAvailable(product.disponivel),
    };
  });

  return { categories, products };
}

/**
 * Lê uma foto de cardápio e devolve produtos para revisão. Nada é gravado
 * até o administrador confirmar a lista no modal.
 */
export async function extractMenuProductsFromImage(formData: FormData) {
  await requireAdminSession();

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

  const imageBytes = new Uint8Array(await image.arrayBuffer());
  const { output } = await generateText({
    model: openai('gpt-4o-mini'),
    system: [
      'Você extrai dados de cardápios para um sistema de delivery brasileiro.',
      'Leia somente o que estiver visível na imagem. Não invente nomes, descrições, categorias ou preços.',
      'Se um preço não estiver legível ou não existir, retorne null. Valores devem ser números em reais, sem símbolo.',
      'Separe categorias quando elas estiverem indicadas. Se a imagem tiver apenas fotos sem texto, retorne produtos vazio.',
      'Ignore telefone, endereço, promoções gerais e outros textos que não sejam produtos.',
      'Preserve os nomes e descrições em português do Brasil.',
    ].join(' '),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extraia os produtos desta imagem de cardápio. Não estime preços. Agrupe cada item com sua categoria quando ela estiver clara.',
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

/**
 * Cria produtos novos ou atualiza produtos existentes da empresa selecionada.
 * A foto nunca remove itens que não aparecem nela.
 */
export async function saveMenuProductsForCompany(empresaId: number, untrustedProducts: unknown) {
  await requireAdminSession();
  if (!Number.isInteger(empresaId) || empresaId <= 0) throw new Error('Empresa inválida.');

  const empresa = await pg.findById(EMPRESAS_TABLE, empresaId);
  if (!empresa) throw new Error('Empresa não encontrada.');

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
      const parsedProduct = ProductSchema.safeParse({
        id: existing?.id,
        nome: item.nome,
        preco: price,
        descricao: item.descricao ?? existing?.descricao ?? '',
        categoria_id: categoryId,
        categorias: categoryId,
        disponivel: available,
        imagem: existing?.imagem || '',
      });
      if (!parsedProduct.success) throw new Error('Dados de produto inválidos.');

      const { id, ...productData } = parsedProduct.data;
      if (existing) {
        await pg.update(PRODUTOS_TABLE, { id: existing.id, ...productData });
        updated += 1;
      } else {
        await pg.create(PRODUTOS_TABLE, { ...productData, empresa_id: empresaId });
        created += 1;
      }
      if (price <= 0) withoutPrice += 1;
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'erro inesperado';
      return {
        success: false,
        created,
        updated,
        withoutPrice,
        error: created + updated > 0
          ? `Falha após salvar ${created + updated} produto(s): ${detail}`
          : detail,
      };
    }
  }

  return { success: true, created, updated, withoutPrice };
}
