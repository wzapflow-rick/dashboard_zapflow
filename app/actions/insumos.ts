'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from '@/lib/session-server';
import { InsumoSchema } from '@/lib/validations';
import { pg } from '@/lib/postgres';
import { INSUMOS_TABLE, PRODUTO_INSUMOS_TABLE } from '@/lib/tables';

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
}

export async function getInsumos() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const data = await pg.list(INSUMOS_TABLE, {
            where: { empresa_id: user.empresaId },
            sort: '-id',
            limit: 1000,
        });
        return (data.list || []).map((item: any) => ({ ...item, id: item.id }));
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to fetch insumos');
    }
}

export async function upsertInsumo(insumoData: any) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const validated = InsumoSchema.safeParse(insumoData);
        if (!validated.success) {
            const errorMsg = validated.error.issues.map((issue: any) => issue.message).join(', ');
            throw new Error(`Dados inválidos: ${errorMsg}`);
        }

        const payload: any = {
            ...validated.data,
            empresa_id: user.empresaId
        };
        delete payload.created_at;
        delete payload.updated_at;

        let result;
        if (payload.id) {
            const { empresa_id, ...updatePayload } = payload;
            result = await pg.update(INSUMOS_TABLE, updatePayload);
        } else {
            delete payload.id;
            result = await pg.create(INSUMOS_TABLE, payload);
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

        await pg.delete(INSUMOS_TABLE, numericId);
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
        const data = await pg.list(PRODUTO_INSUMOS_TABLE, {
            where: { produto_id: produtoId },
            limit: 1000,
        });
        return (data.list || []).map((item: any) => ({ ...item, id: item.id }));
    } catch (error) {
        console.error('API Error:', error);
        return [];
    }
}

export async function getTodasReceitas() {
    try {
        const data = await pg.list(PRODUTO_INSUMOS_TABLE, { limit: 1000 });
        return (data.list || []).map((item: any) => ({ ...item, id: item.id }));
    } catch (error) {
        console.error('API Error:', error);
        return [];
    }
}

export async function saveReceitaDoProduto(produtoId: number | string, insumosList: { insumo_id: number | string, quantidade_necessaria: number }[]) {
    try {
        // Deletar receita existente para recriar
        const existingData = await pg.list(PRODUTO_INSUMOS_TABLE, {
            where: { produto_id: produtoId },
            limit: 1000,
        });

        if (existingData.list && existingData.list.length > 0) {
            for (const r of existingData.list) {
                await pg.delete(PRODUTO_INSUMOS_TABLE, (r as any).id);
            }
        }

        // Inserir novos registros
        if (insumosList.length > 0) {
            for (const item of insumosList) {
                await pg.create(PRODUTO_INSUMOS_TABLE, {
                    produto_id: produtoId,
                    produtos: produtoId,
                    insumo_id: item.insumo_id,
                    insumos: item.insumo_id,
                    quantidade_necessaria: item.quantidade_necessaria
                });
            }
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
        const current = await pg.findById(INSUMOS_TABLE, id) as any;

        const currentQty = Number(current?.quantidade_atual || 0);
        const newQty = currentQty + quantidade_alterada;

        await pg.update(INSUMOS_TABLE, {
            id,
            quantidade_atual: newQty
        });

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

        await pg.update(INSUMOS_TABLE, {
            id: numericId,
            quantidade_atual: numericQty
        });

        revalidatePath('/dashboard/insumos');
        return { success: true, newQuantity: numericQty };
    } catch (error: any) {
        console.error('Erro ao definir novo estoque:', error);
        throw new Error(error.message || 'Erro ao atualizar estoque');
    }
}
