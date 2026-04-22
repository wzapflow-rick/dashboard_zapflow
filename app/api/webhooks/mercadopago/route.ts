import { NextRequest, NextResponse } from 'next/server';
import { noco } from '@/lib/nocodb';
import { PEDIDOS_TABLE_ID, PAGAMENTOS_CONFIG_TABLE_ID } from '@/lib/constants';

const MP_ACCESS_TOKEN_FALLBACK = process.env.MP_ACCESS_TOKEN || '';

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

/**
 * Tenta buscar o token da empresa baseado no external_reference (pedidoId)
 */
async function getAccessTokenForOrder(orderId: number) {
    try {
        const order = await noco.findById(PEDIDOS_TABLE_ID, orderId) as any;
        if (order?.empresa_id) {
            const config = await noco.findOne(PAGAMENTOS_CONFIG_TABLE_ID, {
                where: `(empresa_id,eq,${order.empresa_id})`
            }) as any;
            if (config?.mp_access_token) {
                return config.mp_access_token;
            }
        }
    } catch (e) {
        console.error('[Webhook] Erro ao buscar token da empresa:', e);
    }
    return MP_ACCESS_TOKEN_FALLBACK;
}

export async function POST(req: NextRequest) {
  try {
    console.log('[MercadoPago Webhook] Recebendo notificação...');

    const body = await req.json();
    console.log('[MercadoPago Webhook] Body:', JSON.stringify(body));

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

    // Como no webhook recebemos o paymentId primeiro, tentamos buscar o token
    // No pior caso (se não conseguirmos o orderId antes), usamos o fallback para a primeira tentativa
    // ou fazemos uma busca prévia se o NocoDB permitir busca por payment_id
    
    let accessToken = MP_ACCESS_TOKEN_FALLBACK;
    
    // Tentativa 1: Buscar pedido pelo payment_id para descobrir a empresa
    try {
        const orderSearch = await noco.findOne(PEDIDOS_TABLE_ID, {
            where: `(payment_id,eq,${paymentId})`
        }) as any;
        if (orderSearch?.empresa_id) {
            const config = await noco.findOne(PAGAMENTOS_CONFIG_TABLE_ID, {
                where: `(empresa_id,eq,${orderSearch.empresa_id})`
            }) as any;
            if (config?.mp_access_token) {
                accessToken = config.mp_access_token;
            }
        }
    } catch (e) {
        console.warn('[Webhook] Não foi possível determinar empresa pelo payment_id, usando fallback');
    }

    // Buscar detalhes do pagamento na API do Mercado Pago
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
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

    // Verificar se o pagamento foi aprovado
    if (paymentData.status === 'approved') {
      await noco.update(PEDIDOS_TABLE_ID, { id: orderId, status_pagamento: 'aprovado' });

      console.log(`[MercadoPago Webhook] Pagamento aprovado para pedido ${orderId}`);

      try {
        const { sendOrderStatusMessage } = await import('@/app/actions/whatsapp');

        if (order.telefone_cliente) {
          await sendOrderStatusMessage(
            order.telefone_cliente,
            orderId,
            'aprovado',
            Number(order.empresa_id)
          );
        }
      } catch (waError) {
        console.error('[MercadoPago Webhook] Erro ao enviar WhatsApp:', waError);
      }
    } else if (paymentData.status === 'rejected' || paymentData.status === 'cancelled') {
      await noco.update(PEDIDOS_TABLE_ID, { id: orderId, status_pagamento: 'rejeitado' });
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[MercadoPago Webhook] Erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
