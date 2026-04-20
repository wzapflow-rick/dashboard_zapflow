'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from '@/lib/session-server';
import { sendWhatsAppMessage } from './whatsapp';
import { noco } from '@/lib/nocodb';
import {
  ENTREGADORES_TABLE_ID,
  PEDIDOS_TABLE_ID,
  COMISSOES_TABLE_ID,
  HISTORICO_ENTREGAS_TABLE_ID,
} from '@/lib/constants';

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

export async function getDrivers() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const data = await noco.list(ENTREGADORES_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})`,
            sort: '-id',
            limit: 1000,
        });
        return (data.list || []) as unknown as Driver[];
    } catch (error) {
        console.error('Erro ao buscar entregadores:', error);
        return [];
    }
}

export async function getAvailableDrivers() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const data = await noco.list(ENTREGADORES_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})`,
            sort: '-id',
            limit: 1000,
        });
        const allDrivers = data.list || [];

        const available = allDrivers.filter((d: any) =>
            d.status !== 'offline' && d.status !== 'Offline' &&
            (d.ativo === true || d.ativo === 1 || d.ativo === 'true')
        );

        return available as unknown as Driver[];
    } catch (error) {
        return [];
    }
}

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

        const result = await noco.create(ENTREGADORES_TABLE_ID, payload);

        revalidatePath('/dashboard/settings');
        return result;
    } catch (error) {
        throw new Error('Erro ao criar entregador');
    }
}

export async function updateDriver(id: number, data: Partial<Driver>) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const { id: _, empresa_id, ...updateData } = data as any;

        const result = await noco.update(ENTREGADORES_TABLE_ID, { id, ...updateData });

        revalidatePath('/dashboard/settings');
        return result;
    } catch (error) {
        console.error('Erro ao atualizar entregador:', error);
        throw new Error('Erro ao atualizar entregador');
    }
}

export async function deleteDriver(id: number) {
    try {
        await noco.delete(ENTREGADORES_TABLE_ID, id);

        revalidatePath('/dashboard/settings');
        return { success: true };
    } catch (error) {
        console.error('Erro ao deletar entregador:', error);
        throw new Error('Erro ao deletar entregador');
    }
}

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

