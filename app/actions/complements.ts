'use server';

import { getMe } from '@/lib/session-server';
import { getReceitaDoProduto } from './insumos';
import { pg } from '@/lib/postgres';
import {
  GRUPOS_COMPLEMENTOS_TABLE,
  COMPLEMENTOS_TABLE,
  PRODUTO_GRUPOS_COMPLEMENTOS_TABLE,
  PRODUTO_INSUMOS_TABLE,
} from '@/lib/tables';

// --- GRUPOS DE COMPLEMENTOS ---

export async function getGruposComplementos() {
    try {
        const user = await getMe();
        if (!user?.empresaId) return [];

        const data = await pg.list(GRUPOS_COMPLEMENTOS_TABLE, {
            where: { empresa_id: user.empresaId },
        });
        return (data.list || []).map((g: any) => ({ ...g, id: g.id }));
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

        delete payload.Id;

        let data;
        if (payload.id) {
            data = await pg.update(GRUPOS_COMPLEMENTOS_TABLE, payload);
        } else {
            delete payload.id;
            data = await pg.create(GRUPOS_COMPLEMENTOS_TABLE, payload);
        }

        return { ...payload, ...data, id: (data as any).id };
    } catch (e: any) {
        throw new Error(e.message || 'Erro ao salvar grupo');
    }
}

export async function deleteGrupoComplemento(id: number) {
    try {
        await pg.delete(GRUPOS_COMPLEMENTOS_TABLE, id);
        return { success: true };
    } catch (e: any) {
        throw new Error(e.message || 'Erro ao deletar grupo');
    }
}

// --- ITENS DE COMPLEMENTOS ---

export async function getItensDoGrupo(grupoId: number) {
    try {
        const data = await pg.list(COMPLEMENTOS_TABLE, {
            where: { grupo_id: grupoId },
        });
        return (data.list || []).map((i: any) => ({ ...i, id: i.id }));
    } catch (e) {
        console.error('getItensDoGrupo error:', e);
        return [];
    }
}

export async function upsertItemComplemento(item: any) {
    try {
        const payload: any = { ...item };

        delete payload.Id;

        let data;
        if (payload.id) {
            data = await pg.update(COMPLEMENTOS_TABLE, payload);
        } else {
            delete payload.id;
            data = await pg.create(COMPLEMENTOS_TABLE, payload);
        }

        return { ...payload, ...data, id: (data as any).id };
    } catch (e: any) {
        throw new Error(e.message || 'Erro ao salvar item do complemento');
    }
}

export async function deleteItemComplemento(id: number) {
    try {
        await pg.delete(COMPLEMENTOS_TABLE, id);
        return { success: true };
    } catch (e: any) {
        throw new Error(e.message || 'Erro ao deletar item do complemento');
    }
}

// --- VINCULAÇÃO DE GRUPOS A PRODUTOS ---

export async function getGruposDoProduto(produtoId: number) {
    try {
        const data = await pg.list(PRODUTO_GRUPOS_COMPLEMENTOS_TABLE, {
            where: { produto_id: produtoId },
        });
        return (data.list || []).map((i: any) => ({ ...i, id: i.id }));
    } catch (e) {
        console.error('getGruposDoProduto error:', e);
        return [];
    }
}

export async function updateGruposDoProduto(produtoId: number, grupoIds: number[]) {
    try {
        const atuaisData = await pg.list(PRODUTO_GRUPOS_COMPLEMENTOS_TABLE, {
            where: { produto_id: produtoId },
        });
        const atuaisList = atuaisData.list || [];

        const atuaisMap = new Map<number, number>(
            atuaisList.map((g: any) => [Number(g.grupo_id), g.id])
        );
        const setNovos = new Set(grupoIds);

        for (const [grupo_id, recordId] of atuaisMap.entries()) {
            if (!setNovos.has(grupo_id)) {
                await pg.delete(PRODUTO_GRUPOS_COMPLEMENTOS_TABLE, recordId);
            }
        }

        for (const grupo_id of grupoIds) {
            if (!atuaisMap.has(grupo_id)) {
                await pg.create(PRODUTO_GRUPOS_COMPLEMENTOS_TABLE, { produto_id: produtoId, grupo_id });
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
        const data = await pg.list(PRODUTO_INSUMOS_TABLE, {
            where: { complemento_id: complementoId },
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
        const existingData = await pg.list(PRODUTO_INSUMOS_TABLE, {
            where: { complemento_id: complementoId },
        });
        if (existingData.list?.length > 0) {
            for (const r of existingData.list) {
                await pg.delete(PRODUTO_INSUMOS_TABLE, (r as any).id);
            }
        }

        // Inserir novos
        if (insumosList.length > 0) {
            for (const item of insumosList) {
                await pg.create(PRODUTO_INSUMOS_TABLE, {
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

            const compData = await pg.create(COMPLEMENTOS_TABLE, payload) as any;
            const compId = compData.id;

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
        const data = await pg.list(PRODUTO_INSUMOS_TABLE, {
            where: { grupo_id: grupoId },
        });
        return (data.list || []).map((i: any) => ({ ...i, id: i.id }));
    } catch (e) {
        console.error('getInsumosDoGrupo error:', e);
        return [];
    }
}

export async function saveInsumosDoGrupo(grupoId: number, insumosList: { insumo_id: number, quantidade_necessaria: number }[]) {
    try {
        // Deletar registros atuais
        const existingData = await pg.list(PRODUTO_INSUMOS_TABLE, {
            where: { grupo_id: grupoId },
        });
        if (existingData.list?.length > 0) {
            for (const r of existingData.list) {
                await pg.delete(PRODUTO_INSUMOS_TABLE, (r as any).id);
            }
        }

        // Inserir novos
        if (insumosList.length > 0) {
            for (const item of insumosList) {
                await pg.create(PRODUTO_INSUMOS_TABLE, {
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
