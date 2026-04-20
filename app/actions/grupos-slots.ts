'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from '@/lib/session-server';
import { getInsumos } from './insumos';
import { getReceitaDoItemBase } from './itens-base';
import { noco } from '@/lib/nocodb';
import { GRUPOS_SLOTS_TABLE_ID, ITENS_BASE_TABLE_ID, PRODUTOS_TABLE_ID } from '@/lib/constants';

export type TipoGrupo = 'fracionado' | 'adicional';
export type RegraPreco = 'mais_caro' | 'media' | 'soma';
export type ModoPreco = 'por_item' | 'fixo';

export interface GrupoSlot {
    id: number;
    nome: string;
    descricao?: string;
    empresa_id: number;
    tipo: TipoGrupo;
    qtd_slots: number;
    regra_preco: RegraPreco;
    min_slots: number;
    max_slots: number;
    itens?: number[];
    modo_preco?: ModoPreco;
    preco_fixo?: number;
    completamentos_ids?: number[];
}

export interface CompositeProduct {
    id: string;
    _grupoId: number;
    _isComposite: true;
    nome: string;
    descricao?: string;
    imagem?: string;
    tipo_calculo?: string;
    cobrar_mais_caro?: boolean;
    preco_fixo?: number;
    completamentos_ids?: number[];
    minimo: number;
    maximo: number;
    items: CompositeItem[];
}

export interface CompositeItem {
    id: number;
    nome: string;
    preco: number;
    descricao?: string;
    imagem?: string;
    fator_proporcao: number;
    grupo_id: number;
}

