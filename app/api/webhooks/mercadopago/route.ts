import { NextRequest, NextResponse } from 'next/server';
import { noco } from '@/lib/nocodb';
import { PEDIDOS_TABLE_ID } from '@/lib/constants';

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';

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

    const order = await noco.findById(PEDIDOS_TABLE_ID, orderId) as OrderData;

    if (!order) {
      console.log(`[MercadoPago Webhook] Pedido ${orderId} não encontrado`);
      return NextResponse.json({ received: true });
    }

    console.log(`[MercadoPago Webhook] Pedido ${orderId}: status_pagamento atual=${order.status}, status=${paymentData.status}`);

    // Verificar se o pagamento foi aprovado
    if (paymentData.status === 'approved') {
      await noco.update(PEDIDOS_TABLE_ID, { id: orderId, status_pagamento: 'aprovado' });

      console.log(`[MercadoPago Webhook] Pagamento aprovado para pedido ${orderId}`);

      // Enviar notificação WhatsApp para o cliente
      // Import dinâmico para evitar erro de servidor
      try {
        const { sendOrderStatusMessage } = await import('@/app/actions/whatsapp');

        if (order.telefone_cliente) {
          await sendOrderStatusMessage(
            order.telefone_cliente,
            orderId,
            'aprovado',
            Number(order.empresa_id)
          );
          console.log(`[MercadoPago Webhook] WhatsApp enviado para cliente ${order.telefone_cliente}`);
        }
      } catch (waError) {
        console.error('[MercadoPago Webhook] Erro ao enviar WhatsApp:', waError);
      }
    } else if (paymentData.status === 'rejected' || paymentData.status === 'cancelled') {
      await noco.update(PEDIDOS_TABLE_ID, { id: orderId, status_pagamento: 'rejeitado' });

      console.log(`[MercadoPago Webhook] Pagamento ${paymentData.status} para pedido ${orderId}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[MercadoPago Webhook] Erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
