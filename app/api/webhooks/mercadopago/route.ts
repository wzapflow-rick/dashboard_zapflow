import { NextRequest, NextResponse } from 'next/server';
import { noco } from '@/lib/nocodb';
import crypto from 'crypto';
import { 
  PEDIDOS_TABLE_ID, 
  PAGAMENTOS_CONFIG_TABLE_ID,
  FATURAS_ASSINATURA_TABLE_ID,
  EMPRESAS_TABLE_ID
} from '@/lib/constants';
import {
  getAssinaturaByMpSubscriptionId,
  createAssinatura,
  updateAssinaturaByMpSubscriptionId,
} from '@/lib/assinaturas';

const MP_ACCESS_TOKEN_FALLBACK = process.env.MP_ACCESS_TOKEN || '';
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || '';

/**
 * Valida a assinatura do webhook do MercadoPago
 * Retorna true se valido, false se invalido
 * Se MP_WEBHOOK_SECRET nao estiver configurado, pula a validacao (modo desenvolvimento)
 */
function validateWebhookSignature(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string | null
): { valid: boolean; reason?: string } {
  // Se nao tiver secret configurado, pular validacao (modo dev)
  if (!MP_WEBHOOK_SECRET) {
    console.log('[Webhook] MP_WEBHOOK_SECRET nao configurado, pulando validacao de assinatura');
    return { valid: true, reason: 'no_secret_configured' };
  }

  // Se nao tiver x-signature, rejeitar
  if (!xSignature) {
    return { valid: false, reason: 'missing_x_signature_header' };
  }

  // Extrair ts e hash do header x-signature
  // Formato: ts=1704908010,v1=618c85345248dd820d5fd456117c2ab2ef8eda45a0282ff693eac24131a5e839
  const parts = xSignature.split(',');
  let ts: string | null = null;
  let hash: string | null = null;

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key?.trim() === 'ts') {
      ts = value?.trim();
    } else if (key?.trim() === 'v1') {
      hash = value?.trim();
    }
  }

  if (!ts || !hash) {
    return { valid: false, reason: 'invalid_x_signature_format' };
  }

  // Montar o manifest para validacao
  // Formato: id:[data.id];request-id:[x-request-id];ts:[ts];
  let manifest = '';
  if (dataId) {
    manifest += `id:${dataId};`;
  }
  if (xRequestId) {
    manifest += `request-id:${xRequestId};`;
  }
  manifest += `ts:${ts};`;

  // Gerar HMAC SHA256
  const hmac = crypto.createHmac('sha256', MP_WEBHOOK_SECRET);
  hmac.update(manifest);
  const calculatedHash = hmac.digest('hex');

  // Comparar hashes
  if (calculatedHash === hash) {
    return { valid: true };
  }

  console.error('[Webhook] Assinatura invalida');
  console.error('[Webhook] Manifest:', manifest);
  console.error('[Webhook] Hash recebido:', hash);
  console.error('[Webhook] Hash calculado:', calculatedHash);

  return { valid: false, reason: 'signature_mismatch' };
}

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

    // Busca ou cria a assinatura no PostgreSQL
    const existing = await getAssinaturaByMpSubscriptionId(subData.id);

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
      await updateAssinaturaByMpSubscriptionId(subData.id, subscriptionData);
      console.log(`[Webhook] Subscription ${subscriptionId} atualizada para empresa ${empresaId}`);
    } else {
      // Extrai plano do external_reference
      const planMatch = externalRef.match(/empresa_\d+_(\w+)/);
      const plano = planMatch ? planMatch[1] : 'pro';
      
      await createAssinatura({
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

    if (!empresaId) {
      console.log('[Webhook] empresa_id nao encontrado no external_reference');
      return true;
    }

    // Se pagamento aprovado, criar ou atualizar assinatura usando SQL direto
    if (paymentData.status === 'approved' && externalRef.startsWith('sub_')) {
      const planMatch = externalRef.match(/sub_\d+_(\w+)_/);
      const plano = planMatch ? planMatch[1] : 'start';
      
      console.log(`[Webhook] Pagamento aprovado para empresa ${empresaId}, plano: ${plano}`);
      
      const db = (await import('@/lib/db')).default;
      const hoje = new Date();
      const proximaCobranca = new Date(hoje);
      proximaCobranca.setMonth(proximaCobranca.getMonth() + 1);
      
      // Verifica se ja existe assinatura
      const existingResult = await db.query(
        'SELECT id FROM assinaturas WHERE empresa_id = $1 LIMIT 1',
        [empresaId]
      );
      
      if (existingResult.rows.length > 0) {
        // Atualiza assinatura existente
        await db.query(`
          UPDATE assinaturas 
          SET status = 'authorized',
              plano = $1,
              mp_subscription_id = $2,
              data_proxima_cobranca = $3,
              updated_at = NOW()
          WHERE empresa_id = $4
        `, [plano, String(paymentData.id), proximaCobranca.toISOString(), empresaId]);
        
        console.log(`[Webhook] Assinatura ATUALIZADA para empresa ${empresaId}`);
      } else {
        // Cria nova assinatura via SQL direto (evita problema do Link field do NocoDB)
        await db.query(`
          INSERT INTO assinaturas (
            empresa_id, plano, status, valor, 
            mp_subscription_id, mp_preapproval_plan_id,
            data_inicio, data_proxima_cobranca,
            cartao_ultimos_digitos, cartao_bandeira,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        `, [
          empresaId,
          plano,
          'authorized',
          paymentData.transaction_amount || 0,
          String(paymentData.id),
          plano,
          hoje.toISOString(),
          proximaCobranca.toISOString(),
          'PIX',
          'PIX'
        ]);
        
        console.log(`[Webhook] Nova assinatura CRIADA para empresa ${empresaId}`);
      }
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
  console.log('[Webhook] POST iniciado');
  
  try {
    console.log('[Webhook] Recebendo notificacao...');
    
    // Extrair headers para validacao de assinatura
    const xSignature = req.headers.get('x-signature');
    const xRequestId = req.headers.get('x-request-id');
    
    // Extrair data.id da query string (MercadoPago envia assim)
    const url = new URL(req.url);
    const dataIdFromQuery = url.searchParams.get('data.id');
    
    // Ler o body como texto primeiro para debug
    const bodyText = await req.text();
    
    // Parsear o JSON
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch (parseError) {
      console.error('[Webhook] Erro ao parsear JSON:', parseError);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    
    // Obter data.id do body se nao veio na query
    const dataId = dataIdFromQuery || body?.data?.id?.toString() || null;
    
    // Validar assinatura do webhook
    const signatureValidation = validateWebhookSignature(xSignature, xRequestId, dataId);
    if (!signatureValidation.valid) {
      console.error('[Webhook] Assinatura invalida:', signatureValidation.reason);
      return NextResponse.json(
        { error: 'Invalid webhook signature', reason: signatureValidation.reason },
        { status: 401 }
      );
    }
    
    console.log('[Webhook] Assinatura validada com sucesso');
    console.log('[Webhook] Body:', JSON.stringify(body));

    const topic = body.topic || body.action || body.type;
    
    // Extrair resourceId - pode vir como URL completa ou como ID direto
    let resourceId = body.data?.id || body.resource || body.id;
    
    // Se resource for uma URL, extrair o ID do final
    if (typeof resourceId === 'string' && resourceId.includes('/')) {
      const parts = resourceId.split('/');
      resourceId = parts[parts.length - 1];
    }
    
    console.log(`[v0] DEBUG - topic: ${topic}, resourceId: ${resourceId}`);

    if (!resourceId) {
      console.log('[MercadoPago Webhook] ID do recurso nao encontrado, body:', JSON.stringify(body));
      return NextResponse.json({ received: true });
    }
    
    console.log(`[v0] Processando evento - topic: ${topic}`);

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
      console.log(`[v0] Webhook payment recebido: paymentId=${paymentId}`);
      
      // ============================================================
      // PRIMEIRO: Verificar se e pagamento PIX de SIGNUP
      // ============================================================
      try {
        const mpCheckResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN_FALLBACK}` },
        });
        
        if (mpCheckResponse.ok) {
          const paymentCheck = await mpCheckResponse.json();
          const externalRef = paymentCheck.external_reference || '';
          
          console.log(`[v0] DEBUG - paymentCheck.status: ${paymentCheck.status}`);
          console.log(`[v0] DEBUG - externalRef: ${externalRef}`);
          
          // Se external_reference e JSON e pagamento aprovado, e signup PIX
          if (externalRef.startsWith('{') && paymentCheck.status === 'approved') {
            console.log('[v0] Detectado pagamento PIX de signup!');
            
            try {
              const signupData = JSON.parse(externalRef);
              console.log('[v0] signupData:', JSON.stringify(signupData));
              
              if (signupData.token && signupData.email && signupData.tipo === 'pix') {
                const { createPendingSignup } = await import('@/app/actions/signup');
                const { sendWelcomeSignupMessage } = await import('@/app/actions/whatsapp');
                
                console.log('[v0] Criando pending signup...');
                await createPendingSignup({
                  token: signupData.token,
                  email: signupData.email,
                  nome: signupData.nome,
                  telefone: signupData.telefone,
                  plano: signupData.plano,
                  mp_payment_id: String(paymentCheck.id),
                });
                
                console.log('[v0] Enviando WhatsApp para:', signupData.telefone);
                await sendWelcomeSignupMessage(signupData.telefone, signupData.nome, signupData.token);
                
                console.log('[v0] PIX signup processado com sucesso!');
                return NextResponse.json({ received: true, processed: 'pix_signup' });
              }
              
              // PIX MENSAL de empresa existente
              if (signupData.empresaId && signupData.plano && signupData.tipo === 'pix_mensal') {
                console.log('[v0] Detectado pagamento PIX mensal para empresa:', signupData.empresaId);
                
                try {
                  const db = (await import('@/lib/db')).default;
                  
                  const empresaId = signupData.empresaId;
                  const plano = signupData.plano;
                  const hoje = new Date();
                  const proximaCobranca = new Date(hoje);
                  proximaCobranca.setMonth(proximaCobranca.getMonth() + 1);
                  
                  // Verifica se ja existe assinatura
                  const existingResult = await db.query(
                    'SELECT id FROM assinaturas WHERE empresa_id = $1 LIMIT 1',
                    [empresaId]
                  );
                  
                  if (existingResult.rows.length > 0) {
                    // Atualiza assinatura existente
                    await db.query(`
                      UPDATE assinaturas 
                      SET status = 'authorized',
                          plano = $1,
                          mp_subscription_id = $2,
                          data_proxima_cobranca = $3,
                          updated_at = NOW()
                      WHERE empresa_id = $4
                    `, [plano, String(paymentCheck.id), proximaCobranca.toISOString(), empresaId]);
                    
                    console.log('[v0] Assinatura atualizada para empresa:', empresaId);
                  } else {
                    // Cria nova assinatura
                    await db.query(`
                      INSERT INTO assinaturas (
                        empresa_id, plano, status, valor, 
                        mp_subscription_id, mp_preapproval_plan_id,
                        data_inicio, data_proxima_cobranca,
                        cartao_ultimos_digitos, cartao_bandeira,
                        created_at, updated_at
                      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
                    `, [
                      empresaId,
                      plano,
                      'authorized',
                      paymentCheck.transaction_amount || 0,
                      String(paymentCheck.id),
                      plano,
                      hoje.toISOString(),
                      proximaCobranca.toISOString(),
                      'PIX',
                      'PIX'
                    ]);
                    
                    console.log('[v0] Nova assinatura criada para empresa:', empresaId);
                  }
                  
                  return NextResponse.json({ received: true, processed: 'pix_mensal' });
                } catch (pixError) {
                  console.error('[v0] Erro ao processar PIX mensal:', pixError);
                }
              }
            } catch (parseError) {
              console.log('[v0] Erro ao processar signup PIX:', parseError);
            }
          }
        }
      } catch (checkError) {
        console.log('[v0] Erro ao verificar pagamento:', checkError);
      }
      
      // Verifica se e pagamento de subscription
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
        // IMPORTANTE: Atualiza AMBOS os campos:
        // - status_pagamento: 'aprovado' (para controle interno)
        // - status: 'pendente' (para mover no Kanban de "Aguardando Pagamento" para "Novo Pedido")
        await noco.update(PEDIDOS_TABLE_ID, { 
          id: orderId, 
          status_pagamento: 'aprovado',
          status: 'pendente' // Move para "Novo Pedido" no Kanban
        });

        console.log(`[MercadoPago Webhook] Pagamento aprovado para pedido ${orderId} - status atualizado para 'pendente'`);

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
        await noco.update(PEDIDOS_TABLE_ID, { 
          id: orderId, 
          status_pagamento: 'rejeitado',
          status: 'cancelado' // Cancela o pedido
        });
        console.log(`[MercadoPago Webhook] Pagamento rejeitado/cancelado para pedido ${orderId}`);
      }

      return NextResponse.json({ received: true });
    }

    // ============================================================
    // EVENTOS DE MERCHANT ORDER (Preference API / Checkout Pro)
    // ============================================================
    if (topic === 'merchant_order' || topic === 'topic_merchant_order_wh') {
      const orderId = String(resourceId);
      console.log(`[v0] Webhook merchant_order recebido: orderId=${orderId}`);
      
      try {
        // Buscar detalhes da merchant order
        const moResponse = await fetch(`https://api.mercadopago.com/merchant_orders/${orderId}`, {
          headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN_FALLBACK}` },
        });
        
        if (moResponse.ok) {
          const merchantOrder = await moResponse.json();
          console.log('[v0] Merchant order status:', merchantOrder.status);
          console.log('[v0] Merchant order external_reference:', merchantOrder.external_reference);
          
          // Verificar se a order esta closed (paga)
          if (merchantOrder.status === 'closed' && merchantOrder.payments?.length > 0) {
            const approvedPayment = merchantOrder.payments.find((p: any) => p.status === 'approved');
            
            if (approvedPayment) {
              const externalRef = merchantOrder.external_reference || '';
              console.log('[v0] Pagamento aprovado encontrado, external_reference:', externalRef);
              
              // Verificar se e PIX mensal
              if (externalRef.startsWith('{')) {
                try {
                  const signupData = JSON.parse(externalRef);
                  
                  if (signupData.empresaId && signupData.plano && signupData.tipo === 'pix_mensal') {
                    console.log('[v0] Processando PIX mensal via merchant_order para empresa:', signupData.empresaId);
                    
                    const db = (await import('@/lib/db')).default;
                    
                    const empresaId = signupData.empresaId;
                    const plano = signupData.plano;
                    const hoje = new Date();
                    const proximaCobranca = new Date(hoje);
                    proximaCobranca.setMonth(proximaCobranca.getMonth() + 1);
                    
                    // Verifica se ja existe assinatura
                    const existingResult = await db.query(
                      'SELECT id FROM assinaturas WHERE empresa_id = $1 LIMIT 1',
                      [empresaId]
                    );
                    
                    if (existingResult.rows.length > 0) {
                      // Atualiza assinatura existente
                      await db.query(`
                        UPDATE assinaturas 
                        SET status = 'authorized',
                            plano = $1,
                            mp_subscription_id = $2,
                            data_proxima_cobranca = $3,
                            updated_at = NOW()
                        WHERE empresa_id = $4
                      `, [plano, String(approvedPayment.id), proximaCobranca.toISOString(), empresaId]);
                      
                      console.log('[v0] Assinatura atualizada via merchant_order para empresa:', empresaId);
                    } else {
                      // Cria nova assinatura
                      await db.query(`
                        INSERT INTO assinaturas (
                          empresa_id, plano, status, valor, 
                          mp_subscription_id, mp_preapproval_plan_id,
                          data_inicio, data_proxima_cobranca,
                          cartao_ultimos_digitos, cartao_bandeira,
                          created_at, updated_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
                      `, [
                        empresaId,
                        plano,
                        'authorized',
                        approvedPayment.transaction_amount || 0,
                        String(approvedPayment.id),
                        plano,
                        hoje.toISOString(),
                        proximaCobranca.toISOString(),
                        'PIX',
                        'PIX'
                      ]);
                      
                      console.log('[v0] Nova assinatura criada via merchant_order para empresa:', empresaId);
                    }
                    
                    return NextResponse.json({ received: true, processed: 'pix_mensal_merchant_order' });
                  }
                  
                  // PIX de signup
                  if (signupData.token && signupData.email && signupData.tipo === 'pix') {
                    console.log('[v0] Processando PIX signup via merchant_order');
                    
                    const { createPendingSignup } = await import('@/app/actions/signup');
                    const { sendWelcomeSignupMessage } = await import('@/app/actions/whatsapp');
                    
                    await createPendingSignup({
                      token: signupData.token,
                      email: signupData.email,
                      nome: signupData.nome,
                      telefone: signupData.telefone,
                      plano: signupData.plano,
                      mp_payment_id: String(approvedPayment.id),
                    });
                    
                    await sendWelcomeSignupMessage(signupData.telefone, signupData.nome, signupData.token);
                    
                    console.log('[v0] PIX signup processado via merchant_order');
                    return NextResponse.json({ received: true, processed: 'pix_signup_merchant_order' });
                  }
                } catch (parseError) {
                  console.log('[v0] Erro ao parsear external_reference:', parseError);
                }
              }
            }
          }
        }
      } catch (moError) {
        console.error('[v0] Erro ao processar merchant_order:', moError);
      }
      
      return NextResponse.json({ received: true });
    }

    // Topic nao tratado - SEMPRE retornar uma Response
    console.log(`[MercadoPago Webhook] Topic ignorado: ${topic}`);
    return NextResponse.json({ received: true, ignored: topic });
  } catch (error: any) {
    console.error('[MercadoPago Webhook] Erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
