'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from './auth';
import { LoyaltyConfigSchema, LoyaltyRedeemSchema } from '@/lib/validations';
import { logAction } from '@/lib/audit';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const LOYALTY_CONFIG_TABLE_ID = 'mjzzdfgdohupgjh'; // Configuração do programa
const LOYALTY_POINTS_TABLE_ID = 'm8slxvm3dp4sup4'; // Pontos dos clientes

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
        console.error(`NocoDB Error (Loyalty): ${res.status} ${text}`);
        throw new Error(`NocoDB API Error: ${res.status}`);
    }

    return res;
}

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
    pontos_gastos: number;
    total_gasto: number;
    ultima_atualizacao: string;
    empresa_id: number | string;
}

export interface PointsHistory {
    id?: number | string;
    cliente_telefone: string;
    tipo: 'ganho' | 'resgate' | 'expirado' | 'ajuste';
    pontos: number;
    descricao: string;
    pedido_id?: number | string;
    data: string;
    empresa_id: number | string;
}

// ==================== CONFIGURAÇÃO ====================

// Buscar configuração do programa de fidelidade
export async function getLoyaltyConfig(): Promise<LoyaltyConfig | null> {
    try {
        const user = await getMe();
        if (!user?.empresaId) return null;

        const res = await nocoFetch(LOYALTY_CONFIG_TABLE_ID, `/records?where=(empresa_id,eq,${user.empresaId})`);
        const data = await res.json();
        
        if (data.list && data.list.length > 0) {
            return data.list[0];
        }
        
        // Retornar configuração padrão se não existir
        return {
            empresa_id: user.empresaId,
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

// Salvar configuração do programa
export async function saveLoyaltyConfig(configData: Partial<LoyaltyConfig>) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        // Validação com Zod
        const validated = LoyaltyConfigSchema.safeParse(configData);
        if (!validated.success) {
            const errorMsg = validated.error.issues.map((issue: any) => issue.message).join(', ');
            throw new Error(`Dados inválidos: ${errorMsg}`);
        }

        // Verificar se já existe configuração
        const checkRes = await nocoFetch(LOYALTY_CONFIG_TABLE_ID, `/records?where=(empresa_id,eq,${user.empresaId})`);
        const checkData = await checkRes.json();
        const existingConfig = checkData.list?.[0];

        const payload = {
            ...validated.data,
            empresa_id: user.empresaId,
        };

        let result;
        if (existingConfig?.id) {
            const res = await nocoFetch(LOYALTY_CONFIG_TABLE_ID, '/records', {
                method: 'PATCH',
                body: JSON.stringify({ ...payload, id: existingConfig.id }),
            });
            result = await res.json();
        } else {
            const res = await nocoFetch(LOYALTY_CONFIG_TABLE_ID, '/records', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            result = await res.json();
        }

        await logAction('UPDATE_LOYALTY_CONFIG', 'Configuração de fidelidade atualizada');
        revalidatePath('/dashboard/settings');
        return { success: true, data: result };
    } catch (error: any) {
        console.error('saveLoyaltyConfig error:', error);
        throw new Error(error.message || 'Erro ao salvar configuração');
    }
}

// ==================== PONTOS DO CLIENTE ====================

// Buscar pontos de um cliente por telefone
export async function getClientPoints(telefone: string): Promise<ClientPoints | null> {
    try {
        const user = await getMe();
        if (!user?.empresaId) return null;

        const res = await nocoFetch(LOYALTY_POINTS_TABLE_ID, 
            `/records?where=(empresa_id,eq,${user.empresaId})~and(cliente_telefone,eq,${telefone})`);
        const data = await res.json();
        
        return data.list?.[0] || null;
    } catch (error) {
        console.error('getClientPoints error:', error);
        return null;
    }
}

// Buscar pontos de todos os clientes (para dashboard)
export async function getAllClientsPoints(): Promise<ClientPoints[]> {
    try {
        const user = await getMe();
        if (!user?.empresaId) return [];

        const res = await nocoFetch(LOYALTY_POINTS_TABLE_ID, 
            `/records?limit=1000&where=(empresa_id,eq,${user.empresaId})&sort=-pontos_acumulados`);
        const data = await res.json();
        
        return (data.list || []).map((c: any) => ({ ...c, id: c.id || c.Id }));
    } catch (error) {
        console.error('getAllClientsPoints error:', error);
        return [];
    }
}

// Adicionar pontos após pedido
export async function addPointsForOrder(
    telefone: string, 
    nomeCliente: string, 
    valorPedido: number, 
    pedidoId: number | string
) {
    try {
        const user = await getMe();
        if (!user?.empresaId) return;

        // Buscar configuração
        const config = await getLoyaltyConfig();
        if (!config || !config.ativo) return;

        // Calcular pontos ganhos
        const pontosGanhos = Math.floor(valorPedido * config.pontos_por_real);
        if (pontosGanhos <= 0) return;

        // Buscar ou criar registro do cliente
        let clientPoints = await getClientPoints(telefone);
        
        if (clientPoints?.id) {
            // Atualizar pontos existentes
            await nocoFetch(LOYALTY_POINTS_TABLE_ID, '/records', {
                method: 'PATCH',
                body: JSON.stringify({
                    id: clientPoints.id,
                    pontos_acumulados: (clientPoints.pontos_acumulados || 0) + pontosGanhos,
                    total_gasto: (clientPoints.total_gasto || 0) + valorPedido,
                    ultima_atualizacao: new Date().toISOString(),
                }),
            });
        } else {
            // Criar novo registro
            await nocoFetch(LOYALTY_POINTS_TABLE_ID, '/records', {
                method: 'POST',
                body: JSON.stringify({
                    empresa_id: user.empresaId,
                    cliente_telefone: telefone,
                    cliente_nome: nomeCliente,
                    pontos_acumulados: pontosGanhos,
                    pontos_gastos: 0,
                    total_gasto: valorPedido,
                    ultima_atualizacao: new Date().toISOString(),
                }),
            });
        }

        // Registrar no histórico
        await addPointsHistory(telefone, 'ganho', pontosGanhos, `Pedido #${pedidoId}`, pedidoId);

        revalidatePath('/dashboard/settings');
        return { pontosGanhos };
    } catch (error) {
        console.error('addPointsForOrder error:', error);
        return null;
    }
}

// Resgatar pontos
export async function redeemPoints(data: { cliente_telefone: string; pontos_resgatar: number }) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        // Validação
        const validated = LoyaltyRedeemSchema.safeParse(data);
        if (!validated.success) {
            throw new Error('Dados inválidos');
        }

        // Buscar pontos do cliente
        const clientPoints = await getClientPoints(validated.data.cliente_telefone);
        if (!clientPoints) {
            throw new Error('Cliente não possui pontos');
        }

        const pontosDisponiveis = (clientPoints.pontos_acumulados || 0) - (clientPoints.pontos_gastos || 0);
        if (validated.data.pontos_resgatar > pontosDisponiveis) {
            throw new Error(`Pontos insuficientes. Disponíveis: ${pontosDisponiveis}`);
        }

        // Buscar configuração para calcular valor do desconto
        const config = await getLoyaltyConfig();
        if (!config) throw new Error('Configuração não encontrada');

        let valorDesconto = 0;
        if (config.desconto_tipo === 'valor_fixo') {
            valorDesconto = (validated.data.pontos_resgatar / config.pontos_para_desconto) * config.desconto_valor;
        } else {
            valorDesconto = (validated.data.pontos_resgatar / config.pontos_para_desconto) * config.desconto_valor;
        }

        // Atualizar pontos do cliente
        await nocoFetch(LOYALTY_POINTS_TABLE_ID, '/records', {
            method: 'PATCH',
            body: JSON.stringify({
                id: clientPoints.id,
                pontos_gastos: (clientPoints.pontos_gastos || 0) + validated.data.pontos_resgatar,
                ultima_atualizacao: new Date().toISOString(),
            }),
        });

        // Registrar no histórico
        await addPointsHistory(
            validated.data.cliente_telefone, 
            'resgate', 
            validated.data.pontos_resgatar, 
            `Resgate de R$ ${valorDesconto.toFixed(2).replace('.', ',')}`
        );

        await logAction('REDEEM_POINTS', `Cliente ${validated.data.cliente_telefone} resgatou ${validated.data.pontos_resgatar} pontos`);
        revalidatePath('/dashboard/settings');

        return { 
            success: true, 
            valorDesconto,
            pontosResgatados: validated.data.pontos_resgatar 
        };
    } catch (error: any) {
        console.error('redeemPoints error:', error);
        throw new Error(error.message || 'Erro ao resgatar pontos');
    }
}

