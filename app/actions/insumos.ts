'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from './auth';
import { InsumoSchema } from '@/lib/validations';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const INSUMOS_TABLE_ID = 'ms8pm0uduxg98n8';
const PRODUTO_INSUMO_TABLE_ID = 'msu8wo28lo8esrc';

// SSL check should be enabled in production
if (process.env.NODE_ENV === 'development') {
    // process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export interface Insumo {
    id: number;
    nome: string;
    quantidade_atual: number;
    unidade_medida: string;
    estoque_minimo: number;
    custo_por_unidade: number;
    empresa_id: number | string;
}

export interface ProdutoInsumo {
    id: number;
    produto_id: number | string;
    insumo_id: number | string;
    quantidade_necessaria: number;
    // Joins
    nc_ms8p__insumos_id?: any;
}

export async function nocoFetch(endpoint: string, options: RequestInit = {}, tableId: string) {
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
        console.error(`NocoDB Error: ${res.status} ${text}`);
        throw new Error(`NocoDB API Error: ${res.status}`);
    }

    return res;
}

export async function getInsumos() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const res = await nocoFetch(`/records?limit=1000&where=(empresa_id,eq,${user.empresaId})&sort=-Id`, {}, INSUMOS_TABLE_ID);
        const data = await res.json();
        return (data.list || []).map((item: any) => ({ ...item, id: item.id || item.Id }));
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to fetch insumos');
    }
}

export async function upsertInsumo(insumoData: any) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        // Validação com Zod
        const validated = InsumoSchema.safeParse(insumoData);
        if (!validated.success) {
            const errorMsg = validated.error.issues.map((issue: any) => issue.message).join(', ');
            throw new Error(`Dados inválidos: ${errorMsg}`);
        }

        const payload = {
            ...validated.data,
            empresa_id: user.empresaId,
            empresas: user.empresaId
        };
        delete (payload as any).created_at;
        delete (payload as any).updated_at;

        let result;
        if (payload.id) {
            const updatePayload = { ...payload };
            delete updatePayload.empresa_id;

            const res = await nocoFetch('/records', {
                method: 'PATCH',
                body: JSON.stringify({ ...updatePayload, Id: payload.id, id: payload.id })
            }, INSUMOS_TABLE_ID);
            result = await res.json();
        } else {
            const res = await nocoFetch('/records', {
                method: 'POST',
                body: JSON.stringify(payload)
            }, INSUMOS_TABLE_ID);
            result = await res.json();
        }

        revalidatePath('/dashboard/insumos');
        revalidatePath('/dashboard/menu');
        return { ...insumoData, ...result };
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to save insumo');
    }
}

export async function deleteInsumo(id: number | string) {
    try {
        const numericId = Number(id);
        if (isNaN(numericId)) {
            throw new Error('ID inválido');
        }
        
        await nocoFetch('/records', {
            method: 'DELETE',
            body: JSON.stringify([{ Id: numericId }])
        }, INSUMOS_TABLE_ID);
        revalidatePath('/dashboard/insumos');
        revalidatePath('/dashboard/menu');
        return { success: true };
    } catch (error: any) {
        console.error('deleteInsumo Error:', error);
        throw new Error(error.message || 'Failed to delete insumo');
    }
}

// ==========================================
// RECEITAS (PRODUTO_INSUMO)
// ==========================================

export async function getReceitaDoProduto(produtoId: number | string) {
    try {
        // Nested query or simple query
        const res = await nocoFetch(`/records?limit=1000&where=(produto_id,eq,${produtoId})`, {}, PRODUTO_INSUMO_TABLE_ID);
        const data = await res.json();
        return (data.list || []).map((item: any) => ({ ...item, id: item.id || item.Id }));
    } catch (error) {
        console.error('API Error:', error);
        return [];
    }
}

export async function getTodasReceitas() {
    try {
        const res = await nocoFetch(`/records?limit=1000`, {}, PRODUTO_INSUMO_TABLE_ID);
        const data = await res.json();
        return (data.list || []).map((item: any) => ({ ...item, id: item.id || item.Id }));
    } catch (error) {
        console.error('API Error:', error);
        return [];
    }
}

export async function saveReceitaDoProduto(produtoId: number | string, insumosList: { insumo_id: number | string, quantidade_necessaria: number }[]) {
    try {
        // Primeiro, deleta a receita existente do produto para recriar
        const existingRes = await nocoFetch(`/records?limit=1000&where=(produto_id,eq,${produtoId})`, {}, PRODUTO_INSUMO_TABLE_ID);
        const existingData = await existingRes.json();

        if (existingData.list && existingData.list.length > 0) {
            const idsToDelete = existingData.list.map((r: any) => ({ Id: r.id, id: r.id }));
            await nocoFetch('/records', {
                method: 'DELETE',
                body: JSON.stringify(idsToDelete)
            }, PRODUTO_INSUMO_TABLE_ID);
        }

        // Agora, insere novos se houver
        if (insumosList.length > 0) {
            const recordsToInsert = insumosList.map(item => ({
                produto_id: produtoId,
                produtos: produtoId,
                insumo_id: item.insumo_id,
                insumos: item.insumo_id,
                quantidade_necessaria: item.quantidade_necessaria
            }));

            await nocoFetch('/records', {
                method: 'POST',
                body: JSON.stringify(recordsToInsert)
            }, PRODUTO_INSUMO_TABLE_ID);
        }

        revalidatePath('/dashboard/menu');
        return { success: true };
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to save product recipe');
    }
}

export async function atualizarEstoqueInsumo(id: number, quantidade_alterada: number) {
    try {
        // 1. Buscar valor atual
        const res = await nocoFetch(`/records/${id}`, {}, INSUMOS_TABLE_ID);
        const current = await res.json();

        const currentQty = Number(current.quantidade_atual || 0);
        const newQty = currentQty + quantidade_alterada;

        // 2. Atualizar
        await nocoFetch('/records', {
            method: 'PATCH',
            body: JSON.stringify({
                id: id,
                Id: id,
                quantidade_atual: newQty
            })
        }, INSUMOS_TABLE_ID);

        revalidatePath('/dashboard/insumos');
        return { success: true, newQuantity: newQty };
    } catch (error) {
        console.error('Erro ao atualizar estoque:', error);
        throw error;
    }
}

export async function setNovoEstoqueInsumo(id: number, nova_quantidade: number) {
    try {
        const numericId = Number(id);
        if (isNaN(numericId) || numericId <= 0) {
            throw new Error('ID do insumo inválido');
        }
        
        const numericQty = Number(nova_quantidade);
        if (isNaN(numericQty) || numericQty < 0) {
            throw new Error('Quantidade inválida');
        }
        
        await nocoFetch('/records', {
            method: 'PATCH',
            body: JSON.stringify({
                Id: numericId,
                quantidade_atual: numericQty
            })
        }, INSUMOS_TABLE_ID);

        revalidatePath('/dashboard/insumos');
        return { success: true, newQuantity: numericQty };
    } catch (error: any) {
        console.error('Erro ao definir novo estoque:', error);
        throw new Error(error.message || 'Erro ao atualizar estoque');
    }
}
