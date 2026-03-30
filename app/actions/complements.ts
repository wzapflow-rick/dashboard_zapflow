'use server';

import { getMe } from './auth';
import { getReceitaDoProduto } from './insumos';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';

// Replace with actual Table IDs provided by the user
const GRUPOS_TABLE_ID = 'mqo0m1qpbxueoox';
const COMPLEMENTOS_TABLE_ID = 'mde9hhb5oho8dsv';
const P_GRUPOS_TABLE_ID = 'mm1zymth858by6q';
const C_INSUMO_TABLE_ID = 'mqmy3bdny8otkkt';

async function nocoFetch(tableId: string, endpoint: string, options: RequestInit = {}) {
    if (!tableId || tableId.startsWith('PLACEHOLDER')) {
        console.warn('NocoDB API call skipped: Table ID not configured');
        return { ok: true, json: async () => ({ list: [], id: Date.now() }) } as any; // Mock for development without table
    }

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

// --- GRUPOS DE COMPLEMENTOS ---
export async function getGruposComplementos() {
    try {
        const user = await getMe();
        if (!user?.empresaId) return [];

        if (GRUPOS_TABLE_ID.startsWith('PLACEHOLDER')) return [];

        // Removed sort parameter to prevent ERR_FIELD_NOT_FOUND
        const res = await nocoFetch(GRUPOS_TABLE_ID, `/records?where=(empresa_id,eq,${user.empresaId})`);
        const data = await res.json();
        return (data.list || []).map((g: any) => ({ ...g, id: g.Id || g.id }));
    } catch (e) {
        console.error('getGruposComplementos error:', e);
        return [];
    }
}

export async function upsertGrupoComplemento(grupo: any) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const isUpdate = !!grupo.id || !!grupo.Id;
        const method = isUpdate ? 'PATCH' : 'POST';

        const payload = {
            ...grupo,
            empresa_id: user.empresaId
        };
        // Normalize primary key if needed
        if (grupo.Id) {
            payload.id = grupo.Id;
            delete payload.Id;
        }

        const res = await nocoFetch(GRUPOS_TABLE_ID, '/records', {
            method,
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        return { ...payload, ...data, id: data.Id || data.id };
    } catch (e: any) {
        throw new Error(e.message || 'Erro ao salvar grupo');
    }
}

export async function deleteGrupoComplemento(id: number) {
    try {
        await nocoFetch(GRUPOS_TABLE_ID, '/records', {
            method: 'DELETE',
            body: JSON.stringify({ id }) // Uses lowercase `id` which is standard
        });
        return { success: true };
    } catch (e: any) {
        throw new Error(e.message || 'Erro ao deletar grupo');
    }
}

// --- ITENS DE COMPLEMENTOS ---
export async function getItensDoGrupo(grupoId: number) {
    try {
        if (COMPLEMENTOS_TABLE_ID.startsWith('PLACEHOLDER')) return [];
        // Removed sort parameter to prevent ERR_FIELD_NOT_FOUND
        const res = await nocoFetch(COMPLEMENTOS_TABLE_ID, `/records?where=(grupo_id,eq,${grupoId})`);
        const data = await res.json();
        return (data.list || []).map((i: any) => ({ ...i, id: i.Id || i.id }));
    } catch (e) {
        console.error('getItensDoGrupo error:', e);
        return [];
    }
}

export async function upsertItemComplemento(item: any) {
    try {
        const isUpdate = !!item.id || !!item.Id;
        const method = isUpdate ? 'PATCH' : 'POST';

        const payload = { ...item };
        // Normalize primary key if needed
        if (item.Id) {
            payload.id = item.Id;
            delete payload.Id;
        }

        const res = await nocoFetch(COMPLEMENTOS_TABLE_ID, '/records', {
            method,
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        return { ...payload, ...data, id: data.Id || data.id };
    } catch (e: any) {
        throw new Error(e.message || 'Erro ao salvar item do complemento');
    }
}

export async function deleteItemComplemento(id: number) {
    try {
        await nocoFetch(COMPLEMENTOS_TABLE_ID, '/records', {
            method: 'DELETE',
            body: JSON.stringify({ id })
        });
        return { success: true };
    } catch (e: any) {
        throw new Error(e.message || 'Erro ao deletar item do complemento');
    }
}

// --- VINCULAÇÃO DE GRUPOS A PRODUTOS ---
export async function getGruposDoProduto(produtoId: number) {
    try {
        const res = await nocoFetch(P_GRUPOS_TABLE_ID, `/records?where=(produto_id,eq,${produtoId})`);
        const data = await res.json();
        return (data.list || []).map((i: any) => ({ ...i, id: i.Id || i.id }));
    } catch (e) {
        console.error('getGruposDoProduto error:', e);
        return [];
    }
}

export async function updateGruposDoProduto(produtoId: number, grupoIds: number[]) {
    try {
        const atuaisRes = await nocoFetch(P_GRUPOS_TABLE_ID, `/records?where=(produto_id,eq,${produtoId})`);
        const atuaisData = await atuaisRes.json();
        const atuaisList = atuaisData.list || [];

        const atuaisMap = new Map<number, number>(atuaisList.map((g: any) => [Number(g.grupo_id), g.Id || g.id]));
        const setNovos = new Set(grupoIds);

        for (const [grupo_id, recordId] of atuaisMap.entries()) {
            if (!setNovos.has(grupo_id)) {
                await nocoFetch(P_GRUPOS_TABLE_ID, '/records', {
                    method: 'DELETE',
                    body: JSON.stringify({ id: recordId })
                });
            }
        }

        for (const grupo_id of grupoIds) {
            if (!atuaisMap.has(grupo_id)) {
                await nocoFetch(P_GRUPOS_TABLE_ID, '/records', {
                    method: 'POST',
                    body: JSON.stringify({ produto_id: produtoId, grupo_id })
                });
            }
        }

        return { success: true };
    } catch (e) {
        console.error('updateGruposDoProduto error:', e);
        throw new Error('Erro ao atualizar grupos do produto');
    }
}

// --- FICHA TÉCNICA DO COMPLEMENTO (COMPLEMENTO_INSUMO) ---
export async function getReceitaDoComplemento(complementoId: number) {
    try {
        if (C_INSUMO_TABLE_ID.startsWith('PLACEHOLDER')) return [];
        const res = await nocoFetch(C_INSUMO_TABLE_ID, `/records?where=(complemento_id,eq,${complementoId})`);
        const data = await res.json();
        return data.list || [];
    } catch (e) {
        console.error('getReceitaDoComplemento error:', e);
        return [];
    }
}

export async function saveReceitaDoComplemento(complementoId: number, insumosList: { insumo_id: number, quantidade_necessaria: number }[]) {
    try {
        if (C_INSUMO_TABLE_ID.startsWith('PLACEHOLDER')) return { success: false };

        // 1. Deletar atual
        const existingRes = await nocoFetch(C_INSUMO_TABLE_ID, `/records?where=(complemento_id,eq,${complementoId})`);
        const existingData = await existingRes.json();
        if (existingData.list?.length > 0) {
            for (const r of existingData.list) {
                await nocoFetch(C_INSUMO_TABLE_ID, '/records', {
                    method: 'DELETE',
                    body: JSON.stringify({ id: r.Id || r.id })
                });
            }
        }

        // 2. Inserir novos
        if (insumosList.length > 0) {
            const records = insumosList.map(item => ({
                complemento_id: complementoId,
                insumo_id: item.insumo_id,
                quantidade_necessaria: item.quantidade_necessaria
            }));
            await nocoFetch(C_INSUMO_TABLE_ID, '/records', {
                method: 'POST',
                body: JSON.stringify(records)
            });
        }
        return { success: true };
    } catch (e) {
        console.error('saveReceitaDoComplemento error:', e);
        throw e;
    }
}

// --- CADASTRO EM MASSA (PRODUTOS -> COMPLEMENTOS) ---
export async function bulkCreateComplements(grupoId: number, products: any[]) {
    try {
        for (const product of products) {
            // 1. Criar o complemento
            const payload = {
                grupo_id: grupoId,
                nome: product.nome,
                preco: product.preco,
                descricao: product.descricao || '',
                status: true
            };
            const resComp = await nocoFetch(COMPLEMENTOS_TABLE_ID, '/records', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const compData = await resComp.json();
            const compId = compData.id || compData.Id;

            // 2. Buscar receita do produto original
            const receitaProduto = await getReceitaDoProduto(product.id);
            if (receitaProduto && receitaProduto.length > 0) {
                // 3. Vincular receita ao novo complemento
                await saveReceitaDoComplemento(compId, receitaProduto.map((r: any) => ({
                    insumo_id: r.insumo_id,
                    quantidade_necessaria: r.quantidade_necessaria
                })));
            }
        }
        return { success: true };
    } catch (e) {
        console.error('bulkCreateComplements error:', e);
        throw e;
    }
}

