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
import { getErrorMessage } from '@/lib/errors';
import {
  type ClienteRow,
  type ComplementoPedido,
  type EmpresaEstoqueRow,
  type EntregadorRow,
  type PedidoItem,
  type PedidoRow,
  isControleEstoqueAtivo,
  parsePedidoItens,
} from '@/lib/types/domain';
import type { Insumo } from './insumos';

export interface OrderWithClient {
    id: number;
    status: string;
    valor_total: PedidoRow['valor_total'];
    criado_em: PedidoRow['criado_em'];
    telefone_cliente: string | null;
    endereco_entrega: string;
    bairro_entrega: string;
    tipo_entrega: string;
    entregador_id: PedidoRow['entregador_id'];
    itens: PedidoRow['itens'];
    cupom_id: PedidoRow['cupom_id'];
    canal: string;
    nome_cliente: string | null;
    is_recorrente: boolean;
    entregador_nome: string | null;
    entregador_telefone: string | null;
    entregador_veiculo: string | null;
}

export interface FaltaInsumo {
    insumoId: number;
    nome: string;
    necessario: number;
    disponivel: number;
    faltando: number;
    unidade: string;
}

function groupComplementsByGrupo(complements: ComplementoPedido[]): Map<number, ComplementoPedido[]> {
    const groups = new Map<number, ComplementoPedido[]>();
    for (const c of complements) {
        if (!c.id) continue;
        const gId = Number(c.grupo_id) || 0;
        const list = groups.get(gId) ?? [];
        list.push(c);
        groups.set(gId, list);
    }
    return groups;
}

interface NecessidadeInsumo {
    nome: string;
    total: number;
    disponivel: number;
    unidade: string;
}

// Rate limiting para atualização de status
const orderUpdateAttempts = new Map<string, { count: number; lastAttempt: number }>();

/**
 * Retorna apenas os IDs dos pedidos pendentes da empresa. Query única e enxuta,
 * usada pelo polling do header (a cada 15s) para contar pendentes e detectar
 * novos pedidos. Antes o header chamava getOrders(), que trazia até 3 tabelas
 * inteiras (pedidos + clientes + entregadores, até 1000 linhas cada) só para
 * depois filtrar os pendentes em memória.
 */
export async function getPendingOrderIds(): Promise<number[]> {
    try {
        const user = await getMe();
        if (!user?.empresaId) return [];

        const rows = await pg.raw<{ id: number }>(
            `SELECT id FROM "${PEDIDOS_TABLE}"
             WHERE empresa_id = $1 AND status = 'pendente'
             ORDER BY id DESC`,
            [user.empresaId]
        );

        return rows.map((r) => Number(r.id));
    } catch (error) {
        console.error('[Orders] Erro ao buscar pedidos pendentes:', error);
        return [];
    }
}

