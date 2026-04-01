'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from './auth';
import { getInsumos } from './insumos';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';

const ITENS_BASE_TABLE_ID = 'micgsgj6jtr8i8m';
const ITEM_BASE_INSUMO_TABLE_ID = 'mlfza849t9slguc';

export interface ItemBase {
    id: number;
    nome: string;
    preco_sugerido: number;
    preco_custo: number;
    empresa: number;
}

export interface ItemBaseInsumo {
    id: number;
    item: number;
    insumo: number;
    quantidade: number;
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
        throw new Error(`NocoDB API Error: ${res.status} - ${text}`);
    }

    return res;
}

// --- ITENS BASE (BIBLIOTECA DE SABORES) ---

export async function getItensBase(): Promise<ItemBase[]> {
    try {
        const user = await getMe();
        if (!user?.empresaId) return [];

        const res = await nocoFetch(
            ITENS_BASE_TABLE_ID,
            `/records?limit=1000&where=(empresa,eq,${user.empresaId})&sort=nome`
        );
        const data = await res.json();
        // Em tabelas com UUID PK, o 'id' retornado pelo NocoDB v2 já é o UUID.
        return (data.list || []).map((i: any) => ({
            ...i,
            id: i.id // O campo 'id' (minúsculo) é o UUID.
        }));
    } catch (e) {
        console.error('getItensBase error:', e);
        return [];
    }
}

export async function upsertItemBase(itemData: Partial<ItemBase>) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const isUpdate = !!itemData.id;
        const payload: any = {
            ...itemData,
            empresa: user.empresaId,
        };

        // Remove campos de sistema e IDs internos para evitar conflitos de tipo UUID
        delete payload.Id;
        delete payload.created_at;
        delete payload.updated_at;

        if (isUpdate) {
            const res = await nocoFetch(ITENS_BASE_TABLE_ID, '/records', {
                method: 'PATCH',
                body: JSON.stringify({ ...payload, id: itemData.id }),
            });
            const data = await res.json();
            revalidatePath('/dashboard/menu');
            return { ...itemData, ...data };
        } else {
            const res = await nocoFetch(ITENS_BASE_TABLE_ID, '/records', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            revalidatePath('/dashboard/menu');
            return { ...payload, ...data };
        }
    } catch (e: any) {
        console.error('upsertItemBase error:', e);
        throw new Error(e.message || 'Erro ao salvar item base');
    }
}

export async function deleteItemBase(id: number) {
    try {
        await nocoFetch(ITENS_BASE_TABLE_ID, '/records', {
            method: 'DELETE',
            body: JSON.stringify([{ id: id }]),
        });
        revalidatePath('/dashboard/menu');
        return { success: true };
    } catch (e: any) {
        console.error('deleteItemBase error:', e);
        throw new Error(e.message || 'Erro ao deletar item base');
    }
}

// --- FICHA TÉCNICA DO ITEM BASE (item_base_insumo) ---

export async function getReceitaDoItemBase(itemBaseId: number): Promise<ItemBaseInsumo[]> {
    try {
        const user = await getMe();
        if (!user?.empresaId) return [];
        
        const res = await nocoFetch(
            ITEM_BASE_INSUMO_TABLE_ID,
            `/records?limit=1000&where=(item,eq,${itemBaseId})~and(empresa,eq,${user.empresaId})`
        );
        const data = await res.json();
        return (data.list || []).map((i: any) => ({ 
            id: i.id, 
            item: i.item,
            insumo: i.insumo,
            quantidade: i.quantidade 
        }));
    } catch (e) {
        console.error('getReceitaDoItemBase error:', e);
        return [];
    }
}

export async function saveReceitaDoItemBase(
    itemBaseId: number,
    insumosList: { insumo: number; quantidade: number }[]
) {
    try {
        const existingRes = await nocoFetch(
            ITEM_BASE_INSUMO_TABLE_ID,
            `/records?limit=1000&where=(item,eq,${itemBaseId})`
        );
        const existingData = await existingRes.json();

        if (existingData.list?.length > 0) {
            const idsToDelete = existingData.list.map((r: any) => ({ id: r.id }));
            await nocoFetch(ITEM_BASE_INSUMO_TABLE_ID, '/records', {
                method: 'DELETE',
                body: JSON.stringify(idsToDelete),
            });
        }

        if (insumosList.length > 0) {
            // Obter empresa do usuário
            const user = await getMe();
            if (!user?.empresaId) throw new Error('Usuário não autorizado');
            
            const records = insumosList.map(item => ({
                item: Number(itemBaseId),
                insumo: Number(item.insumo),
                quantidade: parseFloat(Number(item.quantidade || 1).toFixed(3)),
                empresa: user.empresaId,
            }));
            console.log('Inserindo registros na tabela item_base_insumo:', JSON.stringify(records, null, 2));
            
            await nocoFetch(ITEM_BASE_INSUMO_TABLE_ID, '/records', {
                method: 'POST',
                body: JSON.stringify(records),
            });
        }

        revalidatePath('/dashboard/menu');
        
        // Recalcular preço de custo do item base
        await recalcularPrecoCustoItemBase(itemBaseId);
        
        return { success: true };
    } catch (e: any) {
        console.error('saveReceitaDoItemBase error:', e);
        throw new Error(e.message || 'Erro ao salvar receita do item base');
    }
}

// Recalcular preço de custo do item base com base nos insumos vinculados
async function recalcularPrecoCustoItemBase(itemBaseId: number | string): Promise<void> {
    const id = Number(itemBaseId);
    if (isNaN(id)) return;
    try {
        // 1. Buscar a receita do item base
        const receitaRes = await nocoFetch(
            ITEM_BASE_INSUMO_TABLE_ID,
            `/records?limit=1000&where=(item,eq,${itemBaseId})`
        );
        const receitaData = await receitaRes.json();
        const receita = receitaData.list || [];

        if (receita.length === 0) {
            // Se não há insumos, zera o preço de custo
            await atualizarPrecoCustoItemBase(id, 0);
            return;
        }

        // 2. Buscar insumos da empresa para obter custo_por_unidade
        const user = await getMe();
        if (!user?.empresaId) return;
        
        const insumos = await getInsumos();
        const insumosMap = new Map<number, number>();
        insumos.forEach((insumo: any) => {
            insumosMap.set(insumo.id, Number(insumo.custo_por_unidade || 0));
        });

        // 3. Calcular custo total
        let custoTotal = 0;
        receita.forEach((item: any) => {
            const custoInsumo = insumosMap.get(item.insumo) || 0;
            custoTotal += custoInsumo * Number(item.quantidade || 0);
        });

        // 4. Atualizar preço de custo do item base
        await atualizarPrecoCustoItemBase(id, custoTotal);
    } catch (error) {
        console.error('Erro ao recalcular preço de custo do item base:', error);
        // Não lança erro para não interromper o fluxo
    }
}

async function atualizarPrecoCustoItemBase(itemBaseId: number, custo: number): Promise<void> {
    try {
        await nocoFetch(ITENS_BASE_TABLE_ID, '/records', {
            method: 'PATCH',
            body: JSON.stringify({ id: itemBaseId, preco_custo: custo }),
        });
        revalidatePath('/dashboard/menu');
    } catch (error) {
        console.error('Erro ao atualizar preço de custo do item base:', error);
    }
}