function parseJsonArray(value: any): number[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

// --- GRUPOS SLOTS ---

export async function getGruposSlots(): Promise<GrupoSlot[]> {
    try {
        const user = await getMe();
        if (!user?.empresaId) return [];

        const data = await noco.list(GRUPOS_SLOTS_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})`,
            limit: 1000,
        });

        return (data.list || []).map((g: any) => ({
            ...g,
            itens: parseJsonArray(g.itens)
        }));
    } catch (e) {
        console.error('getGruposSlots error:', e);
        return [];
    }
}

export async function upsertGrupoSlot(grupoData: Partial<GrupoSlot>) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const payload: any = {
            nome: grupoData.nome,
            empresa_id: user.empresaId,
            tipo: grupoData.tipo || 'fracionado',
            qtd_slots: grupoData.qtd_slots ?? 2,
            regra_preco: grupoData.regra_preco || 'mais_caro',
            min_slots: grupoData.min_slots ?? 1,
            max_slots: grupoData.max_slots ?? (grupoData.qtd_slots ?? 2),
            modo_preco: grupoData.modo_preco || 'por_item',
            preco_fixo: grupoData.modo_preco === 'fixo' ? (grupoData.preco_fixo || 0) : 0,
        };

        if (grupoData.descricao) payload.descricao = grupoData.descricao;
        if (grupoData.completamentos_ids) {
            const compStr = JSON.stringify(grupoData.completamentos_ids);
            console.log('>>> Salvando completamentos_ids:', compStr);
            payload.completamentos_ids = compStr;
        }
        if (grupoData.itens) payload.itens = JSON.stringify(grupoData.itens);

        delete payload.Id;
        delete payload.created_at;
        delete payload.updated_at;

        let data;
        if (grupoData.id) {
            data = await noco.update(GRUPOS_SLOTS_TABLE_ID, { id: grupoData.id, ...payload });
        } else {
            data = await noco.create(GRUPOS_SLOTS_TABLE_ID, payload);
        }

        revalidatePath('/dashboard/menu');
        return { ...grupoData, ...(data as any) };
    } catch (e: any) {
        console.error('upsertGrupoSlot error:', e);
        throw new Error(e.message || 'Erro ao salvar grupo');
    }
}

export async function deleteGrupoSlot(id: number) {
    try {
        await noco.delete(GRUPOS_SLOTS_TABLE_ID, id);
        revalidatePath('/dashboard/menu');
        return { success: true };
    } catch (e: any) {
        throw new Error(e.message || 'Erro ao deletar grupo');
    }
}

// --- ITENS NO GRUPO ---

export async function getItensDoGrupoSlot(grupoId: number): Promise<number[]> {
    try {
        const grupo = await noco.findOne(GRUPOS_SLOTS_TABLE_ID, {
            where: `(id,eq,${grupoId})`,
        }) as any;

        console.log('[DEBUG getItensDoGrupoSlot] Response:', JSON.stringify(grupo));
        const itens = grupo ? parseJsonArray(grupo.itens) : [];
        console.log('[DEBUG getItensDoGrupoSlot] Itens parseados:', itens);
        return itens;
    } catch (e) {
        console.error('getItensDoGrupoSlot error:', e);
        return [];
    }
}

export async function addItemBaseAoGrupo(grupoId: number, itemId: number) {
    try {
        const grupo = await noco.findOne(GRUPOS_SLOTS_TABLE_ID, {
            where: `(id,eq,${grupoId})`,
        }) as any;

        if (!grupo) throw new Error('Grupo não encontrado');

        console.log('[DEBUG addItemBaseAoGrupo] Grupo atual:', JSON.stringify(grupo));

        const itensAtuais = parseJsonArray(grupo.itens);

        if (itensAtuais.includes(itemId)) {
            return { success: true, alreadyExists: true };
        }

        const novosItens = [...itensAtuais, itemId];
        console.log('[DEBUG addItemBaseAoGrupo] Salvando itens:', JSON.stringify(novosItens));

        await noco.update(GRUPOS_SLOTS_TABLE_ID, { id: grupoId, itens: JSON.stringify(novosItens) });

        // Verificar se salvou
        const grupoAtualizado = await noco.findOne(GRUPOS_SLOTS_TABLE_ID, { where: `(id,eq,${grupoId})` });
        console.log('[DEBUG addItemBaseAoGrupo] Depois de salvar:', JSON.stringify(grupoAtualizado));

        revalidatePath('/dashboard/menu');
        return { success: true };
    } catch (e: any) {
        throw new Error(e.message || 'Erro ao adicionar item ao grupo');
    }
}

export async function removeItemBaseDoGrupo(grupoId: number, itemId: number) {
    try {
        const grupo = await noco.findOne(GRUPOS_SLOTS_TABLE_ID, {
            where: `(id,eq,${grupoId})`,
        }) as any;

        if (!grupo) return { success: true };

        const itensAtuais = parseJsonArray(grupo.itens);
        const novosItens = itensAtuais.filter(id => id !== itemId);

        await noco.update(GRUPOS_SLOTS_TABLE_ID, { id: grupoId, itens: JSON.stringify(novosItens) });

        revalidatePath('/dashboard/menu');
        return { success: true };
    } catch (e: any) {
        throw new Error(e.message || 'Erro ao remover item do grupo');
    }
}

// --- VINCULAR GRUPOS A PRODUTOS ---

export async function getGruposDoProduto(produtoId: number): Promise<number[]> {
    try {
        const produto = await noco.findOne(PRODUTOS_TABLE_ID, {
            where: `(id,eq,${produtoId})`,
        }) as any;
        return produto ? parseJsonArray(produto.grupos) : [];
    } catch (e) {
        console.error('getGruposDoProduto error:', e);
        return [];
    }
}

export async function updateGruposDoProduto(produtoId: number, grupoIds: number[]) {
    try {
        await noco.update(PRODUTOS_TABLE_ID, {
            id: produtoId,
            grupos: JSON.stringify(grupoIds)
        });

        revalidatePath('/dashboard/menu');
        return { success: true };
    } catch (e) {
        console.error('updateGruposDoProduto error:', e);
        throw new Error('Erro ao atualizar grupos do produto');
    }
}

// --- PRODUTOS COMPOSTOS ---

export async function getCompositeProducts(): Promise<CompositeProduct[]> {
    try {
        const user = await getMe();
        if (!user?.empresaId) return [];

        const [gruposData, itensData] = await Promise.all([
            noco.list(GRUPOS_SLOTS_TABLE_ID, { where: `(empresa_id,eq,${user.empresaId})`, limit: 1000 }),
            noco.list(ITENS_BASE_TABLE_ID, { where: `(empresa_id,eq,${user.empresaId})`, limit: 2000 }),
        ]);

        const grupos = (gruposData.list || []).filter((g: any) => g.tipo === 'fracionado');
        if (grupos.length === 0) return [];

        const itensMap = new Map<number, any>();
        (itensData.list || []).forEach((item: any) => {
            itensMap.set(item.id, {
                id: item.id,
                nome: item.nome,
                preco_sugerido: Number(item.preco_sugerido || 0),
                preco_custo: Number(item.preco_custo || 0),
            });
        });

        return grupos.map((g: any) => {
            const itens = parseJsonArray(g.itens);
            const items = itens
                .map((itemId: number) => {
                    const item = itensMap.get(itemId);
                    if (!item) return null;
                    return {
                        id: item.id,
                        nome: item.nome,
                        preco: item.preco_sugerido,
                        descricao: '',
                        imagem: '',
                        fator_proporcao: 1,
                        grupo_id: g.id,
                    };
                })
                .filter(Boolean);

            return {
                id: `composite-${g.id}`,
                _grupoId: g.id,
                _isComposite: true,
                nome: g.nome,
                descricao: g.descricao || '',
                imagem: '',
                tipo_calculo: g.modo_preco === 'fixo' ? 'fixo' : (g.regra_preco === 'mais_caro' ? 'maior_valor' : g.regra_preco),
                cobrar_mais_caro: g.regra_preco === 'mais_caro',
                preco_fixo: g.modo_preco === 'fixo' ? Number(g.preco_fixo || 0) : 0,
                completamentos_ids: parseJsonArray(g.completamentos_ids),
                minimo: g.min_slots,
                maximo: g.max_slots,
                items: items as any[],
            };
        });
    } catch (e) {
        console.error('getCompositeProducts error:', e);
        return [];
    }
}

export async function getCompositeProductsStock(): Promise<{ grupoId: number; estoquePossivel: number }[]> {
    try {
        const user = await getMe();
        if (!user?.empresaId) return [];

        const [gruposData, itensData] = await Promise.all([
            noco.list(GRUPOS_SLOTS_TABLE_ID, { where: `(empresa_id,eq,${user.empresaId})`, limit: 1000 }),
            noco.list(ITENS_BASE_TABLE_ID, { where: `(empresa_id,eq,${user.empresaId})`, limit: 2000 }),
        ]);

        const grupos = (gruposData.list || []).filter((g: any) => g.tipo === 'fracionado');
        if (grupos.length === 0) return [];

        const itensMap = new Map<number, any>();
        (itensData.list || []).forEach((item: any) => {
            itensMap.set(item.id, item);
        });

        const insumos = await getInsumos();
        const insumosMap = new Map<number, number>();
        insumos.forEach((insumo: any) => {
            insumosMap.set(insumo.id, Number(insumo.quantidade_atual || 0));
        });

        const results: { grupoId: number; estoquePossivel: number }[] = [];

        for (const grupo of grupos) {
            const itens = parseJsonArray(grupo.itens);
            if (itens.length === 0) {
            results.push({ grupoId: Number(grupo.id), estoquePossivel: 0 });                
                continue;
            }

            let estoqueMinimo = Infinity;

            for (const itemId of itens) {
                const itemBase = itensMap.get(itemId);
                if (!itemBase) continue;

                const receita = await getReceitaDoItemBase(itemId);
                if (receita.length === 0) continue;

                let minPossivel = Infinity;
                for (const r of receita) {
                    const estoqueInsumo = insumosMap.get(r.insumo) || 0;
                    const quantidadeNecessaria = Number(r.quantidade);
                    if (quantidadeNecessaria <= 0) continue;
                    const possivel = Math.floor(estoqueInsumo / quantidadeNecessaria);
                    if (possivel < minPossivel) minPossivel = possivel;
                }

                if (minPossivel === Infinity) minPossivel = 0;
                if (minPossivel < estoqueMinimo) estoqueMinimo = minPossivel;
            }

            results.push({
                grupoId: Number(grupo.id),
                estoquePossivel: estoqueMinimo === Infinity ? 0 : estoqueMinimo,
            });
        }

        return results;
    } catch (e) {
        console.error('getCompositeProductsStock error:', e);
        return [];
    }
}
