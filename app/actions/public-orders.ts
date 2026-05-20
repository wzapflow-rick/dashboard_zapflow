'use server';

import { revalidatePath } from 'next/cache';
import { incrementCouponUsage } from './coupons';
import { deductPointsForOrder } from './loyalty';
import { sendOrderCreatedMessage } from './whatsapp';
import { query } from '@/lib/db';

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
            const result = await query(
                `SELECT * FROM clientes WHERE empresa_id = $1 AND telefone LIKE $2 LIMIT 1`,
                [empresaId, `%${phone}%`]
            );

            if (result.rows && result.rows.length > 0) {
                return result.rows[0];
            }
        }

        // Ultima tentativa: buscar todos e filtrar manualmente
        const allClientsResult = await query(
            `SELECT * FROM clientes WHERE empresa_id = $1 LIMIT 1000`,
            [empresaId]
        );
        const allClients = allClientsResult.rows || [];

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
        const existingResult = await query(
            `SELECT * FROM clientes WHERE empresa_id = $1 AND telefone = $2 LIMIT 1`,
            [empresaId, telefone]
        );

        if (existingResult.rows && existingResult.rows.length > 0) {
            const existing = existingResult.rows[0];
            await query(
                `UPDATE clientes SET nome = $1, endereco = $2, bairro_entrega = $3 WHERE id = $4`,
                [nome || existing.nome, endereco || existing.endereco, bairro || existing.bairro_entrega, existing.id]
            );
            return existing.id;
        } else {
            const createResult = await query(
                `INSERT INTO clientes (empresa_id, nome, telefone, endereco, bairro_entrega)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id`,
                [empresaId, nome || 'Cliente Cardápio', telefone, endereco || '', bairro || '']
            );
            return createResult.rows[0]?.id;
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

        let observacoes = data.observacoes || '';
        
        if (data.dataAgendamento) {
            const agendamentoStr = `📅 Agendado para: ${new Date(data.dataAgendamento).toLocaleString('pt-BR')}`;
            observacoes = observacoes ? `${observacoes}\n${agendamentoStr}` : agendamentoStr;
        }

        if (data.tipoEntrega === 'delivery' && enderecoCompleto && enderecoCompleto !== 'Retirada no balcão') {
            const enderecoStr = `📍 Endereço: ${enderecoCompleto}`;
            observacoes = observacoes ? `${observacoes}\n${enderecoStr}` : enderecoStr;
        }

        const status = data.dataAgendamento ? 'agendado' : (data.formaPagamento === 'dinheiro' ? 'pendente' : 'pagamento_pendente');

        const orderResult = await query(
            `INSERT INTO pedidos (
                empresa_id, telefone_cliente, cliente_nome, tipo_entrega, taxa_entrega,
                itens, subtotal, desconto, valor_total, cupom_codigo, pontos_ganhos,
                forma_pagamento, tipo_pagamento, troco_necessario, status, origem,
                criado_em, endereco_entrega, bairro_entrega, observacoes, data_agendamento
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
            RETURNING *`,
            [
                data.empresaId,
                data.clienteTelefone,
                data.clienteNome,
                data.tipoEntrega,
                data.taxaEntrega || 0,
                JSON.stringify(itensFormatados),
                data.subtotal,
                data.desconto || 0,
                data.total,
                data.cupomCodigo || '',
                data.pontosGanhos || 0,
                data.formaPagamento,
                data.formaPagamento,
                data.troco || 0,
                status,
                'cardapio_publico',
                new Date().toISOString(),
                enderecoCompleto,
                data.tipoEntrega === 'retirada' ? '' : (data.clienteBairro || ''),
                observacoes,
                data.dataAgendamento || null
            ]
        );

        const order = orderResult.rows[0];

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

export async function checkOrderStatus(orderId: number) {
    try {
        const result = await query(
            `SELECT id, status, valor_total, criado_em FROM pedidos WHERE id = $1`,
            [orderId]
        );
        const order = result.rows[0];
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
        const result = await query(
            `SELECT status FROM pedidos WHERE id = $1`,
            [orderId]
        );
        return result.rows[0]?.status || null;
    } catch (error) {
        console.error('Erro ao buscar status do pedido:', error);
        return null;
    }
}

export async function updateOrderStatusPublic(orderId: number, status: string) {
    try {
        await query(
            `UPDATE pedidos SET status = $1 WHERE id = $2`,
            [status, orderId]
        );
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
