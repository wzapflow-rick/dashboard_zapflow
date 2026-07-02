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
import { pg } from '@/lib/postgres';
import {
  PEDIDOS_TABLE,
  CLIENTES_TABLE,
  ENTREGADORES_TABLE,
  EMPRESAS_TABLE,
} from '@/lib/tables';
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

        const ordersData = await pg.list(PEDIDOS_TABLE, {
            where: { empresa_id: user.empresaId },
            sort: '-id',
            limit: 1000,
        });
        const orders = ordersData.list || [];

        if (orders.length === 0) return [];

        const clientsData = await pg.list(CLIENTES_TABLE, {
            where: { empresa_id: user.empresaId },
            limit: 1000,
        });
        const clients = clientsData.list || [];

        let drivers: any[] = [];
        try {
            const driversData = await pg.list(ENTREGADORES_TABLE, {
                where: { empresa_id: user.empresaId },
                limit: 1000,
            });
            drivers = driversData.list || [];
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

        const payload = {
            cliente_nome: data.cliente_nome || 'Cliente Manual',
            telefone_cliente: data.telefone_cliente || '00000000000',
            itens: data.itens,
            valor_total: data.valor_total,
            status: 'pendente',
            canal: 'Painel',
            tipo_entrega: 'retirada',
            empresa_id: user.empresaId,
            criado_em: new Date().toISOString(),
        };

        const result = await pg.create(PEDIDOS_TABLE, payload);

        revalidatePath('/dashboard/expedition');
        return result;
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

        const orderData = await pg.findById(PEDIDOS_TABLE, id) as any;

        if (!orderData || Number(orderData.empresa_id) !== Number(user.empresaId)) {
            logger.securityAccessDenied(user.empresaId, `order:${id}`, 'UPDATE_STATUS');
            throw new Error('Acesso negado: Pedido não pertence a esta empresa');
        }

        const updatePayload: any = { id, status };

        if (status === 'cancelado' && motivo) {
            const nowStr = new Date().toLocaleString('pt-BR');
            updatePayload.observacoes = orderData.observacoes
                ? `${orderData.observacoes}\n❌ CANCELADO (${nowStr}): ${motivo}`
                : `❌ CANCELADO (${nowStr}): ${motivo}`;
        }

        if (status === 'finalizado') {
            try {
                if (orderData.telefone_cliente) {
                    const client = await pg.findOne(CLIENTES_TABLE, {
                        where: { empresa_id: user.empresaId, telefone: orderData.telefone_cliente },
                    }) as any;

                    if (client) {
                        const nowIso = new Date().toISOString();
                        try {
                            await pg.update(CLIENTES_TABLE, {
                                id: client.id,
                                ultima_compra: nowIso,
                            });
                        } catch (updateErr: any) {
                            if (updateErr.message?.includes('date') || updateErr.message?.includes('time')) {
                                console.warn('[Orders] Formato de data invalido, ignorando atualizacao');
                            } else {
                                throw updateErr;
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('Erro ao atualizar dados do cliente:', err);
            }
        }

        const result = await pg.update(PEDIDOS_TABLE, updatePayload);

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
        return result;
    } catch (error: any) {
        console.error('API Error:', error);
        throw new Error(error.message || 'Failed to update order status');
    }
}

export async function deduzirInsumosDoPedido(orderId: number) {
    try {
        const user = await getMe();
        if (!user?.empresaId) return;

        const company = await pg.findById(EMPRESAS_TABLE, user.empresaId) as any;

        const isEstoqueAtivo = company?.controle_estoque === true ||
            company?.controle_estoque === 1 ||
            String(company?.controle_estoque).toLowerCase() === 'true';

        if (!isEstoqueAtivo) {
            console.log(`Controle de estoque desativado para empresa ${user.empresaId}. Pulando dedução.`);
            return;
        }

        const order = await pg.findById(PEDIDOS_TABLE, orderId) as any;

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

        const company = await pg.findById(EMPRESAS_TABLE, user.empresaId) as any;

        const isEstoqueAtivo = company?.controle_estoque === true ||
            company?.controle_estoque === 1 ||
            String(company?.controle_estoque).toLowerCase() === 'true';

        if (!isEstoqueAtivo) {
            return { hasEnough: true, shortages: [] };
        }

        const order = await pg.findById(PEDIDOS_TABLE, orderId) as any;

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

        const shortages: any[] = [];
        necessidades.forEach((need, insumoId) => {
            if (need.total > need.disponivel) {
                shortages.push({
                    insumoId,
                    nome: need.nome,
                    necessario: need.total,
                    disponivel: need.disponivel,
                    faltando: need.total - need.disponivel,
                    unidade: need.unidade
                });
            }
        });

        return {
            hasEnough: shortages.length === 0,
            shortages,
            cliente: { nome: order.cliente_nome, telefone: order.telefone_cliente }
        };
    } catch (error) {
        console.error('Erro ao verificar estoque do pedido:', error);
        return { hasEnough: true, shortages: [] };
    }
}

export async function getOrderById(id: number) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const order = await pg.findById(PEDIDOS_TABLE, id) as any;

        if (!order || Number(order.empresa_id) !== Number(user.empresaId)) {
            throw new Error('Pedido não encontrado ou acesso negado');
        }

        return order;
    } catch (error: any) {
        console.error('Erro ao buscar pedido:', error);
        throw new Error(error.message || 'Falha ao buscar pedido');
    }
}

export async function getOrdersForReport(startDate: string, endDate: string) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        // Para filtros de data complexos, usamos raw query
        const data = await pg.raw(`
            SELECT * FROM pedidos 
            WHERE empresa_id = $1 
            AND criado_em >= $2 
            AND criado_em <= $3 
            ORDER BY criado_em DESC
        `, [user.empresaId, startDate, endDate]);

        return data;
    } catch (error: any) {
        console.error('Erro ao buscar pedidos para relatório:', error);
        throw new Error(error.message || 'Falha ao buscar relatório');
    }
}

