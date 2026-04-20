'use server';

import { noco } from '@/lib/nocodb';
import { PEDIDOS_TABLE_ID } from '@/lib/constants';

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';
const MP_PUBLIC_KEY = process.env.MP_PUBLIC_KEY || '';

interface PedidoData {
    id: number;
    valor_total: number;
    cliente_nome: string;
    telefone_cliente: string;
    itens: string;
    empresa_id: number;
}

interface MPPaymentResponse {
    id: number;
    status: string;
    status_detail: string;
    transaction_details?: {
        total_paid_amount: number;
    };
    point_of_interaction?: {
        transaction_data?: {
            qr_code?: string;
            qr_code_base64?: string;
            ticket_url?: string;
        };
    };
}

export async function getMPPublicKey(): Promise<string> {
    return MP_PUBLIC_KEY;
}

export async function getOrderPaymentId(orderId: number): Promise<string | null> {
    try {
        const order = await noco.findById(PEDIDOS_TABLE_ID, orderId) as any;
        return order?.payment_id ? String(order.payment_id) : null;
    } catch (error) {
        console.error('[MercadoPago] Erro ao buscar payment_id do pedido:', error);
        return null;
    }
}

export interface CreatePaymentInput {
    pedidoId: number;
    paymentMethodId: string;
    token?: string;
    issuerId?: string;
    installationTerms?: number;
}

export interface CreatePaymentResult {
    success: boolean;
    paymentId?: number;
    status?: string;
    statusDetail?: string;
    qrCode?: string;
    qrCodeBase64?: string;
    ticketUrl?: string;
    error?: string;
}

export async function createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    try {
        const { pedidoId, paymentMethodId, token, issuerId, installationTerms } = input;

        const pedido = await noco.findById(PEDIDOS_TABLE_ID, pedidoId) as PedidoData;

        if (!pedido) {
            return { success: false, error: 'Pedido não encontrado' };
        }

        const amount = Number(pedido.valor_total);

        console.log('[MercadoPago] valor_total do pedido:', pedido.valor_total);
        console.log('[MercadoPago] amount convertido:', amount, 'tipo:', typeof amount);

        if (!amount || amount <= 0 || isNaN(amount)) {
            return { success: false, error: 'Valor do pedido inválido' };
        }

        const validAmount = Math.round(amount * 100) / 100;

        const nomePartes = (pedido.cliente_nome || 'Cliente Desconhecido').trim().split(' ');
        const firstName = nomePartes[0] || 'Cliente';
        const lastName = nomePartes.slice(1).join(' ') || 'Cardapio';

        const paymentPayload: Record<string, unknown> = {
            transaction_amount: validAmount,
            description: `Pedido #${pedidoId} - ${pedido.cliente_nome || 'Cliente'}`,
            external_reference: String(pedidoId),
            payer: {
                email: pedido.telefone_cliente
                    ? `${pedido.telefone_cliente.replace(/\D/g, '')}@cliente.zapflow.com`
                    : 'cliente@zapflow.com',
                first_name: firstName,
                last_name: lastName,
            },
        };

        if (paymentMethodId === 'pix') {
            paymentPayload.payment_method_id = 'pix';
            paymentPayload.installments = 1;
        } else if (token) {
            paymentPayload.payment_method_id = paymentMethodId === 'credit_card' ? 'master' : paymentMethodId;
            paymentPayload.token = token;
            paymentPayload.installments = installationTerms || 1;
            if (issuerId) {
                paymentPayload.issuer_id = issuerId;
            }
        } else {
            paymentPayload.payment_method_id = paymentMethodId;
            paymentPayload.installments = 1;
        }

        const idempotencyKey = `${pedidoId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
                'X-Idempotency-Key': idempotencyKey,
            },
            body: JSON.stringify(paymentPayload),
        });

        if (!mpResponse.ok) {
            const errorData = await mpResponse.json();
            console.error('[MercadoPago] Erro ao criar payment:', JSON.stringify({
                status: mpResponse.status,
                error: errorData,
                amount: amount,
                paymentPayload: paymentPayload
            }, null, 2));
            return {
                success: false,
                error: errorData.message || errorData.error || 'Erro ao processar pagamento'
            };
        }

        const mpPayment = await mpResponse.json() as MPPaymentResponse;

        await noco.update(PEDIDOS_TABLE_ID, {
            id: pedidoId,
            payment_id: String(mpPayment.id),
            status_pagamento: mpPayment.status === 'approved' ? 'aprovado' : 'pendente',
        });

        console.log(`[MercadoPago] Payment criado: ${mpPayment.id}, status: ${mpPayment.status}`);
        console.log('[MercadoPago] Payment response:', JSON.stringify(mpPayment, null, 2));

        return {
            success: true,
            paymentId: mpPayment.id,
            status: mpPayment.status,
            statusDetail: mpPayment.status_detail,
            qrCode: mpPayment.point_of_interaction?.transaction_data?.qr_code,
            qrCodeBase64: mpPayment.point_of_interaction?.transaction_data?.qr_code_base64,
            ticketUrl: mpPayment.point_of_interaction?.transaction_data?.ticket_url,
        };
    } catch (error: any) {
        console.error('[MercadoPago] Erro:', error);
        return { success: false, error: error.message || 'Erro interno' };
    }
}

export async function getPaymentStatus(paymentId: number): Promise<{
    success: boolean;
    status?: string;
    statusDetail?: string;
    error?: string;
}> {
    try {
        const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: {
                'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
            },
        });

        if (!mpResponse.ok) {
            return { success: false, error: 'Erro ao buscar pagamento' };
        }

        const payment = await mpResponse.json() as MPPaymentResponse;

        return {
            success: true,
            status: payment.status,
            statusDetail: payment.status_detail,
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
