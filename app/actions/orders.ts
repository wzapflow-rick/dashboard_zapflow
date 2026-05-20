'use server';

import { revalidatePath } from 'next/cache';
import { getMe, requireRole } from '@/lib/session-server';
import { getReceitaDoProduto, atualizarEstoqueInsumo, getInsumos } from './insumos';
import { getReceitaDoComplemento, getInsumosDoGrupo } from './complements';
import { getReceitaDoItemBase } from './itens-base';
import { OrderStatusSchema } from '@/lib/validations';
import { logAction } from '@/lib/audit';
import { incrementCouponUsage } from './coupons';
import { addPointsForOrder } from './loyalty';
import { finishDelivery } from './drivers';
import { sendOrderStatusMessage } from './whatsapp';
import { logger } from '@/lib/logger';
import { query } from '@/lib/db';
import { RATE_LIMIT } from '@/lib/constants';

interface NecessidadeInsumo {
    nome: string;
    total: number;
    disponivel: number;
    unidade: string;
}

// Rate limiting para atualização de status
const orderUpdateAttempts = new Map<string, { count: number; lastAttempt: number }>();

export async function getOrders() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const ordersResult = await query(
            `SELECT * FROM pedidos WHERE empresa_id = $1 ORDER BY id DESC LIMIT 1000`,
            [user.empresaId]
        );
        const orders = ordersResult.rows || [];

        if (orders.length === 0) return [];

        const clientsResult = await query(
            `SELECT * FROM clientes WHERE empresa_id = $1`,
            [user.empresaId]
        );
        const clients = clientsResult.rows || [];

        let drivers: any[] = [];
        try {
            const driversResult = await query(
                `SELECT * FROM entregadores WHERE empresa_id = $1`,
                [user.empresaId]
            );
            drivers = driversResult.rows || [];
        } catch {
            drivers = [];
        }

        const clientsByPhone: Record<string, any> = {};
        clients.forEach((c: any) => {
            if (c.telefone) clientsByPhone[String(c.telefone)] = c;
        });

        const driversById: Record<string, any> = {};
        drivers.forEach((d: any) => {
            if (d.id) driversById[String(d.id)] = d;
        });

        return orders.map((order: any) => {
            const phone = order.telefone_cliente ? String(order.telefone_cliente) : '';
            const client = clientsByPhone[phone] || null;
            const driverId = order.entregador_id ? String(order.entregador_id) : '';
            const driver = driversById[driverId] || null;

            return {
                id: order.id,
                status: order.status,
                valor_total: order.valor_total,
                criado_em: order.criado_em,
                telefone_cliente: order.telefone_cliente,
                endereco_entrega: order.endereco_entrega || '',
                bairro_entrega: order.bairro_entrega || '',
                tipo_entrega: order.tipo_entrega || '',
                entregador_id: order.entregador_id || null,
                itens: order.itens,
                cupom_id: order.cupom_id || null,
                canal: order.canal || '',
                nome_cliente: client?.nome || order.cliente_nome || null,
                is_recorrente: !!client,
                entregador_nome: driver?.nome || null,
                entregador_telefone: driver?.telefone || null,
                entregador_veiculo: driver?.veiculo || null,
            };
        });
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to fetch orders with client data');
    }
}