/**
 * Atualiza os itens de um pedido existente
 */
export async function updateOrderItems(
    orderId: number, 
    newItems: any[], 
    novoTotal: number,
    observacao?: string
) {
    try {
        const user = await requireRole(['admin', 'gerente', 'atendente']);

        const orderData = await pg.findById(PEDIDOS_TABLE, orderId) as any;

        if (!orderData || Number(orderData.empresa_id) !== Number(user.empresaId)) {
            logger.securityAccessDenied(user.empresaId, `order:${orderId}`, 'UPDATE_ITEMS');
            throw new Error('Acesso negado: Pedido nao pertence a esta empresa');
        }

        // Pedidos de mesa podem ficar "pronto" (inclusive no modo direto) e ainda
        // precisam ser editaveis enquanto a comanda estiver aberta.
        const statusEditaveis = ['pendente', 'preparando', 'aguardando_pagamento', 'pronto'];
        if (!statusEditaveis.includes(orderData.status)) {
            throw new Error(`Pedido com status "${orderData.status}" nao pode ser editado`);
        }

        const itensStr = JSON.stringify(newItems);
        const updatePayload: any = { 
            id: orderId, 
            itens: itensStr,
            valor_total: novoTotal
        };

        if (observacao) {
            const nowStr = new Date().toLocaleString('pt-BR');
            updatePayload.observacoes = orderData.observacoes
                ? `${orderData.observacoes}\n✏️ EDITADO (${nowStr}): ${observacao}`
                : `✏️ EDITADO (${nowStr}): ${observacao}`;
        }

        const result = await pg.update(PEDIDOS_TABLE, updatePayload);

        // Se for um pedido de mesa, recalcula o total da comanda para manter
        // o total da mesa (e o valor cobrado no fechamento) sincronizado.
        if (orderData.comanda_id) {
            try {
                const pedidosComanda = await pg.query(
                    `SELECT valor_total FROM pedidos WHERE comanda_id = $1 AND status != 'cancelado'`,
                    [orderData.comanda_id]
                );
                const totalComanda = (pedidosComanda.rows || []).reduce(
                    (sum: number, p: any) => sum + Number(p.valor_total || 0),
                    0
                );
                await pg.update('comandas', orderData.comanda_id, { total: totalComanda });
            } catch (comandaErr) {
                console.error('Erro ao recalcular total da comanda:', comandaErr);
            }
            revalidatePath('/dashboard/mesas');
        }

        const valorAntigo = Number(orderData.valor_total || 0).toFixed(2);
        const valorNovo = novoTotal.toFixed(2);
        await logAction(
            'UPDATE_ORDER_ITEMS', 
            `Pedido #${orderId} editado. Valor: R$ ${valorAntigo} -> R$ ${valorNovo}. Itens: ${newItems.length}`
        );

        revalidatePath('/dashboard/expedition');

        return { success: true, order: result };
    } catch (error: any) {
        console.error('Erro ao atualizar itens do pedido:', error);
        throw new Error(error.message || 'Falha ao atualizar pedido');
    }
}

/**
 * Adiciona um valor extra ao pedido
 */
export async function addExtraValueToOrder(
    orderId: number,
    nome: string,
    valor: number
) {
    try {
        const user = await requireRole(['admin', 'gerente', 'atendente', 'cozinheiro']);

        if (!nome?.trim()) {
            throw new Error('Nome do item é obrigatório');
        }

        if (!valor || valor <= 0) {
            throw new Error('Valor deve ser maior que zero');
        }

        const orderData = await pg.findById(PEDIDOS_TABLE, orderId) as any;

        if (!orderData || Number(orderData.empresa_id) !== Number(user.empresaId)) {
            logger.securityAccessDenied(user.empresaId, `order:${orderId}`, 'ADD_EXTRA_VALUE');
            throw new Error('Acesso negado: Pedido não pertence a esta empresa');
        }

        let itensAtuais: any[] = [];
        try {
            itensAtuais = typeof orderData.itens === 'string' 
                ? JSON.parse(orderData.itens) 
                : (orderData.itens || []);
        } catch {
            itensAtuais = [];
        }

        const novoItem = {
            id: `extra_${Date.now()}`,
            produto: nome.trim(),
            nome: nome.trim(),
            quantidade: 1,
            preco_unitario: valor,
            subtotal: valor,
            isExtra: true,
        };

        itensAtuais.push(novoItem);

        const valorAtual = Number(orderData.valor_total) || 0;
        const novoTotal = valorAtual + valor;

        const result = await pg.update(PEDIDOS_TABLE, {
            id: orderId,
            itens: JSON.stringify(itensAtuais),
            valor_total: novoTotal,
        });

        await logAction('ADD_EXTRA_VALUE', `Valor extra adicionado ao pedido #${orderId}: ${nome} - R$ ${valor.toFixed(2)}`);

        revalidatePath('/dashboard/expedition');
        revalidatePath('/dashboard/tables');
        
        return { 
            success: true, 
            novoTotal,
            itemAdicionado: novoItem,
        };
    } catch (error: any) {
        console.error('Erro ao adicionar valor extra:', error);
        throw new Error(error.message || 'Falha ao adicionar valor extra');
    }
}
