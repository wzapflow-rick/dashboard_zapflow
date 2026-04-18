'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from './auth';
import { getInsumos } from './insumos';
import { getReceitaDoItemBase } from './itens-base';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';

const GRUPOS_SLOTS_TABLE_ID = 'm1h9jeye8hcd4k6';
const ITENS_BASE_TABLE_ID = 'mfcp67skbxq4nt5';
const PRODUTOS_TABLE_ID = 'mh81t2xp1uml6pc';

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

async function nocoFetch(tableId: string, endpoint: string, options: RequestInit = {}) {
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
        console.error(`NocoDB Error (Table ${tableId}): ${res.status} ${text}`);
        throw new Error(`NocoDB API Error: ${res.status}`);
    }

    return res;
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

        const res = await nocoFetch(
            GRUPOS_SLOTS_TABLE_ID,
            `/records?limit=1000&where=(empresa_id,eq,${user.empresaId})`
        );
        const data = await res.json();
        
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

        const isUpdate = !!grupoData.id;

        if (isUpdate) {
            const res = await nocoFetch(GRUPOS_SLOTS_TABLE_ID, '/records', {
                method: 'PATCH',
                body: JSON.stringify({ Id: grupoData.id, id: grupoData.id, ...payload }),
            });
            const data = await res.json();
            revalidatePath('/dashboard/menu');
            return { ...grupoData, ...data };
        } else {
            const res = await nocoFetch(GRUPOS_SLOTS_TABLE_ID, '/records', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            revalidatePath('/dashboard/menu');
            return { ...payload, ...data };
        }
    } catch (e: any) {
        console.error('upsertGrupoSlot error:', e);
        throw new Error(e.message || 'Erro ao salvar grupo');
    }
}

export async function deleteGrupoSlot(id: number) {
    try {
        await nocoFetch(GRUPOS_SLOTS_TABLE_ID, '/records', {
            method: 'DELETE',
            body: JSON.stringify([{ id }]),
        });
        revalidatePath('/dashboard/menu');
        return { success: true };
    } catch (e: any) {
        throw new Error(e.message || 'Erro ao deletar grupo');
    }
}

// --- ITENS NO GRUPO ---

export async function getItensDoGrupoSlot(grupoId: number): Promise<number[]> {
    try {
        const res = await nocoFetch(
            GRUPOS_SLOTS_TABLE_ID,
            `/records?limit=1&where=(id,eq,${grupoId})`
        );
        const data = await res.json();
        console.log('[DEBUG getItensDoGrupoSlot] Response:', JSON.stringify(data.list?.[0]));
        const grupo = data.list?.[0];
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
        const res = await nocoFetch(
            GRUPOS_SLOTS_TABLE_ID,
            `/records?limit=1&where=(id,eq,${grupoId})`
        );
        const data = await res.json();
        const grupo = data.list?.[0];
        
        if (!grupo) throw new Error('Grupo não encontrado');
        
        console.log('[DEBUG addItemBaseAoGrupo] Grupo atual:', JSON.stringify(grupo));
        
        const itensAtuais = parseJsonArray(grupo.itens);
        
        if (itensAtuais.includes(itemId)) {
            return { success: true, alreadyExists: true };
        }
        
        const novosItens = [...itensAtuais, itemId];
        
        console.log('[DEBUG addItemBaseAoGrupo] Salvando itens:', JSON.stringify(novosItens));
        
        await nocoFetch(GRUPOS_SLOTS_TABLE_ID, '/records', {
            method: 'PATCH',
            body: JSON.stringify({ Id: grupoId, id: grupoId, itens: JSON.stringify(novosItens) }),
        });
        
        // Verificar se salvou
        const res2 = await nocoFetch(
            GRUPOS_SLOTS_TABLE_ID,
            `/records?limit=1&where=(id,eq,${grupoId})`
        );
        const data2 = await res2.json();
        console.log('[DEBUG addItemBaseAoGrupo] Depois de salvar:', JSON.stringify(data2.list?.[0]));
        
        revalidatePath('/dashboard/menu');
        return { success: true };
    } catch (e: any) {
        throw new Error(e.message || 'Erro ao adicionar item ao grupo');
    }
}

export async function removeItemBaseDoGrupo(grupoId: number, itemId: number) {
    try {
        const res = await nocoFetch(
            GRUPOS_SLOTS_TABLE_ID,
            `/records?limit=1&where=(id,eq,${grupoId})`
        );
        const data = await res.json();
        const grupo = data.list?.[0];
        
        if (!grupo) return { success: true };
        
        const itensAtuais = parseJsonArray(grupo.itens);
        const novosItens = itensAtuais.filter(id => id !== itemId);
        
        await nocoFetch(GRUPOS_SLOTS_TABLE_ID, '/records', {
            method: 'PATCH',
            body: JSON.stringify({ Id: grupoId, id: grupoId, itens: JSON.stringify(novosItens) }),
        });
        
        revalidatePath('/dashboard/menu');
        return { success: true };
    } catch (e: any) {
        throw new Error(e.message || 'Erro ao remover item do grupo');
    }
}

