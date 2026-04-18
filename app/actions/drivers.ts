'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from './auth';
import { sendWhatsAppMessage } from './whatsapp';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const DRIVERS_TABLE_ID = 'm4hbqkhwu2qvrry'; // entregadores
const ORDERS_TABLE_ID = 'mui7bozvx9zb2n9'; // pedidos
const COMISSOES_TABLE_ID = 'me4x6mmfsbndf42'; // comissoes_entregadores
const CONFIG_ENTREGA_TABLE_ID = 'mmzk2podf4zqps6'; // configuracoes_entregas
const HISTORICO_TABLE_ID = 'm9lt0hyfnh3c47q'; // historico_entregas

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
    email?: string;
    veiculo: string;
    placa?: string;
    foto_url?: string;
    status: 'disponivel' | 'ocupado' | 'offline';
    comissao_por_entrega: number;
    entregas_hoje: number;
    entregas_total: number;
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
            `/records?limit=1000&where=(empresa_id,eq,${user.empresaId})&sort=-id`);
        const data = await res.json();
        const allDrivers = data.list || [];

        const available = allDrivers.filter((d: any) => 
            d.status !== 'offline' && d.status !== 'Offline' &&
            (d.ativo === true || d.ativo === 1 || d.ativo === 'true')
        );

        return available as Driver[];
    } catch (error) {
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
            empresa_id: user.empresaId,
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

// Finalizar entrega (liberar entregador e registrar histórico)
export async function finishDelivery(orderId: number) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        console.log(`[finishDelivery] Iniciando finalização do pedido ${orderId}`);

        // Buscar pedido para ver entregador
        const orderRes = await nocoFetch(ORDERS_TABLE_ID, `/records/${orderId}`);
        const order = await orderRes.json();

        console.log(`[finishDelivery] Pedido encontrado:`, {
            id: order.id,
            entregador_id: order.entregador_id,
            cliente: order.cliente_nome,
            status: order.status
        });

        if (order.entregador_id) {
            // Buscar dados do entregador
            const driverRes = await nocoFetch(DRIVERS_TABLE_ID, `/records/${order.entregador_id}`);
            const driver = await driverRes.json();

            const comissao = Number(driver.comissao_por_entrega) || 0;
            const taxaEntrega = Number(order.taxa_entrega) || 0;
            
            // Comissão = valor configurado OU 50% da taxa de entrega (fallback)
            const comissaoFinal = comissao > 0 ? comissao : (taxaEntrega * 0.5);

            console.log(`[finishDelivery] Entregador: ${driver.nome}, Comissão config: ${comissao}, Taxa entrega: ${taxaEntrega}`);

            // Registrar no histórico de entregas
            const historicoPayload = {
                pedido_id: orderId,
                entregador_id: Number(order.entregador_id),
                empresa_id: Number(user.empresaId),
                endereco: order.endereco_entrega || '',
                bairro: order.bairro_entrega || '',
                valor_pedido: Number(order.valor_total) || 0,
                taxa_entrega: taxaEntrega,
                comissao: comissaoFinal,
                status: 'entregue',
                atribuida_em: order.criado_em || new Date().toISOString(),
                entregue_em: new Date().toISOString(),
            };

            console.log(`[finishDelivery] Salvando histórico:`, historicoPayload);

            try {
                const historicoRes = await nocoFetch(HISTORICO_TABLE_ID, '/records', {
                    method: 'POST',
                    body: JSON.stringify(historicoPayload),
                });

                if (historicoRes.ok) {
                    console.log(`[finishDelivery] ✅ Histórico salvo com sucesso`);
                } else {
                    console.error(`[finishDelivery] ❌ Erro ao salvar histórico:`, await historicoRes.text());
                }
            } catch (e) {
                console.error(`[finishDelivery] ❌ Exceção ao salvar histórico:`, e);
            }

            // Registrar comissão diária
            const today = new Date().toISOString().split('T')[0];
            const comissaoPayload = {
                entregador_id: Number(order.entregador_id),
                empresa_id: Number(user.empresaId),
                data: today,
                total_entregas: 1,
                valor_total_pedidos: Number(order.valor_total) || 0,
                taxa_entrega_total: taxaEntrega,
                comissao_total: comissaoFinal,
                comissao_paga: false,
            };

            console.log(`[finishDelivery] Registrando comissão:`, comissaoPayload);

            try {
                // Verificar se já existe registro para hoje
                const existingRes = await nocoFetch(COMISSOES_TABLE_ID,
                    `/records?where=(entregador_id,eq,${order.entregador_id})~and(data,eq,${today})`);
                const existingData = await existingRes.json();
                const existing = existingData.list?.[0];

                if (existing) {
                    // Atualizar registro existente
                    await nocoFetch(COMISSOES_TABLE_ID, '/records', {
                        method: 'PATCH',
                        body: JSON.stringify({
                            id: existing.id,
                            Id: existing.id,
                            total_entregas: (existing.total_entregas || 0) + 1,
                            valor_total_pedidos: (Number(existing.valor_total_pedidos) || 0) + (Number(order.valor_total) || 0),
                            taxa_entrega_total: (Number(existing.taxa_entrega_total) || 0) + taxaEntrega,
                            comissao_total: (Number(existing.comissao_total) || 0) + comissaoFinal,
                        }),
                    });
                    console.log(`[finishDelivery] ✅ Comissão atualizada`);
                } else {
                    // Criar novo registro
                    await nocoFetch(COMISSOES_TABLE_ID, '/records', {
                        method: 'POST',
                        body: JSON.stringify(comissaoPayload),
                    });
                    console.log(`[finishDelivery] ✅ Comissão criada`);
                }
            } catch (e) {
                console.error(`[finishDelivery] ❌ Erro ao registrar comissão:`, e);
            }

            // Marcar entregador como disponível
            await updateDriverStatus(order.entregador_id, 'disponivel');
            
            // Incrementar entregas do dia
            await updateDriver(order.entregador_id, {
                entregas_hoje: (driver.entregas_hoje || 0) + 1,
                entregas_total: (driver.entregas_total || 0) + 1
            });

            console.log(`[finishDelivery] ✅ Entregador atualizado`);
        } else {
            console.log(`[finishDelivery] ⚠️ Pedido sem entregador atribuído`);
        }

        return { success: true };
    } catch (error) {
        console.error('[finishDelivery] ❌ Erro geral:', error);
        return { success: false };
    }
}