export async function createManualOrder(data: {
    cliente_nome: string;
    telefone_cliente: string;
    itens: string;
    valor_total: number;
}) {
    try {
        const user = await requireRole(['admin', 'gerente', 'atendente', 'cozinheiro']);

        const result = await query(
            `INSERT INTO pedidos (cliente_nome, telefone_cliente, itens, valor_total, status, canal, tipo_entrega, empresa_id, criado_em)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                data.cliente_nome || 'Cliente Manual',
                data.telefone_cliente || '00000000000',
                data.itens,
                data.valor_total,
                'pendente',
                'Painel',
                'retirada',
                user.empresaId,
                new Date().toISOString()
            ]
        );

        revalidatePath('/dashboard/expedition');
        return result.rows[0];
    } catch (error: any) {
        console.error('Erro ao criar pedido manual:', error);
        throw new Error(error.message || 'Failed to create manual order');
    }
}

export async function updateOrderStatus(id: number, status: string, motivo?: string) {
    try {
        const user = await requireRole(['admin', 'gerente', 'atendente', 'cozinheiro']);

        const validated = OrderStatusSchema.safeParse({ orderId: id, status });
        if (!validated.success) {
            const errorMsg = validated.error.issues.map((issue: any) => issue.message).join(', ');
            throw new Error(`Dados inválidos: ${errorMsg}`);
        }

        const now = Date.now();
        const attemptKey = `${user.empresaId}:order_update`;
        const attempt = orderUpdateAttempts.get(attemptKey);

        if (attempt && attempt.count >= RATE_LIMIT.ORDER_UPDATE_MAX) {
            const timeSinceLast = now - attempt.lastAttempt;
            if (timeSinceLast < RATE_LIMIT.ORDER_UPDATE_WINDOW_MS) {
                throw new Error('Muitas atualizações. Aguarde um momento.');
            } else {
                orderUpdateAttempts.delete(attemptKey);
            }
        }

        const orderResult = await query(
            `SELECT * FROM pedidos WHERE id = $1`,
            [id]
        );
        const orderData = orderResult.rows[0];

        if (!orderData || Number(orderData.empresa_id) !== Number(user.empresaId)) {
            logger.securityAccessDenied(user.empresaId, `order:${id}`, 'UPDATE_STATUS');
            throw new Error('Acesso negado: Pedido não pertence a esta empresa');
        }

        let observacoes = orderData.observacoes || '';

        if (status === 'cancelado' && motivo) {
            const nowStr = new Date().toLocaleString('pt-BR');
            observacoes = observacoes
                ? `${observacoes}\n❌ CANCELADO (${nowStr}): ${motivo}`
                : `❌ CANCELADO (${nowStr}): ${motivo}`;
        }

        if (status === 'finalizado') {
            try {
                if (orderData.telefone_cliente) {
                    const clientResult = await query(
                        `SELECT * FROM clientes WHERE empresa_id = $1 AND telefone = $2 LIMIT 1`,
                        [user.empresaId, orderData.telefone_cliente]
                    );
                    const client = clientResult.rows[0];

                    if (client) {
                        await query(
                            `UPDATE clientes SET ultima_compra = $1 WHERE id = $2`,
                            [new Date().toISOString(), client.id]
                        );
                    }
                }
            } catch (err) {
                console.error('Erro ao atualizar dados do cliente:', err);
            }
        }

        await query(
            `UPDATE pedidos SET status = $1, observacoes = $2 WHERE id = $3`,
            [status, observacoes, id]
        );

        if (status === 'finalizado') {
            deduzirInsumosDoPedido(id).catch(err => console.error('Falha na dedução:', err));

            if (orderData.cupom_id) {
                incrementCouponUsage(orderData.cupom_id).catch(err =>
                    console.error('Falha ao incrementar cupom:', err)
                );
            }

            if (orderData.telefone_cliente && orderData.valor_total) {
                addPointsForOrder(
                    orderData.telefone_cliente,
                    orderData.cliente_nome || 'Cliente',
                    Number(orderData.valor_total)
                ).catch(err => console.error('Falha ao adicionar pontos:', err));
            }

            finishDelivery(id).catch(err => console.error('Falha ao finalizar entrega:', err));
        }

        if (orderData.telefone_cliente) {
            sendOrderStatusMessage(orderData.telefone_cliente, id, status, user.empresaId, orderData.tipo_entrega)
                .catch(err => console.error('Falha ao enviar WhatsApp:', err));
        }

        await logAction('UPDATE_ORDER_STATUS', `Pedido #${id} atualizado para: ${status}`);

        const currentAttempt = orderUpdateAttempts.get(attemptKey) || { count: 0, lastAttempt: now };
        currentAttempt.count += 1;
        currentAttempt.lastAttempt = now;
        orderUpdateAttempts.set(attemptKey, currentAttempt);

        revalidatePath('/dashboard/expedition');
        revalidatePath('/dashboard/customers');
        return { success: true };
    } catch (error: any) {
        console.error('API Error:', error);
        throw new Error(error.message || 'Failed to update order status');
    }
}

export async function deduzirInsumosDoPedido(orderId: number) {
    try {
        const user = await getMe();
        if (!user?.empresaId) return;

        const companyResult = await query(
            `SELECT * FROM empresas WHERE id = $1`,
            [user.empresaId]
        );
        const company = companyResult.rows[0];

        const isEstoqueAtivo = company?.controle_estoque === true ||
            company?.controle_estoque === 1 ||
            String(company?.controle_estoque).toLowerCase() === 'true';

        if (!isEstoqueAtivo) {
            console.log(`Controle de estoque desativado para empresa ${user.empresaId}. Pulando dedução.`);
            return;
        }

        const orderResult = await query(
            `SELECT * FROM pedidos WHERE id = $1`,
            [orderId]
        );
        const order = orderResult.rows[0];

        if (!order?.itens) return;

        const itens = typeof order.itens === 'string' ? JSON.parse(order.itens) : order.itens;
        if (!Array.isArray(itens)) return;

        console.log(`Iniciando dedução de estoque para pedido ${orderId}. Itens:`, itens.length);

        for (const item of itens) {
            const produtoId = item.id;
            const quantidadeVendida = Number(item.quantidade) || 1;

            if (!produtoId) {
                console.warn(`Item sem ID de produto detectado no pedido ${orderId}:`, item.produto);
                continue;
            }

            const receitaProduto = await getReceitaDoProduto(produtoId);
            if (receitaProduto && receitaProduto.length > 0) {
                const basePromises = receitaProduto.map((r: any) => {
                    const totalADeduzir = Number(r.quantidade_necessaria) * quantidadeVendida;
                    return atualizarEstoqueInsumo(r.insumo_id, -totalADeduzir);
                });
                await Promise.all(basePromises);
            }

            if (item.isComposite) {
                const complements = item.complements || [];
                if (Array.isArray(complements) && complements.length > 0) {
                    const groups = new Map<number, any[]>();
                    complements.forEach((c: any) => {
                        if (c.id) {
                            const gId = c.grupo_id || 0;
                            if (!groups.has(gId)) groups.set(gId, []);
                            groups.get(gId)?.push(c);
                        }
                    });

                    for (const [gId, itemsInGroup] of groups.entries()) {
                        if (gId > 0) {
                            const insumosDoGrupo = await getInsumosDoGrupo(gId);
                            if (insumosDoGrupo.length > 0) {
                                const grupoFixoPromises = insumosDoGrupo.map((r: any) => {
                                    const totalADeduzir = Number(r.quantidade_necessaria) * quantidadeVendida;
                                    return atualizarEstoqueInsumo(r.insumo_id, -totalADeduzir);
                                });
                                await Promise.all(grupoFixoPromises);
                            }
                        }

                        for (const itemBase of itemsInGroup) {
                            let proportion: number;
                            if (itemBase.fator_proporcao !== undefined && itemBase.fator_proporcao !== null) {
                                proportion = Number(itemBase.fator_proporcao);
                            } else {
                                const isProportional = item.tipo_calculo === 'media' || item.tipo_calculo === 'maior_valor' || item.cobrar_mais_caro;
                                proportion = isProportional ? (1 / itemsInGroup.length) : 1;
                            }

                            const receitaItemBase = await getReceitaDoItemBase(itemBase.id);
                            if (receitaItemBase && receitaItemBase.length > 0) {
                                const itemPromises = receitaItemBase.map((r: any) => {
                                    const totalADeduzir = Number(r.quantidade) * proportion * quantidadeVendida;
                                    return atualizarEstoqueInsumo(r.insumo, -totalADeduzir);
                                });
                                await Promise.all(itemPromises);
                            }
                        }
                    }
                }
            } else {
                const complements = item.complements || item.adicionais || [];
                if (Array.isArray(complements) && complements.length > 0) {
                    const groups = new Map<number, any[]>();
                    complements.forEach((c: any) => {
                        if (c.id) {
                            const gId = c.grupo_id || 0;
                            if (!groups.has(gId)) groups.set(gId, []);
                            groups.get(gId)?.push(c);
                        }
                    });

                    for (const [gId, itemsInGroup] of groups.entries()) {
                        if (gId > 0) {
                            const insumosDoGrupo = await getInsumosDoGrupo(gId);
                            if (insumosDoGrupo.length > 0) {
                                const grupoFixoPromises = insumosDoGrupo.map((r: any) => {
                                    const totalADeduzir = Number(r.quantidade_necessaria) * quantidadeVendida;
                                    return atualizarEstoqueInsumo(r.insumo_id, -totalADeduzir);
                                });
                                await Promise.all(grupoFixoPromises);
                            }
                        }

                        const firstItem = itemsInGroup[0];
                        for (const comp of itemsInGroup) {
                            let proportion: number;
                            if (comp.fator_proporcao !== undefined && comp.fator_proporcao !== null) {
                                proportion = Number(comp.fator_proporcao);
                            } else {
                                const isProportional = firstItem?.tipo_calculo === 'media' || firstItem?.tipo_calculo === 'maior_valor' || firstItem?.cobrar_mais_caro;
                                proportion = isProportional ? (1 / itemsInGroup.length) : 1;
                            }

                            const receitaComp = await getReceitaDoComplemento(comp.id);
                            if (receitaComp && receitaComp.length > 0) {
                                const compPromises = receitaComp.map((r: any) => {
                                    const totalADeduzir = Number(r.quantidade_necessaria) * proportion * quantidadeVendida;
                                    return atualizarEstoqueInsumo(r.insumo_id, -totalADeduzir);
                                });
                                await Promise.all(compPromises);
                            }
                        }
                    }
                }
            }
        }

        console.log(`Dedução de estoque concluída para pedido ${orderId}.`);
    } catch (error) {
        console.error('Erro no processo de dedução de estoque:', error);
        throw error;
    }
}

export async function verificarEstoqueDoPedido(orderId: number) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const companyResult = await query(
            `SELECT * FROM empresas WHERE id = $1`,
            [user.empresaId]
        );
        const company = companyResult.rows[0];

        const isEstoqueAtivo = company?.controle_estoque === true ||
            company?.controle_estoque === 1 ||
            String(company?.controle_estoque).toLowerCase() === 'true';

        if (!isEstoqueAtivo) {
            return { hasEnough: true, shortages: [] };
        }

        const orderResult = await query(
            `SELECT * FROM pedidos WHERE id = $1`,
            [orderId]
        );
        const order = orderResult.rows[0];

        if (!order?.itens) return {
            hasEnough: true,
            shortages: [],
            cliente: { nome: order?.cliente_nome, telefone: order?.telefone_cliente }
        };

        const itens = typeof order.itens === 'string' ? JSON.parse(order.itens) : order.itens;
        if (!Array.isArray(itens)) return { hasEnough: true, shortages: [] };

        const currentInsumos = await getInsumos();
        const insumosMap = new Map<number, any>(currentInsumos.map((i: any) => [Number(i.id), i]));

        const necessidades = new Map<number, NecessidadeInsumo>();

        for (const item of itens) {
            const produtoId = item.id;
            const quantidadeVendida = Number(item.quantidade) || 1;
            if (!produtoId) continue;

            const receitaProduto = await getReceitaDoProduto(produtoId);
            for (const r of receitaProduto) {
                const insumo = insumosMap.get(Number(r.insumo_id)) as any;
                if (!insumo) continue;

                const totalPreciso = Number(r.quantidade_necessaria) * quantidadeVendida;
                const prev = necessidades.get(Number(r.insumo_id)) || {
                    nome: insumo.nome,
                    total: 0,
                    disponivel: Number(insumo.quantidade_atual),
                    unidade: insumo.unidade_medida,
                };
                necessidades.set(Number(r.insumo_id), { ...prev, total: prev.total + totalPreciso });
            }

            const complements = item.complements || item.adicionais || [];
            if (Array.isArray(complements)) {
                for (const comp of complements) {
                    if (!comp.id) continue;
                    const receitaComp = await getReceitaDoComplemento(comp.id);
                    for (const r of receitaComp) {
                        const insumo = insumosMap.get(Number(r.insumo_id)) as any;
                        if (!insumo) continue;
                        const totalPreciso = Number(r.quantidade_necessaria) * quantidadeVendida;
                        const prev = necessidades.get(Number(r.insumo_id)) || {
                            nome: insumo.nome,
                            total: 0,
                            disponivel: Number(insumo.quantidade_atual),
                            unidade: insumo.unidade_medida,
                        };
                        necessidades.set(Number(r.insumo_id), { ...prev, total: prev.total + totalPreciso });
                    }
                }
            }
        }

        const shortages: NecessidadeInsumo[] = [];
        necessidades.forEach((nec) => {
            if (nec.total > nec.disponivel) {
                shortages.push(nec);
            }
        });

        return {
            hasEnough: shortages.length === 0,
            shortages,
            cliente: { nome: order.cliente_nome, telefone: order.telefone_cliente }
        };
    } catch (error) {
        console.error('Erro ao verificar estoque:', error);
        return { hasEnough: true, shortages: [] };
    }
}

