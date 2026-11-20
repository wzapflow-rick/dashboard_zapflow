'use server';

import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { requireAdmin } from '@/lib/session-server';

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

export type MenuProductDraft = z.infer<typeof menuProductsSchema>['produtos'][number];

/**
 * Lê uma foto de cardápio e devolve produtos para revisão. Nenhum produto é
 * salvo por esta ação; a gravação só acontece depois da confirmação no modal.
 */
export async function extractMenuProductsFromImage(formData: FormData): Promise<MenuProductDraft[]> {
  await requireAdmin();

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