// --- VINCULAR GRUPOS A PRODUTOS ---

export async function getGruposDoProduto(produtoId: number): Promise<number[]> {
    try {
        const res = await nocoFetch(
            PRODUTOS_TABLE_ID,
            `/records?limit=1&where=(id,eq,${produtoId})`
        );
        const data = await res.json();
        const produto = data.list?.[0];
        return produto ? parseJsonArray(produto.grupos) : [];
    } catch (e) {
        console.error('getGruposDoProduto error:', e);
        return [];
    }
}

export async function updateGruposDoProduto(produtoId: number, grupoIds: number[]) {
    try {
        await nocoFetch(PRODUTOS_TABLE_ID, '/records', {
            method: 'PATCH',
            body: JSON.stringify({ 
                Id: produtoId, 
                id: produtoId,
                grupos: JSON.stringify(grupoIds) 
            }),
        });
        
        revalidatePath('/dashboard/menu');
        return { success: true };
    } catch (e) {
        console.error('updateGruposDoProduto error:', e);
        throw new Error('Erro ao atualizar grupos do produto');
    }
}

// --- PRODUTOS COMPOSTOS (GRUPOS DE SLOTS PARA O MODAL DE PEDIDOS) ---

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

export async function getCompositeProducts(): Promise<CompositeProduct[]> {
    try {
        const user = await getMe();
        if (!user?.empresaId) return [];

        // Buscar grupos de slots da empresa_id
        const gruposRes = await nocoFetch(
            GRUPOS_SLOTS_TABLE_ID,
            `/records?limit=1000&where=(empresa_id,eq,${user.empresaId})`
        );
        const gruposData = await gruposRes.json();
        const grupos = (gruposData.list || []).filter((g: any) => g.tipo === 'fracionado');

        if (grupos.length === 0) return [];

        // Buscar itens base da empresa_id
        const itensRes = await nocoFetch(
            ITENS_BASE_TABLE_ID,
            `/records?limit=2000&where=(empresa_id,eq,${user.empresaId})`
        );
        const itensData = await itensRes.json();
        const itensMap = new Map<number, any>();
        (itensData.list || []).forEach((item: any) => {
            itensMap.set(item.id, {
                id: item.id,
                nome: item.nome,
                preco_sugerido: Number(item.preco_sugerido || 0),
                preco_custo: Number(item.preco_custo || 0),
            });
        });

        // Montar produtos compostos
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
                items,
            };
        });
    } catch (e) {
        console.error('getCompositeProducts error:', e);
        return [];
    }
}

// Calcular estoque possível para produtos compostos
export async function getCompositeProductsStock(): Promise<{ grupoId: number; estoquePossivel: number }[]> {
    try {
        const user = await getMe();
        if (!user?.empresaId) return [];

        // Buscar grupos de slots da empresa_id
        const gruposRes = await nocoFetch(
            GRUPOS_SLOTS_TABLE_ID,
            `/records?limit=1000&where=(empresa_id,eq,${user.empresaId})`
        );
        const gruposData = await gruposRes.json();
        const grupos = (gruposData.list || []).filter((g: any) => g.tipo === 'fracionado');

        if (grupos.length === 0) return [];

        // Buscar itens base da empresa_id
        const itensRes = await nocoFetch(
            ITENS_BASE_TABLE_ID,
            `/records?limit=2000&where=(empresa_id,eq,${user.empresaId})`
        );
        const itensData = await itensRes.json();
        const itensMap = new Map<number, any>();
        (itensData.list || []).forEach((item: any) => {
            itensMap.set(item.id, item);
        });

        // Buscar insumos da empresa_id
        const insumos = await getInsumos();
        const insumosMap = new Map<number, number>();
        insumos.forEach((insumo: any) => {
            insumosMap.set(insumo.id, Number(insumo.quantidade_atual || 0));
        });

        // Para cada grupo, calcular estoque possível
        const results: { grupoId: number; estoquePossivel: number }[] = [];

        for (const grupo of grupos) {
            const itens = parseJsonArray(grupo.itens);
            if (itens.length === 0) {
                results.push({ grupoId: grupo.id, estoquePossivel: 0 });
                continue;
            }

            let estoqueMinimo = Infinity;

            // Para cada item base do grupo
            for (const itemId of itens) {
                const itemBase = itensMap.get(itemId);
                if (!itemBase) continue;

                // Buscar receita do item base
                const receita = await getReceitaDoItemBase(itemId);
                if (receita.length === 0) {
                    // Se não tem insumos, consideramos ilimitado (ou zero?)
                    continue;
                }

                // Calcular quantas unidades deste item base podem ser produzidas
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
                grupoId: grupo.id,
                estoquePossivel: estoqueMinimo === Infinity ? 0 : estoqueMinimo,
            });
        }

        return results;
    } catch (e) {
        console.error('getCompositeProductsStock error:', e);
        return [];
    }
}