// Buscar histórico de entregas de um entregador
export async function getDriverDeliveryHistory(driverId: number, limit = 50) {
    try {
        const res = await nocoFetch(HISTORICO_TABLE_ID, 
            `/records?where=(entregador_id,eq,${driverId})&sort=-entregue_em&limit=${limit}`);
        const data = await res.json();
        return data.list || [];
    } catch (error) {
        console.error('Erro ao buscar histórico:', error);
        return [];
    }
}

// Buscar todas as entregas da empresa (usa pedidos finalizados com entregador)
export async function getAllDeliveries(limit = 200) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        console.log('[getAllDeliveries] Buscando pedidos com entregador...');

        // Buscar TODOS os pedidos primeiro
        const ordersRes = await nocoFetch(ORDERS_TABLE_ID, 
            `/records?where=(empresa_id,eq,${user.empresaId})&sort=-id&limit=${limit}`);
        const ordersData = await ordersRes.json();
        const allOrders = ordersData.list || [];
        
        console.log(`[getAllDeliveries] Total de pedidos: ${allOrders.length}`);

        // Filtrar apenas os que têm entregador
        const orders = allOrders.filter((o: any) => o.entregador_id && o.entregador_id > 0);
        
        console.log(`[getAllDeliveries] Pedidos com entregador: ${orders.length}`);

        // Buscar entregadores
        const driversRes = await nocoFetch(DRIVERS_TABLE_ID, 
            `/records?where=(empresa_id,eq,${user.empresaId})&limit=1000`);
        const driversData = await driversRes.json();
        const driversList: any[] = driversData.list || [];
        const driversMap = new Map<number, any>(driversList.map((d: any) => [d.id, d]));

        // Converter para formato de entrega com comissão calculada
        return orders.map((o: any) => {
            const driver = driversMap.get(o.entregador_id);
            const comissaoConfig = Number(driver?.comissao_por_entrega) || 0;
            const taxaEntrega = Number(o.taxa_entrega) || 0;
            const comissao = comissaoConfig > 0 ? comissaoConfig : (taxaEntrega > 0 ? taxaEntrega * 0.5 : 0);

            return {
                id: o.id,
                pedido_id: o.id,
                entregador_id: o.entregador_id,
                entregador_nome: driver?.nome || 'Não atribuído',
                entregador_veiculo: driver?.veiculo || '-',
                endereco: o.endereco_entrega || '',
                bairro: o.bairro_entrega || '',
                valor_pedido: o.valor_total || 0,
                taxa_entrega: taxaEntrega,
                comissao: comissao,
                status: o.status,
                atribuida_em: o.criado_em,
                entregue_em: o.updated_at || o.criado_em,
            };
        });
    } catch (error) {
        console.error('[getAllDeliveries] Erro:', error);
        return [];
    }
}

// Enviar notificação WhatsApp para entregador
async function sendDriverNotification(driverId: number, orderId: number) {
    try {
        // Buscar dados do entregador
        const driverRes = await nocoFetch(DRIVERS_TABLE_ID, `/records/${driverId}`);
        const driver = await driverRes.json();

        if (!driver.telefone) {
            console.log('[Driver Notification] Entregador sem telefone');
            return;
        }

        // Buscar dados do pedido
        const orderRes = await nocoFetch(ORDERS_TABLE_ID, `/records/${orderId}`);
        const order = await orderRes.json();

        const mensagem = `🛵 *Nova entrega atribuída!*

Pedido #${orderId}
Cliente: ${order.cliente_nome || 'Cliente'}
Endereço: ${order.endereco_entrega || order.bairro_entrega || 'Não informado'}
Total: R$ ${Number(order.valor_total || 0).toFixed(2)}

Acesse o painel para mais detalhes.`;

        const success = await sendWhatsAppMessage(driver.telefone, mensagem);
        
        if (success) {
            console.log(`[Driver Notification] Notificação enviada para ${driver.nome}`);
        } else {
            console.error(`[Driver Notification] Falha ao enviar para ${driver.nome}`);
        }
    } catch (error) {
        console.error('[Driver Notification] Erro:', error);
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
