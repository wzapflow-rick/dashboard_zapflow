'use server';

import db from '@/lib/db';
import { pg } from '@/lib/postgres';
import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { CATEGORIAS_TABLE, PRODUTOS_TABLE, EMPRESAS_TABLE } from '@/lib/tables';

// Provider OpenAI usando a chave propria do usuario (OPENAI_API_KEY),
// fora do AI Gateway da Vercel (que exige cartao cadastrado).
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Modelo multimodal (le print de cardapio + texto)
const MODELO_IA = openai('gpt-4o');

// ---------------------------------------------------------------------------
// Schema do cardapio estruturado pela IA
// ---------------------------------------------------------------------------
const cardapioSchema = z.object({
    nome_loja: z.string().describe('Nome do estabelecimento, se identificavel; senao, vazio'),
    categorias: z
        .array(
            z.object({
                nome: z.string().describe('Nome da categoria, ex: Hamburgueres, Bebidas, Pizzas'),
                itens: z
                    .array(
                        z.object({
                            nome: z.string().describe('Nome do produto'),
                            descricao: z.string().describe('Descricao curta do item; vazio se nao houver'),
                            preco: z.number().describe('Preco em reais (numero). Use 0 se nao houver preco visivel'),
                        })
                    )
                    .describe('Itens dessa categoria'),
            })
        )
        .describe('Categorias do cardapio com seus itens'),
});

export type CardapioEstruturado = z.infer<typeof cardapioSchema>;

/**
 * Estrutura um cardapio a partir de texto colado e/ou imagem (print).
 * NAO grava nada no banco - so retorna o JSON estruturado para revisao.
 */
export async function estruturarCardapio(input: {
    texto?: string;
    imagemBase64?: string; // data URL: "data:image/png;base64,...."
}): Promise<{ success: boolean; cardapio?: CardapioEstruturado; error?: string }> {
    try {
        if (!input.texto?.trim() && !input.imagemBase64) {
            return { success: false, error: 'Cole o texto do cardapio ou envie um print.' };
        }

        const instrucao =
            'Voce e um assistente que extrai cardapios de restaurantes/delivery. ' +
            'Analise o conteudo (texto e/ou imagem) e devolva as categorias com seus itens, ' +
            'nome, descricao curta e preco em reais. ' +
            'Agrupe itens semelhantes em categorias coerentes (ex: Hamburgueres, Bebidas, Sobremesas). ' +
            'Se um preco nao estiver visivel, use 0. Nao invente itens que nao existem no conteudo. ' +
            'Responda sempre em portugues do Brasil.';

        const userContent: any[] = [];
        if (input.texto?.trim()) {
            userContent.push({ type: 'text', text: `Cardapio (texto):\n${input.texto.trim()}` });
        }
        if (input.imagemBase64) {
            userContent.push({ type: 'text', text: 'Cardapio (imagem em anexo):' });
            userContent.push({ type: 'image', image: input.imagemBase64 });
        }

        const { output } = await generateText({
            model: MODELO_IA,
            system: instrucao,
            messages: [{ role: 'user', content: userContent }],
            output: Output.object({ schema: cardapioSchema }),
        });

        const cardapio = output;
        if (!cardapio || !cardapio.categorias || cardapio.categorias.length === 0) {
            return { success: false, error: 'Nao consegui identificar itens. Tente um print mais nitido ou cole o texto.' };
        }

        return { success: true, cardapio };
    } catch (error: any) {
        console.error('[demo-cardapio] Erro ao estruturar:', error);
        return { success: false, error: error?.message ?? 'Falha ao processar o cardapio com IA.' };
    }
}

/**
 * Gera um slug unico a partir do nome da loja.
 */
async function gerarSlugUnico(nomeLoja: string): Promise<string> {
    const base = nomeLoja
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove acentos
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 40) || 'demo-loja';

    let slug = base;
    let i = 1;
    // Garante unicidade na coluna slug (se a coluna nao existir, retorna o base)
    try {
        while (true) {
            const existe = await pg.raw<any>(
                `SELECT id FROM "${EMPRESAS_TABLE}" WHERE slug = $1 LIMIT 1`,
                [slug]
            );
            if (existe.length === 0) break;
            i++;
            slug = `${base}-${i}`;
        }
    } catch {
        // coluna slug indisponivel - segue com o base
    }
    return slug;
}