// Deduzir pontos no pedido (usado pelo sistema de pedidos)
export async function deductPointsForOrder(
    clienteTelefone: string, 
    pontosParaDeduzir: number,
    valorDesconto: number,
    pedidoId: number | string
) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        // Buscar pontos do cliente
        const clientPoints = await getClientPoints(clienteTelefone);
        if (!clientPoints) return null;

        const pontosDisponiveis = (clientPoints.pontos_acumulados || 0) - (clientPoints.pontos_gastos || 0);
        if (pontosParaDeduzir > pontosDisponiveis) {
            return null; // Não tem pontos suficientes
        }

        // Atualizar pontos do cliente
        await nocoFetch(LOYALTY_POINTS_TABLE_ID, '/records', {
            method: 'PATCH',
            body: JSON.stringify({
                id: clientPoints.id,
                pontos_gastos: (clientPoints.pontos_gastos || 0) + pontosParaDeduzir,
                ultima_atualizacao: new Date().toISOString(),
            }),
        });

        // Registrar no histórico
        await addPointsHistory(
            clienteTelefone, 
            'resgate', 
            pontosParaDeduzir, 
            `Resgate via pedido #${pedidoId} - R$ ${valorDesconto.toFixed(2).replace('.', ',')}`,
            pedidoId
        );

        return { 
            success: true, 
            pontosDeduzidos: pontosParaDeduzir,
            valorDesconto
        };
    } catch (error) {
        console.error('deductPointsForOrder error:', error);
        return null;
    }
}

