'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from './auth';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const DRIVERS_TABLE_ID = 'm7fg9pyp2odct7m_entregadores'; // Tabela de entregadores (precisa criar no NocoDB)
const ORDERS_TABLE_ID = 'm2ic8zof3feve3l'; // Pedidos

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
        console.error(`NocoDB Error (Drivers): ${res.status} ${text}`);
        throw new Error(`NocoDB API Error: ${res.status}`);
    }

    return res;
}

export interface Driver {
    id?: number;
    nome: string;
    telefone: string;
    veiculo: string;
    placa?: string;
    foto_url?: string;
    status: 'disponivel' | 'ocupado' | 'offline';
    comissao_por_entrega: number;
    entregas_hoje: number;
    avaliacao: number;
    ativo: boolean;
    empresa_id?: number;
}

// Buscar todos os entregadores da empresa
export async function getDrivers() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const res = await nocoFetch(DRIVERS_TABLE_ID, 
            `/records?limit=1000&where=(empresa_id,eq,${user.empresaId})&sort=-id`);
        const data = await res.json();
        return (data.list || []) as Driver[];
    } catch (error) {
        console.error('Erro ao buscar entregadores:', error);
        return [];
    }
}

// Buscar entregadores disponíveis
export async function getAvailableDrivers() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const res = await nocoFetch(DRIVERS_TABLE_ID, 
            `/records?limit=1000&where=(empresa_id,eq,${user.empresaId})~and(status,neq,offline)~and(ativo,eq,true)`);
        const data = await res.json();
        return (data.list || []) as Driver[];
    } catch (error) {
        console.error('Erro ao buscar entregadores disponíveis:', error);
        return [];
    }
}

// Criar entregador
export async function createDriver(data: Omit<Driver, 'id' | 'empresa_id'>) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const payload = {
            ...data,
            empresas: user.empresaId,
            status: data.status || 'offline',
            comissao_por_entrega: data.comissao_por_entrega || 0,
            entregas_hoje: 0,
            avaliacao: 5.0,
            ativo: true,
        };

        const res = await nocoFetch(DRIVERS_TABLE_ID, '/records', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        revalidatePath('/dashboard/settings');
        return await res.json();
    } catch (error) {
        console.error('Erro ao criar entregador:', error);
        throw new Error('Erro ao criar entregador');
    }
}

// Atualizar entregador
export async function updateDriver(id: number, data: Partial<Driver>) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const { id: _, empresa_id, ...updateData } = data;
        
        const res = await nocoFetch(DRIVERS_TABLE_ID, '/records', {
            method: 'PATCH',
            body: JSON.stringify({ Id: id, id, ...updateData }),
        });

        revalidatePath('/dashboard/settings');
        return await res.json();
    } catch (error) {
        console.error('Erro ao atualizar entregador:', error);
        throw new Error('Erro ao atualizar entregador');
    }
}

// Deletar entregador
export async function deleteDriver(id: number) {
    try {
        await nocoFetch(DRIVERS_TABLE_ID, '/records', {
            method: 'DELETE',
            body: JSON.stringify([{ id, Id: id }]),
        });

        revalidatePath('/dashboard/settings');
        return { success: true };
    } catch (error) {
        console.error('Erro ao deletar entregador:', error);
        throw new Error('Erro ao deletar entregador');
    }
}

// Atualizar status do entregador
export async function updateDriverStatus(id: number, status: Driver['status']) {
    try {
        await updateDriver(id, { status });
        revalidatePath('/dashboard/expedition');
        return { success: true };
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        throw new Error('Erro ao atualizar status');
    }
}

// Atribuir entregador ao pedido
export async function assignDriverToOrder(orderId: number, driverId: number | null) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        // Atualizar pedido com entregador
        await nocoFetch(ORDERS_TABLE_ID, '/records', {
            method: 'PATCH',
            body: JSON.stringify({ 
                Id: orderId, 
                id: orderId,
                entregador_id: driverId 
            }),
        });

        // Se atribuiu um entregador, marcar como ocupado
        if (driverId) {
            await updateDriverStatus(driverId, 'ocupado');
            
            // Enviar notificação WhatsApp (assíncrono)
            sendDriverNotification(driverId, orderId).catch(err => 
                console.error('Erro ao notificar entregador:', err)
            );
        }

        revalidatePath('/dashboard/expedition');
        return { success: true };
    } catch (error) {
        console.error('Erro ao atribuir entregador:', error);
        throw new Error('Erro ao atribuir entregador');
    }
}