export async function assignDriverToOrder(orderId: number, driverId: number | null) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        await noco.update(PEDIDOS_TABLE_ID, {
            id: orderId,
            entregador_id: driverId,
        });

        if (driverId) {
            await updateDriverStatus(driverId, 'ocupado');

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

export async function finishDelivery(orderId: number) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        console.log(`[finishDelivery] Iniciando finalização do pedido ${orderId}`);

        const order = await noco.findById(PEDIDOS_TABLE_ID, orderId) as any;

        console.log(`[finishDelivery] Pedido encontrado:`, {
            id: order?.id,
            entregador_id: order?.entregador_id,
            cliente: order?.cliente_nome,
            status: order?.status
        });

        if (order?.entregador_id) {
            const driver = await noco.findById(ENTREGADORES_TABLE_ID, order.entregador_id) as any;

            const comissao = Number(driver?.comissao_por_entrega) || 0;
            const taxaEntrega = Number(order.taxa_entrega) || 0;
            const comissaoFinal = comissao > 0 ? comissao : (taxaEntrega * 0.5);

            console.log(`[finishDelivery] Entregador: ${driver?.nome}, Comissão config: ${comissao}, Taxa entrega: ${taxaEntrega}`);

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

            try {
                await noco.create(HISTORICO_ENTREGAS_TABLE_ID, historicoPayload);
                console.log(`[finishDelivery] ✅ Histórico salvo com sucesso`);
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

            try {
                const existing = await noco.findOne(COMISSOES_TABLE_ID, {
                    where: `(entregador_id,eq,${order.entregador_id})~and(data,eq,${today})`,
                }) as any;

                if (existing) {
                    await noco.update(COMISSOES_TABLE_ID, {
                        id: existing.id,
                        total_entregas: (existing.total_entregas || 0) + 1,
                        valor_total_pedidos: (Number(existing.valor_total_pedidos) || 0) + (Number(order.valor_total) || 0),
                        taxa_entrega_total: (Number(existing.taxa_entrega_total) || 0) + taxaEntrega,
                        comissao_total: (Number(existing.comissao_total) || 0) + comissaoFinal,
                    });
                    console.log(`[finishDelivery] ✅ Comissão atualizada`);
                } else {
                    await noco.create(COMISSOES_TABLE_ID, comissaoPayload);
                    console.log(`[finishDelivery] ✅ Comissão criada`);
                }
            } catch (e) {
                console.error(`[finishDelivery] ❌ Erro ao registrar comissão:`, e);
            }

            await updateDriverStatus(order.entregador_id, 'disponivel');

            await updateDriver(order.entregador_id, {
                entregas_hoje: (driver?.entregas_hoje || 0) + 1,
                entregas_total: (driver?.entregas_total || 0) + 1
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

export async function getDriverDeliveryHistory(driverId: number, limit = 50) {
    try {
        const data = await noco.list(HISTORICO_ENTREGAS_TABLE_ID, {
            where: `(entregador_id,eq,${driverId})`,
            sort: '-entregue_em',
            limit,
        });
        return data.list || [];
    } catch (error) {
        console.error('Erro ao buscar histórico:', error);
        return [];
    }
}

export async function getAllDeliveries(limit = 200) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        console.log('[getAllDeliveries] Buscando pedidos com entregador...');

        const ordersData = await noco.list(PEDIDOS_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})`,
            sort: '-id',
            limit,
        });
        const allOrders = ordersData.list || [];

        console.log(`[getAllDeliveries] Total de pedidos: ${allOrders.length}`);

        const orders = allOrders.filter((o: any) => o.entregador_id && o.entregador_id > 0);

        console.log(`[getAllDeliveries] Pedidos com entregador: ${orders.length}`);

        const driversData = await noco.list(ENTREGADORES_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})`,
            limit: 1000,
        });
        const driversList: any[] = driversData.list || [];
        const driversMap = new Map<number, any>(driversList.map((d: any) => [d.id, d]));

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

async function sendDriverNotification(driverId: number, orderId: number) {
    try {
        const driver = await noco.findById(ENTREGADORES_TABLE_ID, driverId) as any;

        if (!driver?.telefone) {
            console.log('[Driver Notification] Entregador sem telefone');
            return;
        }

        const order = await noco.findById(PEDIDOS_TABLE_ID, orderId) as any;

        const mensagem = `🛵 *Nova entrega atribuída!*

Pedido #${orderId}
Cliente: ${order?.cliente_nome || 'Cliente'}
Endereço: ${order?.endereco_entrega || order?.bairro_entrega || 'Não informado'}
Total: R$ ${Number(order?.valor_total || 0).toFixed(2)}

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

export async function getDriverStats(driverId: number) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const data = await noco.list(PEDIDOS_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})~and(entregador_id,eq,${driverId})~and(status,eq,entrega)`,
            limit: 1000,
        });
        const orders = data.list || [];

        const totalEntregas = orders.length;
        const valorTotal = orders.reduce((sum: number, o: any) => sum + Number(o.valor_total || 0), 0);
        const taxaEntregaTotal = orders.reduce((sum: number, o: any) => sum + Number(o.taxa_entrega || 0), 0);

        return { totalEntregas, valorTotal, taxaEntregaTotal, comissaoTotal: 0 };
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        return { totalEntregas: 0, valorTotal: 0, taxaEntregaTotal: 0, comissaoTotal: 0 };
    }
}

export async function resetDailyDeliveries() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const data = await noco.list(ENTREGADORES_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})`,
            limit: 1000,
        });
        const drivers = data.list || [];

        for (const driver of drivers) {
            await updateDriver((driver as any).id, { entregas_hoje: 0 });
        }

        return { success: true, reseted: drivers.length };
    } catch (error) {
        console.error('Erro ao resetar entregas diárias:', error);
        throw new Error('Erro ao resetar entregas diárias');
    }
}
