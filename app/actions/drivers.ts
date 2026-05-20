'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from '@/lib/session-server';
import { sendWhatsAppMessage, sendWhatsAppMessageWithInstance } from './whatsapp';
import { query } from '@/lib/db';

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

        const result = await query(
            `SELECT * FROM entregadores WHERE empresa_id = $1 ORDER BY id DESC LIMIT 1000`,
            [user.empresaId]
        );
        return result.rows || [];
    } catch (error) {
        console.error('Erro ao buscar entregadores:', error);
        return [];
    }
}

export async function getAvailableDrivers() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const result = await query(
            `SELECT * FROM entregadores WHERE empresa_id = $1 AND status != 'offline' AND ativo = true ORDER BY id DESC LIMIT 1000`,
            [user.empresaId]
        );

        return result.rows || [];
    } catch (error) {
        return [];
    }
}

export async function createDriver(data: Omit<Driver, 'id' | 'empresa_id'>) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const result = await query(
            `INSERT INTO entregadores (empresa_id, nome, telefone, email, veiculo, placa, foto_url, status, comissao_por_entrega, entregas_hoje, entregas_total, avaliacao, ativo)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING *`,
            [user.empresaId, data.nome, data.telefone, data.email || null, data.veiculo, data.placa || null, data.foto_url || null, data.status || 'offline', data.comissao_por_entrega || 0, 0, 0, 5.0, true]
        );

        revalidatePath('/dashboard/settings');
        return result.rows[0];
    } catch (error) {
        throw new Error('Erro ao criar entregador');
    }
}

