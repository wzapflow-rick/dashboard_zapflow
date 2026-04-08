'use server';

import { getMe } from './auth';

const NOCODB_URL = process.env.NOCODB_URL || 'https://db.wzapflow.com.br';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';
const MP_PUBLIC_KEY = process.env.MP_PUBLIC_KEY || '';

const ORDERS_TABLE_ID = 'm2ic8zof3feve3l'; // pedidos

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
    throw new Error(`NocoDB Error: ${res.status} ${text}`);
  }

  return res.json();
}

export async function getMPPublicKey(): Promise<string> {
  return MP_PUBLIC_KEY;
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

export async function createPayment(
  input: CreatePaymentInput
): Promise<CreatePaymentResult> {
  try {
    const { pedidoId, paymentMethodId, token, issuerId, installationTerms } = input;

    const pedido = await nocoFetch(ORDERS_TABLE_ID, `/records/${pedidoId}`) as PedidoData;

    if (!pedido) {
      return { success: false, error: 'Pedido não encontrado' };
    }

    const amount = Number(pedido.valor_total);

    const paymentPayload: Record<string, unknown> = {
      transaction_amount: amount,
      description: `Pedido #${pedidoId}`,
      payment_method_id: paymentMethodId,
      external_reference: String(pedidoId),
      payer: {
        email: pedido.telefone_cliente 
          ? `${pedido.telefone_cliente}@cliente.com` 
          : 'cliente@email.com',
      },
    };

    if (paymentMethodId === 'credit_card' && token) {
      paymentPayload.token = token;
      if (issuerId) {
        paymentPayload.issuer_id = issuerId;
      }
      if (installationTerms) {
        paymentPayload.installments = installationTerms;
      }
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
      console.error('[MercadoPago] Erro ao criar payment:', errorData);
      return { 
        success: false, 
        error: errorData.message || errorData.error || 'Erro ao processar pagamento' 
      };
    }

    const mpPayment = await mpResponse.json() as MPPaymentResponse;

    await nocoFetch(ORDERS_TABLE_ID, '/records', {
      method: 'PATCH',
      body: JSON.stringify({
        id: pedidoId,
        payment_id: String(mpPayment.id),
        status_pagamento: mpPayment.status === 'approved' ? 'aprovado' : 'pendente',
      }),
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
