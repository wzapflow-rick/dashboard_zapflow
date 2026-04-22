'use server';

import { getMe } from '@/lib/session-server';
import { getReceitaDoProduto } from './insumos';
import { noco } from '@/lib/nocodb';
import {
  GRUPOS_COMPLEMENTOS_TABLE_ID,
  COMPLEMENTOS_TABLE_ID,
  PRODUTO_GRUPOS_COMPLEMENTOS_TABLE_ID,
  PRODUTO_INSUMOS_TABLE_ID,
} from '@/lib/constants';

// --- GRUPOS DE COMPLEMENTOS ---

export async function getGruposComplementos() {
    try {
        const user = await getMe();
        if (!user?.empresaId) return [];

        const data = await noco.list(GRUPOS_COMPLEMENTOS_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})`,
        });
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

        const payload: any = {
            ...grupo,
            empresa_id: user.empresaId
        };

        // Normalizar chave primária
        if (payload.Id) {
            payload.id = payload.Id;
            delete payload.Id;
        }

        let data;
        if (payload.id) {
            data = await noco.update(GRUPOS_COMPLEMENTOS_TABLE_ID, payload);
        } else {
            data = await noco.create(GRUPOS_COMPLEMENTOS_TABLE_ID, payload);
        }

        return { ...payload, ...data, id: (data as any).Id || (data as any).id };
    } catch (e: any) {
        throw new Error(e.message || 'Erro ao salvar grupo');
    }
}

export async function deleteGrupoComplemento(id: number) {
    try {
        await noco.delete(GRUPOS_COMPLEMENTOS_TABLE_ID, id);
        return { success: true };
    } catch (e: any) {
        throw new Error(e.message || 'Erro ao deletar grupo');
    }
}

// --- ITENS DE COMPLEMENTOS ---

export async function getItensDoGrupo(grupoId: number) {
    try {
        const data = await noco.list(COMPLEMENTOS_TABLE_ID, {
            where: `(grupo_id,eq,${grupoId})`,
        });
        return (data.list || []).map((i: any) => ({ ...i, id: i.Id || i.id }));
    } catch (e) {
        console.error('getItensDoGrupo error:', e);
        return [];
    }
}

export async function upsertItemComplemento(item: any) {
    try {
        const payload: any = { ...item };

        if (payload.Id) {
            payload.id = payload.Id;
            delete payload.Id;
        }

        let data;
        if (payload.id) {
            data = await noco.update(COMPLEMENTOS_TABLE_ID, payload);
        } else {
            data = await noco.create(COMPLEMENTOS_TABLE_ID, payload);
        }

        return { ...payload, ...data, id: (data as any).Id || (data as any).id };
    } catch (e: any) {
        throw new Error(e.message || 'Erro ao salvar item do complemento');
    }
}

export async function deleteItemComplemento(id: number) {
    try {
        await noco.delete(COMPLEMENTOS_TABLE_ID, id);
        return { success: true };
    } catch (e: any) {
        throw new Error(e.message || 'Erro ao deletar item do complemento');
    }
}

// --- VINCULAÇÃO DE GRUPOS A PRODUTOS ---

export async function getGruposDoProduto(produtoId: number) {
    try {
        const data = await noco.list(PRODUTO_GRUPOS_COMPLEMENTOS_TABLE_ID, {
            where: `(produto_id,eq,${produtoId})`,
        });
        return (data.list || []).map((i: any) => ({ ...i, id: i.Id || i.id }));
    } catch (e) {
        console.error('getGruposDoProduto error:', e);
        return [];
    }
}

export async function updateGruposDoProduto(produtoId: number, grupoIds: number[]) {
    try {
        const atuaisData = await noco.list(PRODUTO_GRUPOS_COMPLEMENTOS_TABLE_ID, {
            where: `(produto_id,eq,${produtoId})`,
        });
        const atuaisList = atuaisData.list || [];

        const atuaisMap = new Map<number, number>(
            atuaisList.map((g: any) => [Number(g.grupo_id), g.Id || g.id])
        );
        const setNovos = new Set(grupoIds);

        for (const [grupo_id, recordId] of atuaisMap.entries()) {
            if (!setNovos.has(grupo_id)) {
                await noco.delete(PRODUTO_GRUPOS_COMPLEMENTOS_TABLE_ID, recordId);
            }
        }

        for (const grupo_id of grupoIds) {
            if (!atuaisMap.has(grupo_id)) {
                await noco.create(PRODUTO_GRUPOS_COMPLEMENTOS_TABLE_ID, { produto_id: produtoId, grupo_id });
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
        const data = await noco.list(PRODUTO_INSUMOS_TABLE_ID, {
            where: `(complemento_id,eq,${complementoId})`,
        });
        return data.list || [];
    } catch (e) {
        console.error('getReceitaDoComplemento error:', e);
        return [];
    }
}

export async function saveReceitaDoComplemento(complementoId: number, insumosList: { insumo_id: number, quantidade_necessaria: number }[]) {
    try {
        // Deletar receita atual
        const existingData = await noco.list(PRODUTO_INSUMOS_TABLE_ID, {
            where: `(complemento_id,eq,${complementoId})`,
        });
        if (existingData.list?.length > 0) {
            for (const r of existingData.list) {
                await noco.delete(PRODUTO_INSUMOS_TABLE_ID, (r as any).Id || (r as any).id);
            }
        }

        // Inserir novos
        if (insumosList.length > 0) {
            for (const item of insumosList) {
                await noco.create(PRODUTO_INSUMOS_TABLE_ID, {
                    complemento_id: complementoId,
                    insumo_id: item.insumo_id,
                    quantidade_necessaria: item.quantidade_necessaria
                });
            }
        }
        return { success: true };
    } catch (e) {
        console.error('saveReceitaDoComplemento error:', e);
        throw e;
    }
}

// --- CADASTRO EM MASSA (PRODUTOS -> COMPLEMENTOS) ---

export async function bulkCreateComplements(grupoId: number, products: any[], fator: number = 1) {
    try {
        for (const product of products) {
            const payload = {
                grupo_id: grupoId,
                nome: product.nome,
                preco: product.preco,
                descricao: product.descricao || '',
                fator_proporcao: fator,
                status: true
            };

            const compData = await noco.create(COMPLEMENTOS_TABLE_ID, payload) as any;
            const compId = compData.id || compData.Id;

            const receitaProduto = await getReceitaDoProduto(product.id);
            if (receitaProduto && receitaProduto.length > 0) {
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

// --- INSUMOS FIXOS DO GRUPO ---

export async function getInsumosDoGrupo(grupoId: number) {
    try {
        const data = await noco.list(PRODUTO_INSUMOS_TABLE_ID, {
            where: `(grupo_id,eq,${grupoId})`,
        });
        return (data.list || []).map((i: any) => ({ ...i, id: i.Id || i.id }));
    } catch (e) {
        console.error('getInsumosDoGrupo error:', e);
        return [];
    }
}

export async function saveInsumosDoGrupo(grupoId: number, insumosList: { insumo_id: number, quantidade_necessaria: number }[]) {
    try {
        // Deletar registros atuais
        const existingData = await noco.list(PRODUTO_INSUMOS_TABLE_ID, {
            where: `(grupo_id,eq,${grupoId})`,
        });
        if (existingData.list?.length > 0) {
            for (const r of existingData.list) {
                await noco.delete(PRODUTO_INSUMOS_TABLE_ID, (r as any).Id || (r as any).id);
            }
        }

        // Inserir novos
        if (insumosList.length > 0) {
            for (const item of insumosList) {
                await noco.create(PRODUTO_INSUMOS_TABLE_ID, {
                    grupo_id: grupoId,
                    insumo_id: item.insumo_id,
                    quantidade_necessaria: item.quantidade_necessaria
                });
            }
        }
        return { success: true };
    } catch (e) {
        console.error('saveInsumosDoGrupo error:', e);
        throw e;
    }
}
