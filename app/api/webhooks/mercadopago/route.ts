import { NextRequest, NextResponse } from 'next/server';

const NOCODB_URL = process.env.NOCODB_URL || 'https://db.wzapflow.com.br';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';

const ORDERS_TABLE_ID = 'm2ic8zof3feve3l';
const EMPRESAS_TABLE_ID = 'mrlxbm1guwn9iv8';

interface MPPaymentData {
  id: number;
  status: string;
  external_reference: string;
  payer?: {
    email?: string;
    identification?: {
      number?: string;
    };
  };
  transaction_amount: number;
  currency_id: string;
  date_approved?: string;
  status_detail?: string;
}

interface OrderData {
  id: number;
  telefone_cliente: string;
  cliente_nome: string;
  empresa_id: number;
  valor_total: number;
  status: string;
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

export async function POST(req: NextRequest) {
  try {
    console.log('[MercadoPago Webhook] Recebendo notificação...');

    const body = await req.json();
    console.log('[MercadoPago Webhook] Body:', JSON.stringify(body));

    // Suporta ambos os formatos: topic (IPN) e action (Webhooks)
    const topic = body.topic || body.action;
    const paymentId = body.resource || body.data?.id;

    if (!paymentId) {
      console.log('[MercadoPago Webhook] ID do pagamento não encontrado');
      return NextResponse.json({ received: true });
    }

    if (topic !== 'payment' && topic !== 'payment.created' && topic !== 'payment.updated') {
      console.log(`[MercadoPago Webhook] Topic ignorado: ${topic}`);
      return NextResponse.json({ received: true });
    }

    // Buscar detalhes do pagamento na API do Mercado Pago
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
      },
    });

    if (!mpResponse.ok) {
      console.error('[MercadoPago Webhook] Erro ao buscar pagamento:', mpResponse.status);
      return NextResponse.json({ error: 'Erro ao buscar pagamento' }, { status: 500 });
    }

    const paymentData = await mpResponse.json() as MPPaymentData;
    console.log(`[MercadoPago Webhook] Pagamento ${paymentId}: status=${paymentData.status}`);

    const orderId = Number(paymentData.external_reference);

    if (!orderId) {
      console.log('[MercadoPago Webhook] external_reference não encontrado');
      return NextResponse.json({ received: true });
    }

    // Buscar pedido no NocoDB
    const order = await nocoFetch(ORDERS_TABLE_ID, `/records/${orderId}`) as OrderData;

    if (!order) {
      console.log(`[MercadoPago Webhook] Pedido ${orderId} não encontrado`);
      return NextResponse.json({ received: true });
    }

    console.log(`[MercadoPago Webhook] Pedido ${orderId}: status_pagamento atual=${order.status}, status=${paymentData.status}`);

    // Verificar se o pagamento foi aprovado
    if (paymentData.status === 'approved') {
      // Atualizar status do pagamento no pedido
      await nocoFetch(ORDERS_TABLE_ID, '/records', {
        method: 'PATCH',
        body: JSON.stringify({
          id: orderId,
          status_pagamento: 'aprovado',
        }),
      });

      console.log(`[MercadoPago Webhook] Pagamento aprovado para pedido ${orderId}`);

      // Enviar notificação WhatsApp para o cliente
      // Import dinâmico para evitar erro de servidor
      try {
        const { sendOrderStatusMessage } = await import('@/app/actions/whatsapp');
        
        if (order.telefone_cliente) {
          await sendOrderStatusMessage(
            order.telefone_cliente,
            orderId,
            'pendente',
            Number(order.empresa_id)
          );
          console.log(`[MercadoPago Webhook] WhatsApp enviado para cliente ${order.telefone_cliente}`);
        }
      } catch (waError) {
        console.error('[MercadoPago Webhook] Erro ao enviar WhatsApp:', waError);
      }
    } else if (paymentData.status === 'rejected' || paymentData.status === 'cancelled') {
      // Pagamento rejeitado ou cancelado
      await nocoFetch(ORDERS_TABLE_ID, '/records', {
        method: 'PATCH',
        body: JSON.stringify({
          id: orderId,
          status_pagamento: 'rejeitado',
        }),
      });

      console.log(`[MercadoPago Webhook] Pagamento ${paymentData.status} para pedido ${orderId}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[MercadoPago Webhook] Erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