// ==================== HISTÓRICO ====================

async function addPointsHistory(
    telefone: string, 
    tipo: 'ganho' | 'resgate' | 'expirado' | 'ajuste',
    pontos: number,
    descricao: string,
    pedidoId?: number | string
) {
    try {
        const user = await getMe();
        if (!user?.empresaId) return;

        // Tabela de histórico (pode ser a mesma ou uma separada)
        await nocoFetch(LOYALTY_POINTS_TABLE_ID, '/records', {
            method: 'POST',
            body: JSON.stringify({
                empresa_id: user.empresaId,
                cliente_telefone: telefone,
                tipo,
                pontos,
                descricao,
                pedido_id: pedidoId,
                data: new Date().toISOString(),
            }),
        });
    } catch (error) {
        console.error('addPointsHistory error:', error);
    }
}

// Buscar histórico de pontos de um cliente
export async function getClientPointsHistory(telefone: string) {
    try {
        const user = await getMe();
        if (!user?.empresaId) return [];

        const res = await nocoFetch(LOYALTY_POINTS_TABLE_ID,
            `/records?limit=50&where=(empresa_id,eq,${user.empresaId})~and(cliente_telefone,eq,${telefone})&sort=-data`);
        const data = await res.json();
        
        return data.list || [];
    } catch (error) {
        console.error('getClientPointsHistory error:', error);
        return [];
    }
}

// ==================== ESTATÍSTICAS ====================

export async function getLoyaltyStats() {
    try {
        const user = await getMe();
        if (!user?.empresaId) return null;

        const config = await getLoyaltyConfig();
        const clientsPoints = await getAllClientsPoints();

        const totalClientes = clientsPoints.length;
        const totalPontosAcumulados = clientsPoints.reduce((sum, c) => sum + (c.pontos_acumulados || 0), 0);
        const totalPontosResgatados = clientsPoints.reduce((sum, c) => sum + (c.pontos_gastos || 0), 0);
        const pontosAtivos = totalPontosAcumulados - totalPontosResgatados;

        // Top 10 clientes com mais pontos
        const topClients = clientsPoints.slice(0, 10);

        return {
            config,
            totalClientes,
            totalPontosAcumulados,
            totalPontosResgatados,
            pontosAtivos,
            topClients,
        };
    } catch (error) {
        console.error('getLoyaltyStats error:', error);
        return null;
    }
}

// Verificar se cliente tem pontos suficientes para resgate
export async function checkPointsAvailability(telefone: string, pontosNecessarios: number) {
    try {
        const clientPoints = await getClientPoints(telefone);
        if (!clientPoints) return { available: false, pontos: 0 };

        const pontosDisponiveis = (clientPoints.pontos_acumulados || 0) - (clientPoints.pontos_gastos || 0);
        return {
            available: pontosDisponiveis >= pontosNecessarios,
            pontos: pontosDisponiveis,
        };
    } catch (error) {
        console.error('checkPointsAvailability error:', error);
        return { available: false, pontos: 0 };
    }
}

// Calcular valor de desconto por pontos
export async function calculatePointsValue(pontos: number) {
    try {
        const config = await getLoyaltyConfig();
        if (!config) return 0;

        return (pontos / config.pontos_para_desconto) * config.desconto_valor;
    } catch (error) {
        return 0;
    }
}