/**
 * Cria uma empresa de trial real com o cardapio estruturado e retorna o link publico.
 */
export async function criarDemoCardapio(input: {
    cardapio: CardapioEstruturado;
    nomeLoja: string;
    telefone?: string;
}): Promise<{ success: boolean; slug?: string; empresaId?: number; totalItens?: number; error?: string }> {
    const nomeLoja = (input.nomeLoja || input.cardapio.nome_loja || 'Loja Demo').trim();

    try {
        if (!input.cardapio?.categorias?.length) {
            return { success: false, error: 'Cardapio vazio - estruture o cardapio antes de criar a demo.' };
        }

        const slug = await gerarSlugUnico(nomeLoja);

        // 1. Cria a empresa (trial). telefone_loja recebe o telefone do prospect, se houver.
        const empresaResult = await db.query(
            `INSERT INTO empresas (nome_fantasia, telefone_loja, nome_admin, ativo, created_at, updated_at)
             VALUES ($1, $2, $3, TRUE, NOW(), NOW())
             RETURNING id`,
            [nomeLoja, input.telefone || null, nomeLoja]
        );
        const empresaId: number = empresaResult.rows[0].id;

        // Define o slug (coluna usada pelo menu publico). Em ambientes sem a coluna,
        // o getPublicMenu ainda resolve pelo nome_fantasia, entao nao quebramos a criacao.
        let slugFinal = slug;
        try {
            await db.query(`UPDATE empresas SET slug = $1 WHERE id = $2`, [slug, empresaId]);
        } catch (e) {
            console.warn('[demo-cardapio] Coluna slug indisponivel, usando fallback por nome:', e);
            slugFinal = nomeLoja
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9\s-]/g, '')
                .trim()
                .replace(/\s+/g, '-');
        }

        // instancia_evolution padrao (mesmo formato do createEmpresa)
        await db.query(`UPDATE empresas SET instancia_evolution = $1 WHERE id = $2`, [
            `zapflow_${empresaId}`,
            empresaId,
        ]);

        // Assinatura de trial (30 dias) para a empresa aparecer como cliente em teste
        const dataProxima = new Date();
        dataProxima.setDate(dataProxima.getDate() + 30);
        await db.query(
            `INSERT INTO assinaturas (empresa_id, plano, status, valor, data_inicio, data_proxima_cobranca, created_at, updated_at)
             VALUES ($1, 'start', 'authorized', 0, NOW(), $2, NOW(), NOW())`,
            [empresaId, dataProxima.toISOString()]
        );

        // 2. Insere categorias + produtos
        let totalItens = 0;
        let ordemCat = 0;
        for (const cat of input.cardapio.categorias) {
            const catResult = await db.query(
                `INSERT INTO categorias (empresa_id, nome, ordem, disponivel, created_at, updated_at)
                 VALUES ($1, $2, $3, TRUE, NOW(), NOW())
                 RETURNING id`,
                [empresaId, cat.nome.slice(0, 100), ordemCat]
            );
            const categoriaId: number = catResult.rows[0].id;
            ordemCat++;

            let ordemItem = 0;
            for (const item of cat.itens) {
                await db.query(
                    `INSERT INTO produtos (empresa_id, nome, preco, descricao, categoria_id, disponivel, ordem, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, TRUE, $6, NOW(), NOW())`,
                    [
                        empresaId,
                        item.nome.slice(0, 255),
                        Number.isFinite(item.preco) ? item.preco : 0,
                        item.descricao || null,
                        categoriaId,
                        ordemItem,
                    ]
                );
                ordemItem++;
                totalItens++;
            }
        }

        return { success: true, slug: slugFinal, empresaId, totalItens };
    } catch (error: any) {
        console.error('[demo-cardapio] Erro ao criar demo:', error);
        return { success: false, error: error?.message ?? 'Falha ao criar a empresa demo.' };
    }
}
