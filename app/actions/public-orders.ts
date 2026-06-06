'use server';

import { revalidatePath } from 'next/cache';
import { incrementCouponUsage } from './coupons';
import { deductPointsForOrder } from './loyalty';
import { sendOrderCreatedMessage, sendOwnerNewOrderMessage } from './whatsapp';
import { pg } from '@/lib/postgres';

interface OrderItem {
    id: number;
    nome: string;
    preco: number;
    quantidade: number;
    complementos?: {
        grupoId: number;
        grupoNome: string;
        items: {
            id: number;
            nome: string;
            preco: number;
            fator_proporcao: number;
        }[];
    }[];
}

interface CreatePublicOrderData {
    empresaId: number;
    clienteTelefone: string;
    clienteNome: string;
    clienteEndereco?: string;
    clienteBairro?: string;
    tipoEntrega: 'delivery' | 'retirada';
    taxaEntrega?: number;
    itens: OrderItem[];
    subtotal: number;
    desconto: number;
    total: number;
    cupomCodigo?: string;
    cupomId?: number | string;
    pontosGanhos: number;
    pontosUsados?: number;
    descontoPontos?: number;
    formaPagamento: 'pix' | 'dinheiro' | 'cartao';
    troco?: number;
    observacoes?: string;
    dataAgendamento?: string | null;
    pagamentoIntegrado?: boolean;
}

export async function checkCustomerByPhone(empresaId: number, telefone: string) {
    try {
        const cleanPhone = telefone.replace(/\D/g, '');

        const phoneVariations = [
            cleanPhone,
            cleanPhone.slice(-11),
            cleanPhone.slice(-10),
            '55' + cleanPhone,
        ];

        for (const phone of phoneVariations) {
            const data = await pg.query(
                `SELECT * FROM clientes WHERE empresa_id = $1 AND telefone LIKE $2 LIMIT 1`,
                [empresaId, `%${phone}%`]
            );

            if (data.rows && data.rows.length > 0) {
                return data.rows[0];
            }
        }

        // Última tentativa: buscar todos e filtrar manualmente
        const allClientsData = await pg.list('clientes', {
            where: { empresa_id: empresaId },
            limit: 1000,
        });
        const allClients = allClientsData.list || [];

        const found = allClients.find((c: any) => {
            const clientPhone = (c.telefone || '').replace(/\D/g, '');
            return phoneVariations.some(p => clientPhone.includes(p) || p.includes(clientPhone));
        });

        return found || null;
    } catch (error) {
        console.error('Erro ao verificar cliente:', error);
        return null;
    }
}

async function ensureCliente(empresaId: number, telefone: string, nome: string, endereco?: string, bairro?: string) {
    try {
        const data = await pg.list('clientes', {
            where: { empresa_id: empresaId, telefone },
        });

        if (data.list && data.list.length > 0) {
            const existing = data.list[0] as any;
            await pg.update('clientes', existing.id, {
                nome: nome || existing.nome,
                endereco: endereco || existing.endereco,
                bairro_entrega: bairro || existing.bairro_entrega,
            });
            return existing.id;
        } else {
            const created = await pg.create('clientes', {
                empresa_id: empresaId,
                nome: nome || 'Cliente Cardápio',
                telefone,
                endereco: endereco || '',
                bairro_entrega: bairro || '',
            }) as any;
            return created.id;
        }
    } catch (error) {
        console.error('Erro ao garantir cliente:', error);
        return null;
    }
}

