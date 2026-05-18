'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from '@/lib/session-server';
import { LoyaltyConfigSchema, LoyaltyRedeemSchema, User } from '@/lib/validations';
import { logAction } from '@/lib/audit';
import { pg } from '@/lib/postgres';
import { LOYALTY_CONFIG_TABLE, LOYALTY_POINTS_TABLE } from '@/lib/tables';

export interface LoyaltyConfig {
    id?: number | string;
    empresa_id: number | string;
    pontos_por_real: number;
    valor_ponto: number;
    pontos_para_desconto: number;
    desconto_tipo: 'percentual' | 'valor_fixo';
    desconto_valor: number;
    pontos_para_item_gratis?: number;
    ativo: boolean;
}

export interface ClientPoints {
    id?: number | string;
    cliente_telefone: string;
    cliente_nome?: string;
    pontos_acumulados: number;
    pontos_gastos?: number;
    total_gasto?: number;
}

// ==================== PONTOS DO CLIENTE ====================

export async function getClientPoints(telefone: string): Promise<ClientPoints | null> {
    try {
        const user = await getMe();
        if (!user?.empresaId) return null;

        const result = await pg.findOne(LOYALTY_POINTS_TABLE, {
            where: { cliente_telefone: telefone, empresa_id: user.empresaId },
        });

        if (result) {
            return result as unknown as ClientPoints;
        }
        return { cliente_telefone: telefone, pontos_acumulados: 0 };
    } catch (error) {
        console.error('getClientPoints error:', error);
        return null;
    }
}

// ==================== CONFIGURAÇÃO ====================

export async function getLoyaltyConfig(empresaId?: number): Promise<LoyaltyConfig | null> {
    try {
        let targetEmpresaId = empresaId;
        if (!targetEmpresaId) {
            const user = await getMe();
            targetEmpresaId = user?.empresaId;
        }
        if (!targetEmpresaId) return null;

        const result = await pg.findOne(LOYALTY_CONFIG_TABLE, {
            where: { empresa_id: targetEmpresaId },
        });

        if (result) return result as unknown as LoyaltyConfig;

        return {
            empresa_id: targetEmpresaId,
            pontos_por_real: 1,
            valor_ponto: 0.10,
            pontos_para_desconto: 100,
            desconto_tipo: 'valor_fixo',
            desconto_valor: 10,
            ativo: false,
        };
    } catch (error) {
        console.error('getLoyaltyConfig error:', error);
        return null;
    }
}

export async function saveLoyaltyConfig(configData: Partial<LoyaltyConfig>) {
    try {
        const user = await getMe();
        if (!user?.empresaId) return { error: 'Não autorizado' };

        const validated = LoyaltyConfigSchema.safeParse(configData);
        if (!validated.success) {
            return { error: 'Dados inválidos', details: validated.error.format() };
        }

        const existing = await pg.findOne(LOYALTY_CONFIG_TABLE, {
            where: { empresa_id: user.empresaId },
        }) as any;

        const payload = { ...validated.data, empresa_id: user.empresaId };

        if (existing) {
            await pg.update(LOYALTY_CONFIG_TABLE, { id: existing.id, ...payload });
        } else {
            await pg.create(LOYALTY_CONFIG_TABLE, payload);
        }

        await logAction('LOYALTY_CONFIG_UPDATE', `Configuração de fidelidade atualizada para empresa ${user.empresaId}`);
        revalidatePath('/dashboard/growth');
        return { success: true };
    } catch (error) {
        console.error('saveLoyaltyConfig error:', error);
        return { error: 'Erro ao salvar configuração' };
    }
}

// ==================== OPERAÇÕES ====================

export async function addPointsToClient(telefone: string, valorPedido: number, nomeCliente?: string) {
    try {
        const user = await getMe();
        if (!user?.empresaId) return { error: 'Nao autorizado' };

        const config = await getLoyaltyConfig(user.empresaId);
        if (!config || !config.ativo) {
            return { success: true, pontos: 0, skipped: true };
        }

        const pontosGanhos = Math.floor(valorPedido * config.pontos_por_real);
        if (pontosGanhos <= 0) return { success: true, pontos: 0 };

        try {
            const existing = await pg.findOne(LOYALTY_POINTS_TABLE, {
                where: { cliente_telefone: telefone, empresa_id: user.empresaId },
            }) as any;

            if (existing) {
                await pg.update(LOYALTY_POINTS_TABLE, {
                    id: existing.id,
                    pontos_acumulados: (existing.pontos_acumulados || 0) + pontosGanhos,
                });
            } else {
                await pg.create(LOYALTY_POINTS_TABLE, {
                    cliente_telefone: telefone,
                    pontos_acumulados: pontosGanhos,
                    empresa_id: user.empresaId
                });
            }
        } catch (dbError: any) {
            if (dbError.message?.includes('column does not exist') || 
                dbError.message?.includes('table') ||
                dbError.code === '42703' || 
                dbError.code === '42P01') {
                console.warn('[Loyalty] Tabela ou coluna nao existe, ignorando:', dbError.message);
                return { success: true, pontos: 0, skipped: true };
            }
            throw dbError;
        }

        await logAction('LOYALTY_POINTS_ADD', `Adicionados ${pontosGanhos} pontos ao cliente ${telefone} (valor: R$ ${valorPedido.toFixed(2)})`);
        return { success: true, pontos: pontosGanhos };
    } catch (error) {
        console.error('addPointsToClient error:', error);
        return { error: 'Erro ao adicionar pontos' };
    }
}