export async function updateDriver(id: number, data: Partial<Driver>) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const updates: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (data.nome !== undefined) { updates.push(`nome = $${paramIndex}`); params.push(data.nome); paramIndex++; }
        if (data.telefone !== undefined) { updates.push(`telefone = $${paramIndex}`); params.push(data.telefone); paramIndex++; }
        if (data.email !== undefined) { updates.push(`email = $${paramIndex}`); params.push(data.email); paramIndex++; }
        if (data.veiculo !== undefined) { updates.push(`veiculo = $${paramIndex}`); params.push(data.veiculo); paramIndex++; }
        if (data.placa !== undefined) { updates.push(`placa = $${paramIndex}`); params.push(data.placa); paramIndex++; }
        if (data.foto_url !== undefined) { updates.push(`foto_url = $${paramIndex}`); params.push(data.foto_url); paramIndex++; }
        if (data.status !== undefined) { updates.push(`status = $${paramIndex}`); params.push(data.status); paramIndex++; }
        if (data.comissao_por_entrega !== undefined) { updates.push(`comissao_por_entrega = $${paramIndex}`); params.push(data.comissao_por_entrega); paramIndex++; }
        if (data.entregas_hoje !== undefined) { updates.push(`entregas_hoje = $${paramIndex}`); params.push(data.entregas_hoje); paramIndex++; }
        if (data.entregas_total !== undefined) { updates.push(`entregas_total = $${paramIndex}`); params.push(data.entregas_total); paramIndex++; }
        if (data.avaliacao !== undefined) { updates.push(`avaliacao = $${paramIndex}`); params.push(data.avaliacao); paramIndex++; }
        if (data.ativo !== undefined) { updates.push(`ativo = $${paramIndex}`); params.push(data.ativo); paramIndex++; }

        params.push(id);

        const result = await query(
            `UPDATE entregadores SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            params
        );

        revalidatePath('/dashboard/settings');
        return result.rows[0];
    } catch (error) {
        console.error('Erro ao atualizar entregador:', error);
        throw new Error('Erro ao atualizar entregador');
    }
}

export async function deleteDriver(id: number) {
    try {
        await query(`DELETE FROM entregadores WHERE id = $1`, [id]);

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

        await query(
            `UPDATE pedidos SET entregador_id = $1 WHERE id = $2`,
            [driverId, orderId]
        );

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

        const orderResult = await query(
            `SELECT * FROM pedidos WHERE id = $1`,
            [orderId]
        );
        const order = orderResult.rows[0];

        console.log(`[finishDelivery] Pedido encontrado:`, {
            id: order?.id,
            entregador_id: order?.entregador_id,
            cliente: order?.cliente_nome,
            status: order?.status
        });

        if (order?.entregador_id) {
            const driverResult = await query(
                `SELECT * FROM entregadores WHERE id = $1`,
                [order.entregador_id]
            );
            const driver = driverResult.rows[0];

            const comissao = Number(driver?.comissao_por_entrega) || 0;
            const taxaEntrega = Number(order.taxa_entrega) || 0;
            const comissaoFinal = comissao > 0 ? comissao : (taxaEntrega * 0.5);

            console.log(`[finishDelivery] Entregador: ${driver?.nome}, Comissão config: ${comissao}, Taxa entrega: ${taxaEntrega}`);

            // Registrar no histórico de entregas
            try {
                await query(
                    `INSERT INTO historico_entregas (pedido_id, entregador_id, empresa_id, endereco, bairro, valor_pedido, taxa_entrega, comissao, status, atribuida_em, entregue_em)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                    [orderId, Number(order.entregador_id), Number(user.empresaId), order.endereco_entrega || '', order.bairro_entrega || '', Number(order.valor_total) || 0, taxaEntrega, comissaoFinal, 'entregue', order.criado_em || new Date().toISOString(), new Date().toISOString()]
                );
                console.log(`[finishDelivery] Histórico salvo com sucesso`);
            } catch (e) {
                console.error(`[finishDelivery] Exceção ao salvar histórico:`, e);
            }

            // Registrar comissão diária
            const today = new Date().toISOString().split('T')[0];

            try {
                const existingResult = await query(
                    `SELECT * FROM comissoes WHERE entregador_id = $1 AND data = $2`,
                    [order.entregador_id, today]
                );
                const existing = existingResult.rows[0];

                if (existing) {
                    await query(
                        `UPDATE comissoes SET total_entregas = $1, valor_total_pedidos = $2, taxa_entrega_total = $3, comissao_total = $4 WHERE id = $5`,
                        [(existing.total_entregas || 0) + 1, (Number(existing.valor_total_pedidos) || 0) + (Number(order.valor_total) || 0), (Number(existing.taxa_entrega_total) || 0) + taxaEntrega, (Number(existing.comissao_total) || 0) + comissaoFinal, existing.id]
                    );
                    console.log(`[finishDelivery] Comissão atualizada`);
                } else {
                    await query(
                        `INSERT INTO comissoes (entregador_id, empresa_id, data, total_entregas, valor_total_pedidos, taxa_entrega_total, comissao_total, comissao_paga)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [Number(order.entregador_id), Number(user.empresaId), today, 1, Number(order.valor_total) || 0, taxaEntrega, comissaoFinal, false]
                    );
                    console.log(`[finishDelivery] Comissão criada`);
                }
            } catch (e) {
                console.error(`[finishDelivery] Erro ao registrar comissão:`, e);
            }

            await updateDriverStatus(order.entregador_id, 'disponivel');

            await updateDriver(order.entregador_id, {
                entregas_hoje: (driver?.entregas_hoje || 0) + 1,
                entregas_total: (driver?.entregas_total || 0) + 1
            });

            console.log(`[finishDelivery] Entregador atualizado`);
        } else {
            console.log(`[finishDelivery] Pedido sem entregador atribuído`);
        }

        return { success: true };
    } catch (error) {
        console.error('[finishDelivery] Erro geral:', error);
        return { success: false };
    }
}

export async function getDriverDeliveryHistory(driverId: number, limit = 50) {
    try {
        const result = await query(
            `SELECT * FROM historico_entregas WHERE entregador_id = $1 ORDER BY entregue_em DESC LIMIT $2`,
            [driverId, limit]
        );
        return result.rows || [];
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

        const ordersResult = await query(
            `SELECT * FROM pedidos WHERE empresa_id = $1 AND entregador_id IS NOT NULL ORDER BY id DESC LIMIT $2`,
            [user.empresaId, limit]
        );
        const orders = ordersResult.rows || [];

        console.log(`[getAllDeliveries] Pedidos com entregador: ${orders.length}`);

        const driversResult = await query(
            `SELECT * FROM entregadores WHERE empresa_id = $1 LIMIT 1000`,
            [user.empresaId]
        );
        const driversList = driversResult.rows || [];
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
        const user = await getMe();
        
        const driverResult = await query(
            `SELECT * FROM entregadores WHERE id = $1`,
            [driverId]
        );
        const driver = driverResult.rows[0];

        if (!driver?.telefone) {
            console.log('[Driver Notification] Entregador sem telefone');
            return;
        }

        const orderResult = await query(
            `SELECT * FROM pedidos WHERE id = $1`,
            [orderId]
        );
        const order = orderResult.rows[0];

        const mensagem = `*Nova entrega atribuída!*

Pedido #${orderId}
Cliente: ${order?.cliente_nome || 'Cliente'}
Endereço: ${order?.endereco_entrega || order?.bairro_entrega || 'Não informado'}
Total: R$ ${Number(order?.valor_total || 0).toFixed(2)}

Acesse o painel para mais detalhes.`;

        if (user?.empresaId) {
            const result = await sendWhatsAppMessageWithInstance(driver.telefone, mensagem, user.empresaId);
            if (result.success) {
                console.log(`[Driver Notification] Notificacao enviada para ${driver.nome}`);
            } else {
                console.error(`[Driver Notification] Falha ao enviar para ${driver.nome}: ${result.error}`);
            }
        } else {
            const success = await sendWhatsAppMessage(driver.telefone, mensagem);
            if (success) {
                console.log(`[Driver Notification] Notificacao enviada para ${driver.nome} (fallback)`);
            }
        }
    } catch (error) {
        console.error('[Driver Notification] Erro:', error);
    }
}

export async function getDriverStats(driverId: number) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const result = await query(
            `SELECT * FROM pedidos WHERE empresa_id = $1 AND entregador_id = $2 AND status = 'entrega' LIMIT 1000`,
            [user.empresaId, driverId]
        );
        const orders = result.rows || [];

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

        const result = await query(
            `SELECT id FROM entregadores WHERE empresa_id = $1`,
            [user.empresaId]
        );
        const drivers = result.rows || [];

        for (const driver of drivers) {
            await updateDriver(driver.id, { entregas_hoje: 0 });
        }

        return { success: true, reseted: drivers.length };
    } catch (error) {
        console.error('Erro ao resetar entregas diárias:', error);
        throw new Error('Erro ao resetar entregas diárias');
    }
}
