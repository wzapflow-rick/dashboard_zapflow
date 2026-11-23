'use server';

import { notifyNewOrder } from '@/lib/push';
import { revalidatePath } from 'next/cache';
import { incrementCouponUsage } from './coupons';
import { sendOrderCreatedMessage, sendOwnerNewOrderMessage } from '@/lib/whatsapp';
import { pg } from '@/lib/postgres';
import { getMe } from '@/lib/session-server';
import { calculatePublicOrderPricing } from './public-order-pricing';

interface OrderItem {
    id: number;
    nome: string;
    preco: number;
    quantidade: number;
    tamanho?: string;
    isComposite?: boolean;
    sabores?: number[];
    observacao?: string;
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
    let redeemedPoints: { empresaId: number; telefone: string; points: number } | null = null;
    let orderCreated = false;
    try {
        if (!data.empresaId || !data.clienteTelefone || !data.itens?.length) {
            throw new Error('Dados incompletos para criar pedido');
        }

        const empresa = await pg.findById('empresas', data.empresaId) as any;
        if (!empresa) {
            throw new Error('Empresa não encontrada');
        }

        if (data.formaPagamento === 'dinheiro' && empresa.aceita_dinheiro === false) {
            throw new Error('Esta loja não aceita pagamento em dinheiro');
        }

        const pricing = await calculatePublicOrderPricing({
            empresaId: Number(data.empresaId),
            telefone: data.clienteTelefone,
            itens: data.itens,
            cupomCodigo: data.cupomCodigo,
            pontosUsados: data.pontosUsados,
        });

        const tipoEntregaEfetivo: 'delivery' | 'retirada' =
            data.tipoEntrega === 'delivery' && empresa.aceita_delivery !== false
                ? 'delivery'
                : 'retirada';
        const taxaEntregaEfetiva = tipoEntregaEfetivo === 'delivery'
            ? Math.max(0, Number(data.taxaEntrega) || 0)
            : 0;
        const clienteEnderecoEfetivo = tipoEntregaEfetivo === 'delivery'
            ? data.clienteEndereco
            : undefined;
        const clienteBairroEfetivo = tipoEntregaEfetivo === 'delivery'
            ? data.clienteBairro
            : undefined;
        const subtotalEfetivo = pricing.subtotal;
        const descontoEfetivo = pricing.discount;
        const telefonePontos = data.clienteTelefone.replace(/\D/g, '');
        if (pricing.pointsUsed > 0) {
            const redemption = await pg.raw<any>(
                `UPDATE "loyalty_points"
                 SET pontos_acumulados = COALESCE(pontos_acumulados, 0) - $3
                 WHERE empresa_id = $1 AND cliente_telefone = $2
                   AND COALESCE(pontos_acumulados, 0) >= $3
                   AND COALESCE(pontos_acumulados, 0) - COALESCE(pontos_gastos, 0) >= $3
                 RETURNING id`,
                [Number(data.empresaId), telefonePontos, pricing.pointsUsed]
            );
            if (!redemption?.length) throw new Error('Os pontos acabaram de ser utilizados. Atualize o carrinho.');
            redeemedPoints = { empresaId: Number(data.empresaId), telefone: telefonePontos, points: pricing.pointsUsed };
        }
        const totalEfetivo = Math.max(
            0,
            subtotalEfetivo - descontoEfetivo + taxaEntregaEfetiva
        );
        const dadosEfetivos: CreatePublicOrderData = {
            ...data,
            itens: pricing.itens,
            cupomId: pricing.couponId,
            cupomCodigo: pricing.couponCode,
            pontosUsados: pricing.pointsUsed,
            descontoPontos: pricing.pointsDiscount,
            pontosGanhos: pricing.pointsEarned,
            subtotal: subtotalEfetivo,
            desconto: descontoEfetivo,
            tipoEntrega: tipoEntregaEfetivo,
            taxaEntrega: taxaEntregaEfetiva,
            clienteEndereco: clienteEnderecoEfetivo,
            clienteBairro: clienteBairroEfetivo,
            total: totalEfetivo,
        };

        await ensureCliente(
            dadosEfetivos.empresaId,
            dadosEfetivos.clienteTelefone,
            dadosEfetivos.clienteNome,
            dadosEfetivos.clienteEndereco,
            dadosEfetivos.clienteBairro
        );

        const itensFormatados = dadosEfetivos.itens.map((item: any) => {
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

        const enderecoCompleto = dadosEfetivos.tipoEntrega === 'retirada'
            ? 'Retirada no balcão'
            : [dadosEfetivos.clienteEndereco, dadosEfetivos.clienteBairro].filter(Boolean).join(', ') || '';

        const orderPayload: any = {
            empresa_id: dadosEfetivos.empresaId,
            telefone_cliente: dadosEfetivos.clienteTelefone,
            cliente_nome: dadosEfetivos.clienteNome,
            tipo_entrega: dadosEfetivos.tipoEntrega,
            taxa_entrega: dadosEfetivos.taxaEntrega || 0,
            itens: JSON.stringify(itensFormatados),
            subtotal: dadosEfetivos.subtotal,
            desconto: dadosEfetivos.desconto || 0,
            valor_total: dadosEfetivos.total,
            cupom_codigo: dadosEfetivos.cupomCodigo || '',
            pontos_ganhos: dadosEfetivos.pontosGanhos || 0,
            forma_pagamento: dadosEfetivos.formaPagamento,
            tipo_pagamento: dadosEfetivos.formaPagamento,
            troco_necessario: dadosEfetivos.troco || 0,
            // Quando o pagamento integrado esta DESATIVADO, a loja recebe o pagamento por fora,
            // entao o pedido vai direto para o painel (Kanban) como 'pendente', sem etapa de cobranca online.
            // Quando ATIVADO, mantem o comportamento anterior: dinheiro vai direto, demais aguardam pagamento.
            status: dadosEfetivos.dataAgendamento
                ? 'agendado'
                : (dadosEfetivos.pagamentoIntegrado === false || dadosEfetivos.formaPagamento === 'dinheiro'
                    ? 'pendente'
                    : 'pagamento_pendente'),
            origem: 'cardapio_publico',
            criado_em: new Date().toISOString(),
            endereco_entrega: enderecoCompleto,
            bairro_entrega: dadosEfetivos.tipoEntrega === 'retirada' ? '' : (dadosEfetivos.clienteBairro || ''),
        };

        if (dadosEfetivos.dataAgendamento) {
            orderPayload.data_agendamento = dadosEfetivos.dataAgendamento;
            orderPayload.observacoes = dadosEfetivos.observacoes
                ? `${dadosEfetivos.observacoes}\n📅 Agendado para: ${new Date(dadosEfetivos.dataAgendamento).toLocaleString('pt-BR')}`
                : `📅 Agendado para: ${new Date(dadosEfetivos.dataAgendamento).toLocaleString('pt-BR')}`;
        }

        if (dadosEfetivos.tipoEntrega === 'delivery' && enderecoCompleto && enderecoCompleto !== 'Retirada no balcão') {
            orderPayload.observacoes = dadosEfetivos.observacoes
                ? `${dadosEfetivos.observacoes}\n📍 Endereço: ${enderecoCompleto}`
                : `📍 Endereço: ${enderecoCompleto}`;
        }

        console.log('[createPublicOrder] Payload being sent:', {
            endereco_entrega: orderPayload.endereco_entrega,
            bairro_entrega: orderPayload.bairro_entrega,
            tipo_entrega: orderPayload.tipo_entrega,
            observacoes: orderPayload.observacoes,
        });

        const order = await pg.create('pedidos', orderPayload) as any;
        orderCreated = true;
        redeemedPoints = null;

        if (pricing.couponId) {
            incrementCouponUsage(pricing.couponId).catch(err =>
                console.error('Erro ao incrementar uso do cupom:', err)
            );
        }

        sendOrderCreatedMessage(dadosEfetivos.clienteTelefone, order.id, dadosEfetivos.total, dadosEfetivos.dataAgendamento, itensFormatados, dadosEfetivos.empresaId)
            .catch(err => console.error('Erro ao enviar mensagem WhatsApp:', err));

        // Avisar o DONO da loja sobre o novo pedido (opt-in), pelo numero central da ZapFlash.
        // Best-effort: nunca bloqueia ou derruba a criacao do pedido.
        notifyOwnerNewOrder(dadosEfetivos, order.id, itensFormatados, enderecoCompleto)
            .catch(err => console.error('Erro ao notificar dono sobre novo pedido:', err));

        notifyNewOrder(Number(dadosEfetivos.empresaId), {
            id: order.id,
            clienteNome: dadosEfetivos.clienteNome,
            total: dadosEfetivos.total,
        });

        revalidatePath('/dashboard/expedition');

        return {
            success: true,
            orderId: order.id,
            message: 'Pedido criado com sucesso!',
        };
    } catch (error: any) {
        if (redeemedPoints && !orderCreated) {
            try {
                await pg.raw<any>(
                    `UPDATE "loyalty_points"
                     SET pontos_acumulados = COALESCE(pontos_acumulados, 0) + $3
                     WHERE empresa_id = $1 AND cliente_telefone = $2`,
                    [redeemedPoints.empresaId, redeemedPoints.telefone, redeemedPoints.points]
                );
            } catch (rollbackError) {
                console.error('Erro ao restaurar pontos após falha no pedido:', rollbackError);
            }
        }
        console.error('Erro ao criar pedido público:', error);
        throw new Error(error.message || 'Erro ao criar pedido');
    }
}

/**
 * Notifica o dono da loja sobre um novo pedido do cardapio online.
 * - Opt-in: so envia se empresa.notificar_pedido_whatsapp = true
 * - Destino: telefone_loja da empresa
 * - Remetente: numero central da ZapFlash (zapflow_ativacao)
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
    const user = await getMe();
    if (!user?.empresaId) {
        throw new Error('Nao autorizado');
    }
    try {
        const order = await pg.findById('pedidos', orderId) as any;
        if (!order || Number(order.empresa_id) !== Number(user.empresaId)) {
            throw new Error('Pedido nao encontrado');
        }
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
