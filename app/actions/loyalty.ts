'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from '@/lib/session-server';
import { LoyaltyConfigSchema, LoyaltyRedeemSchema, User } from '@/lib/validations';
import { logAction } from '@/lib/audit';
import { noco } from '@/lib/nocodb';
import { LOYALTY_CONFIG_TABLE_ID, LOYALTY_POINTS_TABLE_ID } from '@/lib/constants';

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

        const result = await noco.findOne(LOYALTY_POINTS_TABLE_ID, {
            where: `(cliente_telefone,eq,${telefone})~and(empresa_id,eq,${user.empresaId})`,
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

        const result = await noco.findOne(LOYALTY_CONFIG_TABLE_ID, {
            where: `(empresa_id,eq,${targetEmpresaId})`,
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

        const existing = await noco.findOne(LOYALTY_CONFIG_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})`,
        }) as any;

        const payload = { ...validated.data, empresa_id: user.empresaId };

        if (existing) {
            await noco.update(LOYALTY_CONFIG_TABLE_ID, { id: existing.id, ...payload });
        } else {
            await noco.create(LOYALTY_CONFIG_TABLE_ID, payload);
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
        if (!user?.empresaId) return { error: 'Não autorizado' };

        const config = await getLoyaltyConfig(user.empresaId);
        if (!config || !config.ativo) return { error: 'Programa de fidelidade inativo' };

        const pontosGanhos = Math.floor(valorPedido * config.pontos_por_real);
        if (pontosGanhos <= 0) return { success: true, pontos: 0 };

        const existing = await noco.findOne(LOYALTY_POINTS_TABLE_ID, {
            where: `(cliente_telefone,eq,${telefone})~and(empresa_id,eq,${user.empresaId})`,
        }) as any;

        if (existing) {
            await noco.update(LOYALTY_POINTS_TABLE_ID, {
                id: existing.id,
                pontos_acumulados: (existing.pontos_acumulados || 0) + pontosGanhos,
                cliente_nome: nomeCliente || existing.cliente_nome
            });
        } else {
            await noco.create(LOYALTY_POINTS_TABLE_ID, {
                cliente_telefone: telefone,
                cliente_nome: nomeCliente || 'Cliente',
                pontos_acumulados: pontosGanhos,
                empresa_id: user.empresaId
            });
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

        const existing = await noco.findOne(LOYALTY_POINTS_TABLE_ID, {
            where: `(cliente_telefone,eq,${cliente_telefone})~and(empresa_id,eq,${user.empresaId})`,
        }) as any;

        if (!existing || (existing.pontos_acumulados || 0) < pontos_resgatar) {
            return { error: 'Pontos insuficientes' };
        }

        await noco.update(LOYALTY_POINTS_TABLE_ID, {
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

        const pointsData = await noco.list(LOYALTY_POINTS_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})`,
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

        const data = await noco.list(LOYALTY_POINTS_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})`,
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

        const existing = await noco.findOne(LOYALTY_POINTS_TABLE_ID, {
            where: `(cliente_telefone,eq,${telefone})~and(empresa_id,eq,${user.empresaId})`,
        }) as any;

        if (!existing) return { error: 'Cliente não encontrado' };

        const currentPoints = existing.pontos_acumulados || 0;
        const newPoints = Math.max(0, currentPoints - pontos);

        await noco.update(LOYALTY_POINTS_TABLE_ID, {
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
