'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from '@/lib/session-server';
import { getInsumos } from './insumos';
import { noco } from '@/lib/nocodb';
import { ITENS_BASE_TABLE_ID, ITEM_BASE_INSUMO_TABLE_ID } from '@/lib/constants';

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

// --- ITENS BASE (BIBLIOTECA DE SABORES) ---

export async function getItensBase(): Promise<ItemBase[]> {
    try {
        const user = await getMe();
        if (!user?.empresaId) return [];

        const data = await noco.list(ITENS_BASE_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})`,
            sort: 'nome',
            limit: 1000,
        });

        return (data.list || []).map((i: any) => ({
            ...i,
            id: Number(i.id)
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

        const payload: any = {
            ...itemData,
            empresa_id: user.empresaId,
        };

        delete payload.Id;
        delete payload.created_at;
        delete payload.updated_at;

        let data;
        if (itemData.id) {
            data = await noco.update(ITENS_BASE_TABLE_ID, { ...payload, id: itemData.id });
        } else {
            data = await noco.create(ITENS_BASE_TABLE_ID, payload);
            console.log('upsertItemBase response:', data);
        }

        revalidatePath('/dashboard/menu');
        return { ...itemData, ...(data as any) };
    } catch (e: any) {
        console.error('upsertItemBase error:', e);
        throw new Error(e.message || 'Erro ao salvar item base');
    }
}

export async function deleteItemBase(id: number) {
    try {
        await noco.delete(ITENS_BASE_TABLE_ID, id);
        revalidatePath('/dashboard/menu');
        return { success: true };
    } catch (e: any) {
        console.error('deleteItemBase error:', e);
        throw new Error(e.message || 'Erro ao deletar item base');
    }
}

// --- FICHA TÉCNICA DO ITEM BASE ---

export async function getReceitaDoItemBase(itemBaseId: number): Promise<ItemBaseInsumo[]> {
    try {
        const user = await getMe();
        if (!user?.empresaId) return [];

        const data = await noco.list(ITEM_BASE_INSUMO_TABLE_ID, {
            where: `(produto_id,eq,${itemBaseId})~and(empresa_id,eq,${user.empresaId})`,
            limit: 1000,
        });

   return (data.list || []).map((i: any) => ({
    id: Number(i.id),
    item: Number(i.produto_id),
    insumo: Number(i.insumo_id),
    quantidade: Number(i.quantidade_usada),
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
        const existingData = await noco.list(ITEM_BASE_INSUMO_TABLE_ID, {
            where: `(produto_id,eq,${itemBaseId})`,
            limit: 1000,
        });

        if (existingData.list?.length > 0) {
            for (const r of existingData.list) {
                await noco.delete(ITEM_BASE_INSUMO_TABLE_ID, (r as any).id);
            }
        }

        if (insumosList.length > 0) {
            const user = await getMe();
            if (!user?.empresaId) throw new Error('Usuário não autorizado');

            for (const item of insumosList) {
                await noco.create(ITEM_BASE_INSUMO_TABLE_ID, {
                    produto_id: Number(itemBaseId),
                    insumo_id: Number(item.insumo),
                    quantidade_usada: parseFloat(Number(item.quantidade || 1).toFixed(3)),
                    empresa_id: user.empresaId,
                });
            }
        }

        revalidatePath('/dashboard/menu');

        await recalcularPrecoCustoItemBase(itemBaseId);

        return { success: true };
    } catch (e: any) {
        console.error('saveReceitaDoItemBase error:', e);
        throw new Error(e.message || 'Erro ao salvar receita do item base');
    }
}

async function recalcularPrecoCustoItemBase(itemBaseId: number | string): Promise<void> {
    const id = Number(itemBaseId);
    if (isNaN(id)) return;
    try {
        const receitaData = await noco.list(ITEM_BASE_INSUMO_TABLE_ID, {
            where: `(item,eq,${itemBaseId})`,
            limit: 1000,
        });
        const receita = receitaData.list || [];

        if (receita.length === 0) {
            await atualizarPrecoCustoItemBase(id, 0);
            return;
        }

        const user = await getMe();
        if (!user?.empresaId) return;

        const insumos = await getInsumos();
        const insumosMap = new Map<number, number>();
        insumos.forEach((insumo: any) => {
            insumosMap.set(insumo.id, Number(insumo.custo_por_unidade || 0));
        });

        let custoTotal = 0;
        receita.forEach((item: any) => {
            const custoInsumo = insumosMap.get(item.insumo) || 0;
            custoTotal += custoInsumo * Number(item.quantidade || 0);
        });

        await atualizarPrecoCustoItemBase(id, custoTotal);
    } catch (error) {
        console.error('Erro ao recalcular preço de custo do item base:', error);
    }
}

async function atualizarPrecoCustoItemBase(itemBaseId: number, custo: number): Promise<void> {
    try {
        await noco.update(ITENS_BASE_TABLE_ID, { id: itemBaseId, preco_custo: custo });
        revalidatePath('/dashboard/menu');
    } catch (error) {
        console.error('Erro ao atualizar preço de custo do item base:', error);
    }
}