export async function createPublicOrder(data: CreatePublicOrderData) {
    try {
        if (!data.empresaId || !data.clienteTelefone || !data.itens?.length) {
            throw new Error('Dados incompletos para criar pedido');
        }

        await ensureCliente(
            data.empresaId,
            data.clienteTelefone,
            data.clienteNome,
            data.clienteEndereco,
            data.clienteBairro
        );

        const itensFormatados = data.itens.map((item: any) => {
            let produtoNome = item.nome || 'Produto';
            const tamanho = item.tamanho || '';

            if (tamanho && !produtoNome.toLowerCase().includes(tamanho.toLowerCase())) {
                produtoNome = `${produtoNome} (${tamanho})`;
            }

            if (item.complementos && item.complementos.length > 0) {
                const complementosStr = item.complementos
                    .map((c: any) => c.items.map((i: any) => i.nome).join(', '))
                    .join(' + ');
                if (complementosStr) {
                    produtoNome += ` (${complementosStr})`;
                }
            }

            return {
                produto: produtoNome,
                nome: produtoNome,
                quantidade: item.quantidade,
                preco: item.preco,
                subtotal: Number(item.preco) * Number(item.quantidade),
                observacao: item.observacao || '',
            };
        });

        const enderecoCompleto = data.tipoEntrega === 'retirada'
            ? 'Retirada no balcão'
            : [data.clienteEndereco, data.clienteBairro].filter(Boolean).join(', ') || '';

        const orderPayload: any = {
            empresa_id: data.empresaId,
            telefone_cliente: data.clienteTelefone,
            cliente_nome: data.clienteNome,
            tipo_entrega: data.tipoEntrega,
            taxa_entrega: data.taxaEntrega || 0,
            itens: JSON.stringify(itensFormatados),
            subtotal: data.subtotal,
            desconto: data.desconto || 0,
            valor_total: data.total,
            cupom_codigo: data.cupomCodigo || '',
            pontos_ganhos: data.pontosGanhos || 0,
            forma_pagamento: data.formaPagamento,
            tipo_pagamento: data.formaPagamento,
            troco_necessario: data.troco || 0,
            // Quando o pagamento integrado esta DESATIVADO, a loja recebe o pagamento por fora,
            // entao o pedido vai direto para o painel (Kanban) como 'pendente', sem etapa de cobranca online.
            // Quando ATIVADO, mantem o comportamento anterior: dinheiro vai direto, demais aguardam pagamento.
            status: data.dataAgendamento
                ? 'agendado'
                : (data.pagamentoIntegrado === false || data.formaPagamento === 'dinheiro'
                    ? 'pendente'
                    : 'pagamento_pendente'),
            origem: 'cardapio_publico',
            criado_em: new Date().toISOString(),
            endereco_entrega: enderecoCompleto,
            bairro_entrega: data.tipoEntrega === 'retirada' ? '' : (data.clienteBairro || ''),
        };

        if (data.dataAgendamento) {
            orderPayload.data_agendamento = data.dataAgendamento;
            orderPayload.observacoes = data.observacoes
                ? `${data.observacoes}\n📅 Agendado para: ${new Date(data.dataAgendamento).toLocaleString('pt-BR')}`
                : `📅 Agendado para: ${new Date(data.dataAgendamento).toLocaleString('pt-BR')}`;
        }

        if (data.tipoEntrega === 'delivery' && enderecoCompleto && enderecoCompleto !== 'Retirada no balcão') {
            orderPayload.observacoes = data.observacoes
                ? `${data.observacoes}\n📍 Endereço: ${enderecoCompleto}`
                : `📍 Endereço: ${enderecoCompleto}`;
        }

        console.log('[createPublicOrder] Payload being sent:', {
            endereco_entrega: orderPayload.endereco_entrega,
            bairro_entrega: orderPayload.bairro_entrega,
            tipo_entrega: orderPayload.tipo_entrega,
            observacoes: orderPayload.observacoes,
        });

        const order = await pg.create('pedidos', orderPayload) as any;

        if (data.cupomId) {
            incrementCouponUsage(data.cupomId).catch(err =>
                console.error('Erro ao incrementar uso do cupom:', err)
            );
        }

        if (data.pontosUsados && data.pontosUsados > 0) {
            deductPointsForOrder(
                data.clienteTelefone.replace(/\D/g, ''),
                data.pontosUsados
            ).catch(err => console.error('Erro ao deduzir pontos:', err));
        }

        sendOrderCreatedMessage(data.clienteTelefone, order.id, data.total, data.dataAgendamento, itensFormatados, data.empresaId)
            .catch(err => console.error('Erro ao enviar mensagem WhatsApp:', err));

        // Avisar o DONO da loja sobre o novo pedido (opt-in), pelo numero central da ZapFlow.
        // Best-effort: nunca bloqueia ou derruba a criacao do pedido.
        notifyOwnerNewOrder(data, order.id, itensFormatados, enderecoCompleto)
            .catch(err => console.error('Erro ao notificar dono sobre novo pedido:', err));

        revalidatePath('/dashboard/expedition');

        return {
            success: true,
            orderId: order.id,
            message: 'Pedido criado com sucesso!',
        };
    } catch (error: any) {
        console.error('Erro ao criar pedido público:', error);
        throw new Error(error.message || 'Erro ao criar pedido');
    }
}

/**
 * Notifica o dono da loja sobre um novo pedido do cardapio online.
 * - Opt-in: so envia se empresa.notificar_pedido_whatsapp = true
 * - Destino: telefone_loja da empresa
 * - Remetente: numero central da ZapFlow (zapflow_ativacao)
 */
async function notifyOwnerNewOrder(
    data: CreatePublicOrderData,
    orderId: number,
    itensFormatados: any[],
    enderecoCompleto: string,
) {
    try {
        const empresa = await pg.findById('empresas', data.empresaId) as any;
        if (!empresa) return;

        const ativado = empresa.notificar_pedido_whatsapp === true;
        const ownerPhone = (empresa.telefone_loja || '').toString().trim();
        if (!ativado || !ownerPhone) return;

        const pagamentoLabel: Record<string, string> = {
            pix: 'PIX',
            dinheiro: 'Dinheiro',
            cartao: 'Cartão',
        };

        await sendOwnerNewOrderMessage({
            ownerPhone,
            orderId,
            total: data.total,
            clienteNome: data.clienteNome,
            clienteTelefone: data.clienteTelefone,
            isDelivery: data.tipoEntrega === 'delivery',
            endereco: enderecoCompleto,
            itens: itensFormatados,
            pagamento: pagamentoLabel[data.formaPagamento] || data.formaPagamento,
            observacoes: data.observacoes,
        });
    } catch (err) {
        console.error('[notifyOwnerNewOrder] Falha:', err);
    }
}

export async function checkOrderStatus(orderId: number) {
    try {
        const order = await pg.findById('pedidos', orderId) as any;
        if (!order) return null;

        return {
            id: order.id,
            status: order.status,
            valor_total: order.valor_total,
            criado_em: order.criado_em,
        };
    } catch (error) {
        console.error('Erro ao verificar status:', error);
        return null;
    }
}

export async function getOrderStatus(orderId: number) {
    try {
        const order = await pg.findById('pedidos', orderId) as any;
        return order?.status || null;
    } catch (error) {
        console.error('Erro ao buscar status do pedido:', error);
        return null;
    }
}

export async function updateOrderStatusPublic(orderId: number, status: string) {
    try {
        await pg.update('pedidos', orderId, { status });
        revalidatePath('/dashboard/expedition');
        return { success: true };
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        throw new Error('Erro ao atualizar status');
    }
}

export async function confirmPayment(orderId: number) {
    return updateOrderStatusPublic(orderId, 'pendente');
}

export async function cancelUnpaidOrder(orderId: number) {
    return updateOrderStatusPublic(orderId, 'cancelado');
}
