import { NextRequest, NextResponse } from 'next/server';
import { noco } from '@/lib/nocodb';
import { 
  PEDIDOS_TABLE_ID, 
  PAGAMENTOS_CONFIG_TABLE_ID,
  ASSINATURAS_TABLE_ID,
  FATURAS_ASSINATURA_TABLE_ID,
  EMPRESAS_TABLE_ID
} from '@/lib/constants';

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

// ============================================================
// HANDLERS DE SUBSCRIPTION/PREAPPROVAL
// ============================================================

async function handleSubscriptionEvent(subscriptionId: string) {
  console.log(`[Webhook] Processando evento de subscription: ${subscriptionId}`);
  
  try {
    // Busca detalhes da subscription no Mercado Pago
    const mpResponse = await fetch(`https://api.mercadopago.com/preapproval/${subscriptionId}`, {
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN_FALLBACK}`,
      },
    });

    if (!mpResponse.ok) {
      console.error('[Webhook] Erro ao buscar subscription:', mpResponse.status);
      return;
    }

    const subData = await mpResponse.json();
    console.log('[Webhook] Subscription data:', JSON.stringify(subData));

    // Extrai empresa_id do external_reference (formato: empresa_ID_plano)
    const externalRef = subData.external_reference || '';
    const match = externalRef.match(/empresa_(\d+)_/);
    const empresaId = match ? Number(match[1]) : null;

    if (!empresaId) {
      console.log('[Webhook] Nao foi possivel extrair empresa_id do external_reference');
      return;
    }

    if (!ASSINATURAS_TABLE_ID) {
      console.log('[Webhook] ASSINATURAS_TABLE_ID nao configurado');
      return;
    }

    // Busca ou cria a assinatura no NocoDB
    const existing = await noco.findOne(ASSINATURAS_TABLE_ID, {
      where: `(empresa_id,eq,${empresaId})`,
    }) as any;

    const subscriptionData = {
      empresa_id: empresaId,
      mp_subscription_id: subData.id,
      mp_preapproval_plan_id: subData.preapproval_plan_id || null,
      status: subData.status || 'pending',
      valor: subData.auto_recurring?.transaction_amount || 0,
      data_proxima_cobranca: subData.next_payment_date || null,
      cartao_ultimos_digitos: subData.last_four_digits || null,
      cartao_bandeira: subData.payment_method_id || null,
    };

    if (existing) {
      await noco.update(ASSINATURAS_TABLE_ID, {
        id: existing.id || existing.Id,
        ...subscriptionData,
      });
      console.log(`[Webhook] Subscription ${subscriptionId} atualizada para empresa ${empresaId}`);
    } else {
      // Extrai plano do external_reference
      const planMatch = externalRef.match(/empresa_\d+_(\w+)/);
      const plano = planMatch ? planMatch[1] : 'pro';
      
      await noco.create(ASSINATURAS_TABLE_ID, {
        ...subscriptionData,
        plano,
        data_inicio: subData.date_created || new Date().toISOString(),
      });
      console.log(`[Webhook] Nova subscription criada para empresa ${empresaId}`);
    }

    // Se a assinatura foi autorizada, atualiza status da empresa
    if (subData.status === 'authorized') {
      try {
        await noco.update(EMPRESAS_TABLE_ID, {
          id: empresaId,
          assinatura_ativa: true,
        });
      } catch (e) {
        // Campo pode nao existir
        console.log('[Webhook] Nao foi possivel atualizar assinatura_ativa na empresa');
      }
    } else if (subData.status === 'cancelled' || subData.status === 'paused') {
      try {
        await noco.update(EMPRESAS_TABLE_ID, {
          id: empresaId,
          assinatura_ativa: false,
        });
      } catch (e) {
        console.log('[Webhook] Nao foi possivel atualizar assinatura_ativa na empresa');
      }
    }
  } catch (error) {
    console.error('[Webhook] Erro ao processar subscription:', error);
  }
}

async function handleSubscriptionPayment(paymentId: string) {
  console.log(`[Webhook] Processando pagamento de subscription: ${paymentId}`);
  
  try {
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN_FALLBACK}`,
      },
    });

    if (!mpResponse.ok) {
      console.error('[Webhook] Erro ao buscar pagamento:', mpResponse.status);
      return;
    }

    const paymentData = await mpResponse.json();
    
    // Verifica se e pagamento de subscription
    const externalRef = paymentData.external_reference || '';
    if (!externalRef.startsWith('sub_') && !externalRef.startsWith('empresa_')) {
      // Nao e pagamento de subscription
      return false;
    }

    // Extrai empresa_id
    let empresaId: number | null = null;
    
    if (externalRef.startsWith('sub_')) {
      const match = externalRef.match(/sub_(\d+)_/);
      empresaId = match ? Number(match[1]) : null;
    } else if (externalRef.startsWith('empresa_')) {
      const match = externalRef.match(/empresa_(\d+)_/);
      empresaId = match ? Number(match[1]) : null;
    }

    if (!empresaId || !FATURAS_ASSINATURA_TABLE_ID || !ASSINATURAS_TABLE_ID) {
      return true; // E subscription mas nao pode processar
    }

    // Busca a assinatura
    const subscription = await noco.findOne(ASSINATURAS_TABLE_ID, {
      where: `(empresa_id,eq,${empresaId})`,
    }) as any;

    if (!subscription) {
      console.log('[Webhook] Subscription nao encontrada para empresa', empresaId);
      return true;
    }

    // Cria registro de fatura
    await noco.create(FATURAS_ASSINATURA_TABLE_ID, {
      assinatura_id: subscription.id || subscription.Id,
      empresa_id: empresaId,
      mp_payment_id: String(paymentData.id),
      valor: paymentData.transaction_amount,
      status: paymentData.status === 'approved' ? 'approved' : paymentData.status === 'rejected' ? 'rejected' : 'pending',
      data_vencimento: paymentData.date_of_expiration || new Date().toISOString(),
      data_pagamento: paymentData.status === 'approved' ? (paymentData.date_approved || new Date().toISOString()) : null,
    });

    console.log(`[Webhook] Fatura criada para empresa ${empresaId}, status: ${paymentData.status}`);

    // Se pagamento aprovado e era PIX de primeira assinatura, cria a subscription
    if (paymentData.status === 'approved' && externalRef.startsWith('sub_')) {
      const planMatch = externalRef.match(/sub_\d+_(\w+)_/);
      const plano = planMatch ? planMatch[1] : 'pro';
      
      // Atualiza subscription para ativa
      await noco.update(ASSINATURAS_TABLE_ID, {
        id: subscription.id || subscription.Id,
        status: 'authorized',
        data_proxima_cobranca: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    return true;
  } catch (error) {
    console.error('[Webhook] Erro ao processar pagamento de subscription:', error);
    return true;
  }
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================

export async function POST(req: NextRequest) {
  try {
    console.log('[MercadoPago Webhook] Recebendo notificacao...');

    const body = await req.json();
    console.log('[MercadoPago Webhook] Body:', JSON.stringify(body));

    const topic = body.topic || body.action || body.type;
    const resourceId = body.resource || body.data?.id;

    if (!resourceId) {
      console.log('[MercadoPago Webhook] ID do recurso nao encontrado');
      return NextResponse.json({ received: true });
    }

    // ============================================================
    // EVENTOS DE SUBSCRIPTION (preapproval)
    // ============================================================
    if (topic === 'subscription_preapproval' || topic === 'preapproval') {
      await handleSubscriptionEvent(String(resourceId));
      return NextResponse.json({ received: true });
    }

    // ============================================================
    // EVENTOS DE PAGAMENTO
    // ============================================================
    if (topic === 'payment' || topic === 'payment.created' || topic === 'payment.updated') {
      const paymentId = String(resourceId);
      
      // Primeiro verifica se e pagamento de subscription
      const isSubscriptionPayment = await handleSubscriptionPayment(paymentId);
      
      if (isSubscriptionPayment) {
        return NextResponse.json({ received: true });
      }

      // Pagamento de pedido normal
      let accessToken = MP_ACCESS_TOKEN_FALLBACK;
      
      // Tentativa: Buscar pedido pelo payment_id para descobrir a empresa
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
          console.warn('[Webhook] Nao foi possivel determinar empresa pelo payment_id, usando fallback');
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
      console.log(`[MercadoPago Webhook] Pagamento ${paymentId}: status=${paymentData.status}, external_reference=${paymentData.external_reference}`);

      // ============================================================
      // VERIFICAR SE E UM PAGAMENTO PIX DE SIGNUP (external_reference e JSON)
      // ============================================================
      const externalRef = paymentData.external_reference || '';
      
      console.log('[v0] DEBUG - externalRef:', externalRef);
      console.log('[v0] DEBUG - status:', paymentData.status);
      console.log('[v0] DEBUG - startsWithBracket:', externalRef.startsWith('{'));
      
      if (externalRef.startsWith('{') && paymentData.status === 'approved') {
        console.log('[v0] DEBUG - Entrou no bloco PIX signup');
        try {
          const signupData = JSON.parse(externalRef);
          console.log('[v0] DEBUG - signupData parsed:', JSON.stringify(signupData));
          
          if (signupData.token && signupData.email && signupData.tipo === 'pix') {
            console.log('[v0] Pagamento PIX de signup detectado:', signupData.email);
            
            // Importar funcoes necessarias
            const { createPendingSignup } = await import('@/app/actions/signup');
            const { sendWelcomeSignupMessage } = await import('@/app/actions/whatsapp');
            
            console.log('[v0] DEBUG - Criando pending signup...');
            // Criar pending signup
            await createPendingSignup({
              token: signupData.token,
              email: signupData.email,
              nome: signupData.nome,
              telefone: signupData.telefone,
              plano: signupData.plano,
              mp_payment_id: String(paymentData.id),
            });
            console.log('[v0] DEBUG - Pending signup criado');
            
            console.log('[v0] DEBUG - Enviando WhatsApp para:', signupData.telefone);
            // Enviar WhatsApp com link de ativacao
            const whatsappResult = await sendWelcomeSignupMessage(signupData.telefone, signupData.nome, signupData.token);
            console.log('[v0] DEBUG - WhatsApp enviado, resultado:', whatsappResult);
            
            console.log('[v0] PIX signup processado com sucesso:', signupData.email);
            return NextResponse.json({ received: true, processed: 'pix_signup' });
          } else {
            console.log('[v0] DEBUG - Condicao nao atendida: token=', !!signupData.token, 'email=', !!signupData.email, 'tipo=', signupData.tipo);
          }
        } catch (parseError) {
          console.log('[v0] DEBUG - Erro ao parsear JSON:', parseError);
        }
      }

      // ============================================================
      // FLUXO NORMAL: PAGAMENTO DE PEDIDO
      // ============================================================
      const orderId = Number(externalRef);

      if (!orderId) {
        console.log('[MercadoPago Webhook] external_reference nao encontrado ou nao e um orderId');
        return NextResponse.json({ received: true });
      }

      const order = await noco.findById(PEDIDOS_TABLE_ID, orderId) as OrderData;

      if (!order) {
        console.log(`[MercadoPago Webhook] Pedido ${orderId} nao encontrado`);
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
    }

    // Topic nao tratado
    console.log(`[MercadoPago Webhook] Topic ignorado: ${topic}`);
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[MercadoPago Webhook] Erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