// Finalizar entrega (liberar entregador)
export async function finishDelivery(orderId: number) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        // Buscar pedido para ver entregador
        const orderRes = await nocoFetch(ORDERS_TABLE_ID, `/records/${orderId}`);
        const order = await orderRes.json();

        if (order.entregador_id) {
            // Marcar entregador como disponível
            await updateDriverStatus(order.entregador_id, 'disponivel');
            
            // Incrementar entregas do dia
            const driverRes = await nocoFetch(DRIVERS_TABLE_ID, `/records/${order.entregador_id}`);
            const driver = await driverRes.json();
            
            await updateDriver(order.entregador_id, {
                entregas_hoje: (driver.entregas_hoje || 0) + 1
            });
        }

        return { success: true };
    } catch (error) {
        console.error('Erro ao finalizar entrega:', error);
        throw new Error('Erro ao finalizar entrega');
    }
}

// Enviar notificação WhatsApp para entregador
async function sendDriverNotification(driverId: number, orderId: number) {
    try {
        // Buscar dados do entregador
        const driverRes = await nocoFetch(DRIVERS_TABLE_ID, `/records/${driverId}`);
        const driver = await driverRes.json();

        if (!driver.telefone) return;

        // Buscar dados do pedido
        const orderRes = await nocoFetch(ORDERS_TABLE_ID, `/records/${orderId}`);
        const order = await orderRes.json();

        const mensagem = `🛵 *Nova entrega atribuída!*\n\n` +
            `Pedido #${orderId}\n` +
            `Cliente: ${order.cliente_nome || 'Cliente'}\n` +
            `Endereço: ${order.endereco_entrega || order.bairro_entrega || 'Não informado'}\n` +
            `Total: R$ ${Number(order.valor_total || 0).toFixed(2)}\n\n` +
            `Acesse o painel para mais detalhes.`;

        const EVO_API_URL = process.env.EVOLUTION_API_URL || 'https://evo.wzapflow.com.br';
        const apiKey = process.env.EVOLUTION_API_KEY || '';
        const instance = process.env.EVOLUTION_INSTANCE || 'zapflow_testes';

        const url = `${EVO_API_URL}/message/sendText/${instance}`;
        
        await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                number: driver.telefone,
                text: mensagem
            })
        });

        console.log(`Notificação enviada para entregador ${driver.nome}`);
    } catch (error) {
        console.error('Erro ao enviar notificação:', error);
    }
}

// Buscar estatísticas do entregador
export async function getDriverStats(driverId: number) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        // Buscar pedidos do entregador
        const res = await nocoFetch(ORDERS_TABLE_ID, 
            `/records?where=(empresa_id,eq,${user.empresaId})~and(entregador_id,eq,${driverId})~and(status,eq,entrega)&limit=1000`);
        const data = await res.json();
        const orders = data.list || [];

        // Calcular estatísticas
        const totalEntregas = orders.length;
        const valorTotal = orders.reduce((sum: number, o: any) => sum + Number(o.valor_total || 0), 0);
        const taxaEntregaTotal = orders.reduce((sum: number, o: any) => sum + Number(o.taxa_entrega || 0), 0);

        return {
            totalEntregas,
            valorTotal,
            taxaEntregaTotal,
            comissaoTotal: 0 // Será calculado com base na comissão do entregador
        };
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        return { totalEntregas: 0, valorTotal: 0, taxaEntregaTotal: 0, comissaoTotal: 0 };
    }
}

// Resetar entregas diárias (chamar diariamente via cron)
export async function resetDailyDeliveries() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const res = await nocoFetch(DRIVERS_TABLE_ID, 
            `/records?where=(empresa_id,eq,${user.empresaId})&limit=1000`);
        const data = await res.json();
        const drivers = data.list || [];

        // Resetar entregas_hoje para todos
        for (const driver of drivers) {
            await updateDriver(driver.id, { entregas_hoje: 0 });
        }

        return { success: true, reseted: drivers.length };
    } catch (error) {
        console.error('Erro ao resetar entregas diárias:', error);
        throw new Error('Erro ao resetar entregas diárias');
    }
}