export async function deleteOrder(orderId: number) {
    try {
        const user = await requireRole(['admin', 'gerente']);

        const orderResult = await query(
            `SELECT * FROM pedidos WHERE id = $1`,
            [orderId]
        );
        const order = orderResult.rows[0];

        if (!order || Number(order.empresa_id) !== Number(user.empresaId)) {
            throw new Error('Acesso negado: Pedido não pertence a esta empresa');
        }

        await query(`DELETE FROM pedidos WHERE id = $1`, [orderId]);

        await logAction('DELETE_ORDER', `Pedido #${orderId} excluído permanentemente`);

        revalidatePath('/dashboard/expedition');
        return { success: true };
    } catch (error: any) {
        console.error('Delete Order Error:', error);
        throw new Error(error.message || 'Failed to delete order');
    }
}

export async function getOrderDetails(orderId: number) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const orderResult = await query(
            `SELECT * FROM pedidos WHERE id = $1 AND empresa_id = $2`,
            [orderId, user.empresaId]
        );
        const order = orderResult.rows[0];

        if (!order) return null;

        return {
            id: order.id,
            status: order.status,
            valor_total: order.valor_total,
            criado_em: order.criado_em,
            telefone_cliente: order.telefone_cliente,
            cliente_nome: order.cliente_nome,
            endereco_entrega: order.endereco_entrega || '',
            bairro_entrega: order.bairro_entrega || '',
            tipo_entrega: order.tipo_entrega || '',
            itens: order.itens,
            observacoes: order.observacoes || '',
            taxa_entrega: order.taxa_entrega || 0,
            desconto: order.desconto || 0,
            subtotal: order.subtotal || order.valor_total,
        };
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}