export async function getOrders(): Promise<OrderWithClient[]> {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const ordersData = await pg.list<PedidoRow>(PEDIDOS_TABLE, {
            where: { empresa_id: user.empresaId },
            sort: '-id',
            limit: 1000,
        });
        const orders = ordersData.list || [];

        if (orders.length === 0) return [];

        const clientsData = await pg.list<ClienteRow>(CLIENTES_TABLE, {
            where: { empresa_id: user.empresaId },
            limit: 1000,
        });
        const clients = clientsData.list || [];

        let drivers: EntregadorRow[] = [];
        try {
            const driversData = await pg.list<EntregadorRow>(ENTREGADORES_TABLE, {
                where: { empresa_id: user.empresaId },
                limit: 1000,
            });
            drivers = driversData.list || [];
        } catch {
            drivers = [];
        }

        const clientsByPhone: Record<string, ClienteRow> = {};
        clients.forEach((c) => {
            if (c.telefone) clientsByPhone[String(c.telefone)] = c;
        });

        const driversById: Record<string, EntregadorRow> = {};
        drivers.forEach((d) => {
            if (d.id) driversById[String(d.id)] = d;
        });

        return orders.map((order): OrderWithClient => {
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

        const result = await pg.create<PedidoRow>(PEDIDOS_TABLE, payload);

        revalidatePath('/dashboard/expedition');
        return result;
    } catch (error) {
        console.error('Erro ao criar pedido manual:', error);
        throw new Error(getErrorMessage(error, 'Failed to create manual order'));
    }
}

export async function updateOrderStatus(id: number, status: string, motivo?: string) {
    try {
        const user = await requireRole(['admin', 'gerente', 'atendente', 'cozinheiro']);

        const validated = OrderStatusSchema.safeParse({ orderId: id, status });
        if (!validated.success) {
            const errorMsg = validated.error.issues.map((issue) => issue.message).join(', ');
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

        const orderData = await pg.findById<PedidoRow>(PEDIDOS_TABLE, id);

        if (!orderData || Number(orderData.empresa_id) !== Number(user.empresaId)) {
            logger.securityAccessDenied(user.empresaId, `order:${id}`, 'UPDATE_STATUS');
            throw new Error('Acesso negado: Pedido não pertence a esta empresa');
        }

        const updatePayload: { id: number; status: string; observacoes?: string } = { id, status };

        if (status === 'cancelado' && motivo) {
            const nowStr = new Date().toLocaleString('pt-BR');
            updatePayload.observacoes = orderData.observacoes
                ? `${orderData.observacoes}\n❌ CANCELADO (${nowStr}): ${motivo}`
                : `❌ CANCELADO (${nowStr}): ${motivo}`;
        }

        if (status === 'finalizado') {
            try {
                if (orderData.telefone_cliente) {
                    const client = await pg.findOne<ClienteRow>(CLIENTES_TABLE, {
                        where: { empresa_id: user.empresaId, telefone: orderData.telefone_cliente },
                    });

                    if (client) {
                        const nowIso = new Date().toISOString();
                        try {
                            await pg.update(CLIENTES_TABLE, {
                                id: client.id,
                                ultima_compra: nowIso,
                            });
                        } catch (updateErr) {
                            const updateMsg = getErrorMessage(updateErr, '');
                            if (updateMsg.includes('date') || updateMsg.includes('time')) {
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

        const result = await pg.update<PedidoRow>(PEDIDOS_TABLE, updatePayload);

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
            sendOrderStatusMessage(orderData.telefone_cliente, id, status, user.empresaId, orderData.tipo_entrega ?? undefined)
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
    } catch (error) {
        console.error('API Error:', error);
        throw new Error(getErrorMessage(error, 'Failed to update order status'));
    }
}

export async function deduzirInsumosDoPedido(orderId: number) {
    try {
        const user = await getMe();
        if (!user?.empresaId) return;

        const company = await pg.findById<EmpresaEstoqueRow>(EMPRESAS_TABLE, user.empresaId);

        if (!isControleEstoqueAtivo(company)) {
            console.log(`Controle de estoque desativado para empresa ${user.empresaId}. Pulando dedução.`);
            return;
        }

        const order = await pg.findById<PedidoRow>(PEDIDOS_TABLE, orderId);

        if (!order?.itens) return;

        const itens: PedidoItem[] = parsePedidoItens(order.itens);
        if (itens.length === 0) return;

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
                const basePromises = receitaProduto.map((r) => {
                    const totalADeduzir = Number(r.quantidade_necessaria) * quantidadeVendida;
                    return atualizarEstoqueInsumo(Number(r.insumo_id), -totalADeduzir);
                });
                await Promise.all(basePromises);
            }

            if (item.isComposite) {
                const complements = item.complements || [];
                if (Array.isArray(complements) && complements.length > 0) {
                    const groups = groupComplementsByGrupo(complements);

                    for (const [gId, itemsInGroup] of groups.entries()) {
                        if (gId > 0) {
                            const insumosDoGrupo = await getInsumosDoGrupo(gId);
                            if (insumosDoGrupo.length > 0) {
                                const grupoFixoPromises = insumosDoGrupo.map((r) => {
                                    const totalADeduzir = Number(r.quantidade_necessaria) * quantidadeVendida;
                                    return atualizarEstoqueInsumo(Number(r.insumo_id), -totalADeduzir);
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

                            const receitaItemBase = await getReceitaDoItemBase(Number(itemBase.id));
                            if (receitaItemBase && receitaItemBase.length > 0) {
                                const itemPromises = receitaItemBase.map((r) => {
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
                    const groups = groupComplementsByGrupo(complements);

                    for (const [gId, itemsInGroup] of groups.entries()) {
                        if (gId > 0) {
                            const insumosDoGrupo = await getInsumosDoGrupo(gId);
                            if (insumosDoGrupo.length > 0) {
                                const grupoFixoPromises = insumosDoGrupo.map((r) => {
                                    const totalADeduzir = Number(r.quantidade_necessaria) * quantidadeVendida;
                                    return atualizarEstoqueInsumo(Number(r.insumo_id), -totalADeduzir);
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

                            const receitaComp = await getReceitaDoComplemento(Number(comp.id));
                            if (receitaComp && receitaComp.length > 0) {
                                const compPromises = receitaComp.map((r) => {
                                    const totalADeduzir = Number(r.quantidade_necessaria) * proportion * quantidadeVendida;
                                    return atualizarEstoqueInsumo(Number(r.insumo_id), -totalADeduzir);
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

        const company = await pg.findById<EmpresaEstoqueRow>(EMPRESAS_TABLE, user.empresaId);

        if (!isControleEstoqueAtivo(company)) {
            return { hasEnough: true, shortages: [] };
        }

        const order = await pg.findById<PedidoRow>(PEDIDOS_TABLE, orderId);

        if (!order?.itens) return {
            hasEnough: true,
            shortages: [],
            cliente: { nome: order?.cliente_nome, telefone: order?.telefone_cliente }
        };

        const itens = parsePedidoItens(order.itens);
        if (itens.length === 0) return { hasEnough: true, shortages: [] };

        const currentInsumos = await getInsumos();
        const insumosMap = new Map<number, Insumo>(currentInsumos.map((i) => [Number(i.id), i]));

        const necessidades = new Map<number, NecessidadeInsumo>();

        for (const item of itens) {
            const produtoId = item.id;
            const quantidadeVendida = Number(item.quantidade) || 1;
            if (!produtoId) continue;

            const receitaProduto = await getReceitaDoProduto(produtoId);
            for (const r of receitaProduto) {
                const insumo = insumosMap.get(Number(r.insumo_id));
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
                    const receitaComp = await getReceitaDoComplemento(Number(comp.id));
                    for (const r of receitaComp) {
                        const insumo = insumosMap.get(Number(r.insumo_id));
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

        const shortages: FaltaInsumo[] = [];
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

        const order = await pg.findById<PedidoRow>(PEDIDOS_TABLE, id);

        if (!order || Number(order.empresa_id) !== Number(user.empresaId)) {
            throw new Error('Pedido não encontrado ou acesso negado');
        }

        return order;
    } catch (error) {
        console.error('Erro ao buscar pedido:', error);
        throw new Error(getErrorMessage(error, 'Falha ao buscar pedido'));
    }
}

export async function getOrdersForReport(startDate: string, endDate: string) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        // Para filtros de data complexos, usamos raw query
        const data = await pg.raw<PedidoRow>(`
            SELECT * FROM pedidos 
            WHERE empresa_id = $1 
            AND criado_em >= $2 
            AND criado_em <= $3 
            ORDER BY criado_em DESC
        `, [user.empresaId, startDate, endDate]);

        return data;
    } catch (error) {
        console.error('Erro ao buscar pedidos para relatório:', error);
        throw new Error(getErrorMessage(error, 'Falha ao buscar relatório'));
    }
}

/**
 * Atualiza os itens de um pedido existente
 */
export async function updateOrderItems(
    orderId: number, 
    newItems: PedidoItem[], 
    novoTotal: number,
    observacao?: string
) {
    try {
        const user = await requireRole(['admin', 'gerente', 'atendente']);

        const orderData = await pg.findById<PedidoRow>(PEDIDOS_TABLE, orderId);

        if (!orderData || Number(orderData.empresa_id) !== Number(user.empresaId)) {
            logger.securityAccessDenied(user.empresaId, `order:${orderId}`, 'UPDATE_ITEMS');
            throw new Error('Acesso negado: Pedido nao pertence a esta empresa');
        }

        // 'pronto' incluido para permitir editar itens de pedidos de mesa: no modo
        // "pedido direto" da mesa o pedido ja nasce como 'pronto', e a cozinha tambem
        // marca como 'pronto' antes do pagamento — ainda assim precisa ser editavel.
        const statusEditaveis = ['pendente', 'preparando', 'pronto', 'aguardando_pagamento'];
        if (!statusEditaveis.includes(orderData.status)) {
            throw new Error(`Pedido com status "${orderData.status}" nao pode ser editado`);
        }

        const itensStr = JSON.stringify(newItems);
        const updatePayload: { id: number; itens: string; valor_total: number; observacoes?: string } = { 
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

        const valorAntigo = Number(orderData.valor_total || 0).toFixed(2);
        const valorNovo = novoTotal.toFixed(2);
        await logAction(
            'UPDATE_ORDER_ITEMS', 
            `Pedido #${orderId} editado. Valor: R$ ${valorAntigo} -> R$ ${valorNovo}. Itens: ${newItems.length}`
        );

        revalidatePath('/dashboard/expedition');

        return { success: true, order: result };
    } catch (error) {
        console.error('Erro ao atualizar itens do pedido:', error);
        throw new Error(getErrorMessage(error, 'Falha ao atualizar pedido'));
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

        const orderData = await pg.findById<PedidoRow>(PEDIDOS_TABLE, orderId);

        if (!orderData || Number(orderData.empresa_id) !== Number(user.empresaId)) {
            logger.securityAccessDenied(user.empresaId, `order:${orderId}`, 'ADD_EXTRA_VALUE');
            throw new Error('Acesso negado: Pedido não pertence a esta empresa');
        }

        const itensAtuais = parsePedidoItens(orderData.itens);

        const novoItem: PedidoItem = {
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
    } catch (error) {
        console.error('Erro ao adicionar valor extra:', error);
        throw new Error(getErrorMessage(error, 'Falha ao adicionar valor extra'));
    }
}
