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
    nome: z.string().trim().min(2).max(120),
    descricao: z.string().trim().max(500).default(''),
    preco: z.number().finite().min(0),
    categoria: z.string().trim().max(80).nullable(),
  }),
).min(1).max(80);

export async function getCompanyMenuCategories(empresaId: number) {
  await requireAdminSession();
  if (!Number.isInteger(empresaId) || empresaId <= 0) throw new Error('Empresa inválida.');

  const empresa = await pg.findById(EMPRESAS_TABLE, empresaId);
  if (!empresa) throw new Error('Empresa não encontrada.');

  const result = await pg.list(CATEGORIAS_TABLE, {
    where: { empresa_id: empresaId },
    limit: 1000,
  });
  return (result.list || []).map((category: any) => ({
    id: Number(category.id),
    nome: String(category.nome || ''),
    empresa_id: empresaId,
  }));
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
            mimeType: image.type,
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

export async function saveMenuProductsForCompany(empresaId: number, untrustedProducts: unknown) {
  await requireAdminSession();
  if (!Number.isInteger(empresaId) || empresaId <= 0) throw new Error('Empresa inválida.');

  const empresa = await pg.findById(EMPRESAS_TABLE, empresaId);
  if (!empresa) throw new Error('Empresa não encontrada.');

  const validation = importedProductsSchema.safeParse(untrustedProducts);
  if (!validation.success) {
    throw new Error('Revise os produtos: há campos inválidos ou a lista é muito grande.');
  }

  const existingCategories = await pg.list(CATEGORIAS_TABLE, {
    where: { empresa_id: empresaId },
    limit: 1000,
  });
  const categoryMap = new Map<string, any>(
    (existingCategories.list || []).map((category: any) => [
      String(category.nome || '').trim().toLocaleLowerCase('pt-BR'),
      category,
    ]),
  );

  let created = 0;
  let withoutPrice = 0;

  for (const item of validation.data) {
    try {
      let categoryId: number | string | null = null;
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

      const parsedProduct = ProductSchema.safeParse({
        nome: item.nome,
        preco: item.preco,
        descricao: item.descricao,
        categoria_id: categoryId,
        categorias: categoryId,
        disponivel: item.preco > 0,
        imagem: '',
      });
      if (!parsedProduct.success) throw new Error('Dados de produto inválidos.');

      await pg.create(PRODUTOS_TABLE, {
        ...parsedProduct.data,
        empresa_id: empresaId,
      });
      created += 1;
      if (item.preco <= 0) withoutPrice += 1;
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'erro inesperado';
      return {
        success: false,
        created,
        withoutPrice,
        error: created > 0
          ? `Falha após salvar ${created} produto(s): ${detail}`
          : detail,
      };
    }
  }

  return { success: true, created, withoutPrice };
}