export async function redeemPoints(data: { cliente_telefone: string, pontos_resgatar: number }) {
    try {
        const user = await getMe();
        if (!user?.empresaId) return { error: 'Não autorizado' };

        const validated = LoyaltyRedeemSchema.safeParse(data);
        if (!validated.success) return { error: 'Dados inválidos' };

        const { cliente_telefone, pontos_resgatar } = validated.data;

        const existing = await pg.findOne(LOYALTY_POINTS_TABLE, {
            where: { cliente_telefone, empresa_id: user.empresaId },
        }) as any;

        if (!existing || (existing.pontos_acumulados || 0) < pontos_resgatar) {
            return { error: 'Pontos insuficientes' };
        }

        await pg.update(LOYALTY_POINTS_TABLE, {
            id: existing.id,
            pontos_acumulados: existing.pontos_acumulados - pontos_resgatar
        });

        await logAction('LOYALTY_POINTS_REDEEM', `Resgatados ${pontos_resgatar} pontos do cliente ${cliente_telefone}`);
        return { success: true };
    } catch (error) {
        console.error('redeemPoints error:', error);
        return { error: 'Erro ao resgatar pontos' };
    }
}

// ==================== ESTATÍSTICAS ====================

export async function getLoyaltyStats() {
    try {
        const user = await getMe();
        if (!user?.empresaId) return null;

        const config = await getLoyaltyConfig(user.empresaId);

        const pointsData = await pg.list(LOYALTY_POINTS_TABLE, {
            where: { empresa_id: user.empresaId },
            sort: '-pontos_acumulados',
            limit: 100,
        });
        const clients = pointsData.list || [];

        const totalPontosAcumulados = clients.reduce((sum: number, c: any) => sum + (c.pontos_acumulados || 0), 0);
        const totalPontosResgatados = clients.reduce((sum: number, c: any) => sum + (c.pontos_gastos || 0), 0);

        return {
            totalClientes: clients.length,
            totalPontosAcumulados,
            totalPontosResgatados,
            pontosAtivos: totalPontosAcumulados - totalPontosResgatados,
            topClients: clients.slice(0, 5).map((c: any) => ({
                id: c.id,
                cliente_nome: c.cliente_nome || 'Cliente',
                cliente_telefone: c.cliente_telefone,
                pontos_acumulados: c.pontos_acumulados || 0,
                pontos_gastos: c.pontos_gastos || 0,
                total_gasto: c.total_gasto || 0
            }))
        };
    } catch (error) {
        console.error('getLoyaltyStats error:', error);
        return null;
    }
}

export async function getAllClientsPoints(): Promise<ClientPoints[]> {
    try {
        const user = await getMe();
        if (!user?.empresaId) return [];

        const data = await pg.list(LOYALTY_POINTS_TABLE, {
            where: { empresa_id: user.empresaId },
            sort: '-pontos_acumulados',
            limit: 1000,
        });
        return (data.list || []) as unknown as ClientPoints[];
    } catch (error) {
        console.error('getAllClientsPoints error:', error);
        return [];
    }
}

export async function calculatePointsValue(points: number): Promise<number> {
    try {
        const user = await getMe();
        if (!user?.empresaId) return 0;

        const config = await getLoyaltyConfig(user.empresaId);
        if (!config) return 0;

        return points * (config.valor_ponto || 0);
    } catch (error) {
        console.error('calculatePointsValue error:', error);
        return 0;
    }
}

// ==================== INTEGRAÇÃO COM PEDIDOS ====================

export async function addPointsForOrder(telefone: string, nomeCliente: string, valorPedido: number) {
    return await addPointsToClient(telefone, valorPedido, nomeCliente);
}

export async function deductPointsForOrder(telefone: string, pontos: number) {
    try {
        const user = await getMe();
        if (!user?.empresaId) return { error: 'Não autorizado' };

        const existing = await pg.findOne(LOYALTY_POINTS_TABLE, {
            where: { cliente_telefone: telefone, empresa_id: user.empresaId },
        }) as any;

        if (!existing) return { error: 'Cliente não encontrado' };

        const currentPoints = existing.pontos_acumulados || 0;
        const newPoints = Math.max(0, currentPoints - pontos);

        await pg.update(LOYALTY_POINTS_TABLE, {
            id: existing.id,
            pontos_acumulados: newPoints
        });

        await logAction('LOYALTY_POINTS_DEDUCT', `Deduzidos ${pontos} pontos do cliente ${telefone}`);
        return { success: true, newPoints };
    } catch (error) {
        console.error('deductPointsForOrder error:', error);
        return { error: 'Erro ao deduzir pontos' };
    }
}
