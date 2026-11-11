import { NextRequest, NextResponse } from 'next/server';
import { pg } from '@/lib/postgres';
import { getPlatformMpAccessToken, fetchPlatformPayment } from '@/lib/mercadopago-token';
import {
  getAssinaturaByMpSubscriptionId,
  createAssinatura,
  updateAssinaturaByMpSubscriptionId,
} from '@/lib/assinaturas';
import { notifyPayment } from '@/lib/discord';
import { unblockCompany } from '@/app/actions/billing';
import { validateMercadoPagoSignature } from '@/lib/mercadopago-signature';
import { logWebhook, type WebhookLogContext } from '@/lib/webhook-logger';

const MP_ACCESS_TOKEN_FALLBACK = getPlatformMpAccessToken();
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || '';

function validateWebhookSignature(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string | null
) {
  return validateMercadoPagoSignature({
    secret: MP_WEBHOOK_SECRET,
    isProduction: process.env.NODE_ENV === 'production',
    xSignature,
    xRequestId,
    dataId,
  });
}

// ============================================================
// IDEMPOTENCIA
// ============================================================

/** Pagamento ja aplicado a assinatura da empresa (reentrega do mesmo evento). */
async function isSubscriptionPaymentProcessed(empresaId: number, paymentId: string): Promise<boolean> {
  try {
    const result = await pg.query(
      `SELECT 1 FROM assinaturas
        WHERE empresa_id = $1 AND mp_subscription_id = $2 AND status = 'authorized'
        LIMIT 1`,
      [empresaId, paymentId]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('[Webhook] Falha na checagem de idempotencia (assinatura):', (error as Error)?.message);
    return false;
  }
}

/** Signup PIX ja registrado para este pagamento ou token. */
async function isSignupPaymentProcessed(paymentId: string, token: string): Promise<boolean> {
  try {
    const result = await pg.query(
      'SELECT 1 FROM pending_signups WHERE mp_payment_id = $1 OR token = $2 LIMIT 1',
      [paymentId, token]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('[Webhook] Falha na checagem de idempotencia (signup):', (error as Error)?.message);
    return false;
  }
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
        const order = await pg.findById('pedidos', orderId) as any;
        if (order?.empresa_id) {
            const config = await pg.findOne('pagamentos_config', {
                where: { empresa_id: order.empresa_id }
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
        await pg.update('empresas', {
          id: empresaId,
          assinatura_ativa: true,
        });
      } catch (e) {
        // Campo pode nao existir
        console.log('[Webhook] Nao foi possivel atualizar assinatura_ativa na empresa');
      }
    } else if (subData.status === 'cancelled' || subData.status === 'paused') {
      try {
        await pg.update('empresas', {
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
// ============================================================
// RENOVACAO MENSAL / ASSINATURA
// ============================================================

type JsonReference = Record<string, any>;
type MonthlyReference = JsonReference & { empresaId: unknown; plano: unknown; tipo: string };
type SignupReference = JsonReference & { token: unknown; email: unknown; tipo: 'pix' };

function parseJsonReference(externalRef: string): JsonReference | null {
  if (!externalRef.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(externalRef);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    console.error('[Webhook] external_reference JSON invalido:', externalRef.slice(0, 80));
    return null;
  }
}

function isMonthlyReference(ref: JsonReference | null): ref is MonthlyReference {
  return Boolean(
    ref?.empresaId && ref?.plano && (ref.tipo === 'pix_mensal' || ref.tipo === 'checkout_mensal')
  );
}

function isSignupReference(ref: JsonReference | null): ref is SignupReference {
  return Boolean(ref?.token && ref?.email && ref?.tipo === 'pix');
}

/**
 * Aplica um pagamento aprovado de mensalidade: libera a empresa e grava a assinatura.
 * Lanca excecao em qualquer falha para o webhook responder 500 e o Mercado Pago reenviar.
 * A empresa e liberada antes de gravar a assinatura porque a gravacao e o que marca o
 * pagamento como processado; assim uma falha no meio nunca impede o reprocessamento.
 */
async function applyMonthlyPayment(params: {
  empresaId: number;
  plano: string;
  paymentId: string;
  amount: number;
  metodo: string;
}): Promise<'applied' | 'duplicate'> {
  const { empresaId, plano, paymentId, amount, metodo } = params;

  if (await isSubscriptionPaymentProcessed(empresaId, paymentId)) {
    console.log(`[Webhook] Pagamento ${paymentId} ja processado para empresa ${empresaId} — ignorado`);
    return 'duplicate';
  }

  const unblock = await unblockCompany(empresaId, plano);
  if (!unblock.success) {
    throw new Error(`Falha ao liberar empresa ${empresaId}: ${unblock.error}`);
  }

  const hoje = new Date();
  const proximaCobranca = new Date(hoje);
  proximaCobranca.setMonth(proximaCobranca.getMonth() + 1);

  const existingResult = await pg.query(
    'SELECT id FROM assinaturas WHERE empresa_id = $1 LIMIT 1',
    [empresaId]
  );

  if (existingResult.rows.length > 0) {
    // $5::numeric: sem o cast o Postgres infere integer pelo "0" e rejeita valores com centavos (ex.: 29.9).
    await pg.query(
      `UPDATE assinaturas
          SET status = 'authorized',
              plano = $1,
              mp_subscription_id = $2,
              data_proxima_cobranca = $3,
              valor = COALESCE(NULLIF($5::numeric, 0), valor),
              ultimo_aviso_renovacao = NULL,
              updated_at = NOW()
        WHERE empresa_id = $4`,
      [plano, paymentId, proximaCobranca.toISOString(), empresaId, amount || 0]
    );
    console.log(`[Webhook] Assinatura atualizada para empresa ${empresaId}`);
  } else {
    await pg.query(
      `INSERT INTO assinaturas (
         empresa_id, plano, status, valor,
         mp_subscription_id, mp_preapproval_plan_id,
         data_inicio, data_proxima_cobranca,
         cartao_ultimos_digitos, cartao_bandeira,
         created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
      [
        empresaId,
        plano,
        'authorized',
        amount || 0,
        paymentId,
        plano,
        hoje.toISOString(),
        proximaCobranca.toISOString(),
        'PIX',
        'PIX',
      ]
    );
    console.log(`[Webhook] Nova assinatura criada para empresa ${empresaId}`);
  }

  try {
    const empresaResult: any = await pg.query(
      'SELECT nome_fantasia, nome FROM empresas WHERE id = $1',
      [empresaId]
    );
    const empresa = empresaResult?.rows?.[0] || empresaResult?.[0];
    const nomeEmpresa = String(empresa?.nome_fantasia || empresa?.nome || `Empresa ${empresaId}`);
    await notifyPayment({
      empresaId,
      nomeFantasia: nomeEmpresa,
      plano,
      valor: amount || 0,
      metodoPagamento: metodo,
    });
  } catch (discordError) {
    console.error('[Webhook] Erro ao notificar Discord:', discordError);
  }

  return 'applied';
}

async function applySignupPayment(ref: JsonReference, paymentId: string): Promise<'applied' | 'duplicate'> {
  if (await isSignupPaymentProcessed(paymentId, String(ref.token))) {
    console.log(`[Webhook] Signup PIX do pagamento ${paymentId} ja processado — ignorado`);
    return 'duplicate';
  }
  const { createPendingSignup } = await import('@/app/actions/signup');
  const { sendWelcomeSignupMessage } = await import('@/app/actions/whatsapp');

  await createPendingSignup({
    token: ref.token,
    email: ref.email,
    nome: ref.nome,
    telefone: ref.telefone,
    plano: ref.plano,
    mp_payment_id: paymentId,
  });
  await sendWelcomeSignupMessage(ref.telefone, ref.nome, ref.token);

  console.log(`[Webhook] Signup PIX processado (pagamento ${paymentId})`);
  return 'applied';
}

/** Pagamentos de assinatura com external_reference no formato texto (sub_ID_plano_ / empresa_ID_). */
async function handleSubscriptionPayment(paymentData: any): Promise<boolean> {
  const externalRef: string = paymentData.external_reference || '';
  if (!externalRef.startsWith('sub_') && !externalRef.startsWith('empresa_')) {
    return false;
  }

  const match = externalRef.startsWith('sub_')
    ? externalRef.match(/sub_(\d+)_/)
    : externalRef.match(/empresa_(\d+)_/);
  const empresaId = match ? Number(match[1]) : null;

  if (!empresaId) {
    console.log('[Webhook] empresa_id nao encontrado no external_reference');
    return true;
  }

  if (paymentData.status === 'approved' && externalRef.startsWith('sub_')) {
    const planMatch = externalRef.match(/sub_\d+_(\w+)_/);
    const plano = planMatch ? planMatch[1] : 'start';
    await applyMonthlyPayment({
      empresaId,
      plano,
      paymentId: String(paymentData.id),
      amount: paymentData.transaction_amount || 0,
      metodo: paymentData.payment_type_id || 'PIX',
    });
  }

  return true;
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================

async function handleWebhook(req: NextRequest, ctx: WebhookLogContext): Promise<NextResponse> {
  const xSignature = req.headers.get('x-signature');
  const xRequestId = req.headers.get('x-request-id');

  // O MP envia o id de formas diferentes dependendo do tipo de notificacao: ?data.id=, ?id=, ?data_id=
  const url = new URL(req.url);
  const dataIdFromQuery =
    url.searchParams.get('data.id') ||
    url.searchParams.get('data_id') ||
    url.searchParams.get('id');

  const bodyText = await req.text();

  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    console.error('[Webhook] Body invalido (JSON malformado)');
    ctx.error = 'invalid_json';
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // O MP pode mandar o id em body.data.id ou (em alguns eventos) em body.id.
  const dataId =
    dataIdFromQuery ||
    body?.data?.id?.toString() ||
    body?.id?.toString() ||
    null;

  const topic = body.topic || body.action || body.type;
  ctx.topic = topic;
  ctx.resourceId = dataId ?? undefined;

  const signatureValidation = validateWebhookSignature(xSignature, xRequestId, dataId);
  if (!signatureValidation.valid) {
    ctx.error = `signature:${signatureValidation.reason}`;
    if (signatureValidation.reason === 'secret_not_configured') {
      console.error('[Webhook] MP_WEBHOOK_SECRET ausente em producao — notificacao rejeitada');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }
    console.warn('[Webhook] Notificacao rejeitada:', signatureValidation.reason);
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  // resourceId pode vir como URL completa ou como ID direto
  let resourceId = body.data?.id || body.resource || body.id;
  if (typeof resourceId === 'string' && resourceId.includes('/')) {
    const parts = resourceId.split('/');
    resourceId = parts[parts.length - 1];
  }

  if (!resourceId) {
    console.log('[Webhook] ID do recurso nao encontrado — notificacao ignorada');
    return NextResponse.json({ received: true, ignored: 'no_resource_id' });
  }
  ctx.resourceId = String(resourceId);

  console.log(`[Webhook] Evento recebido - topic: ${topic}, id: ${resourceId}`);

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
    const paymentCheck = await fetchPlatformPayment(paymentId);

    if (paymentCheck) {
      const externalRef: string = paymentCheck.external_reference || '';
      ctx.paymentStatus = paymentCheck.status;
      ctx.externalReference = externalRef;
      console.log(
        `[Webhook] Pagamento ${paymentId} status=${paymentCheck.status} ref=${externalRef.slice(0, 80)}`
      );

      const jsonRef = parseJsonReference(externalRef);

      if (jsonRef && paymentCheck.status === 'approved') {
        if (isSignupReference(jsonRef)) {
          const result = await applySignupPayment(jsonRef, String(paymentCheck.id));
          return NextResponse.json({
            received: true,
            processed: result === 'duplicate' ? 'pix_signup_duplicate' : 'pix_signup',
          });
        }

        if (isMonthlyReference(jsonRef)) {
          console.log(`[Webhook] Pagamento mensal (${jsonRef.tipo}) para empresa ${jsonRef.empresaId}`);
          const result = await applyMonthlyPayment({
            empresaId: Number(jsonRef.empresaId),
            plano: String(jsonRef.plano),
            paymentId: String(paymentCheck.id),
            amount: paymentCheck.transaction_amount || 0,
            metodo: paymentCheck.payment_type_id || 'PIX',
          });
          return NextResponse.json({
            received: true,
            processed: result === 'duplicate' ? `${jsonRef.tipo}_duplicate` : jsonRef.tipo,
          });
        }
      }

      if (isMonthlyReference(jsonRef)) {
        // Mensalidade ainda nao aprovada: o MP envia nova notificacao quando o status mudar.
        return NextResponse.json({ received: true, pending: paymentCheck.status });
      }

      if (await handleSubscriptionPayment(paymentCheck)) {
        return NextResponse.json({ received: true });
      }
    }

    return handleOrderPayment(paymentId, ctx);
  }

  // ============================================================
  // EVENTOS DE MERCHANT ORDER (Preference API / Checkout Pro)
  // ============================================================
  if (topic === 'merchant_order' || topic === 'topic_merchant_order_wh') {
    const orderId = String(resourceId);
    console.log(`[Webhook] Webhook merchant_order recebido: orderId=${orderId}`);

    const moResponse = await fetch(`https://api.mercadopago.com/merchant_orders/${orderId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN_FALLBACK}` },
    });

    if (!moResponse.ok) {
      console.warn(`[Webhook] Merchant order ${orderId} nao consultada (status ${moResponse.status})`);
      return NextResponse.json({ received: true, ignored: `merchant_order_${moResponse.status}` });
    }

    const merchantOrder = await moResponse.json();
    ctx.paymentStatus = `merchant_order:${merchantOrder.status}`;
    ctx.externalReference = merchantOrder.external_reference || '';
    console.log(`[Webhook] Merchant order ${orderId}: status=${merchantOrder.status}`);

    const approvedPayment =
      merchantOrder.status === 'closed'
        ? merchantOrder.payments?.find((p: any) => p.status === 'approved')
        : null;

    if (approvedPayment) {
      const jsonRef = parseJsonReference(merchantOrder.external_reference || '');

      if (isMonthlyReference(jsonRef)) {
        console.log(`[Webhook] Pagamento mensal (${jsonRef.tipo}) via merchant_order para empresa:`, jsonRef.empresaId);
        const result = await applyMonthlyPayment({
          empresaId: Number(jsonRef.empresaId),
          plano: String(jsonRef.plano),
          paymentId: String(approvedPayment.id),
          amount: approvedPayment.transaction_amount || 0,
          metodo: jsonRef.tipo === 'pix_mensal' ? 'PIX' : 'Checkout',
        });
        return NextResponse.json({
          received: true,
          processed: result === 'duplicate' ? `${jsonRef.tipo}_duplicate` : `${jsonRef.tipo}_merchant_order`,
        });
      }

      if (isSignupReference(jsonRef)) {
        const result = await applySignupPayment(jsonRef, String(approvedPayment.id));
        return NextResponse.json({
          received: true,
          processed: result === 'duplicate' ? 'pix_signup_duplicate' : 'pix_signup_merchant_order',
        });
      }
    }

    return NextResponse.json({ received: true });
  }

  console.log(`[MercadoPago Webhook] Topic ignorado: ${topic}`);
  return NextResponse.json({ received: true, ignored: topic });
}

async function handleOrderPayment(paymentId: string, ctx: WebhookLogContext): Promise<NextResponse> {
  let accessToken = MP_ACCESS_TOKEN_FALLBACK;

  // Buscar pedido pelo payment_id para descobrir a empresa e usar o token dela
  try {
    const orderSearch = await pg.findOne('pedidos', {
      where: { payment_id: paymentId }
    }) as any;
    if (orderSearch?.empresa_id) {
      const config = await pg.findOne('pagamentos_config', {
        where: { empresa_id: orderSearch.empresa_id }
      }) as any;
      if (config?.mp_access_token) {
        accessToken = config.mp_access_token;
      }
    }
  } catch {
    console.warn('[Webhook] Nao foi possivel determinar empresa pelo payment_id, usando fallback');
  }

  const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!mpResponse.ok) {
    console.error('[MercadoPago Webhook] Erro ao buscar pagamento:', mpResponse.status);
    ctx.error = `payment_fetch_${mpResponse.status}`;
    return NextResponse.json({ error: 'Erro ao buscar pagamento' }, { status: 500 });
  }

  const paymentData = await mpResponse.json() as MPPaymentData;
  const externalRef = paymentData.external_reference || '';
  ctx.paymentStatus = paymentData.status;
  ctx.externalReference = externalRef;
  console.log(`[Webhook] Pagamento ${paymentId}: status=${paymentData.status}`);

  const jsonRef = parseJsonReference(externalRef);
  if (paymentData.status === 'approved' && isSignupReference(jsonRef)) {
    const result = await applySignupPayment(jsonRef, String(paymentData.id));
    return NextResponse.json({
      received: true,
      processed: result === 'duplicate' ? 'pix_signup_duplicate' : 'pix_signup',
    });
  }

  // ============================================================
  // FLUXO NORMAL: PAGAMENTO DE PEDIDO
  // ============================================================
  const orderId = Number(externalRef);

  if (!orderId) {
    console.log('[MercadoPago Webhook] external_reference nao encontrado ou nao e um orderId');
    return NextResponse.json({ received: true, ignored: 'no_order_reference' });
  }

  const order = await pg.findById('pedidos', orderId) as OrderData;

  if (!order) {
    console.log(`[MercadoPago Webhook] Pedido ${orderId} nao encontrado`);
    return NextResponse.json({ received: true, ignored: 'order_not_found' });
  }

  const statusPagamentoAtual = (order as OrderData & { status_pagamento?: string }).status_pagamento;
  if (paymentData.status === 'approved' && statusPagamentoAtual === 'aprovado') {
    console.log(`[Webhook] Pedido ${orderId} ja aprovado — notificacao duplicada ignorada`);
    return NextResponse.json({ received: true, processed: 'order_duplicate' });
  }

  if (paymentData.status === 'approved') {
    // status_pagamento: controle interno; status 'pendente' move o pedido para "Novo Pedido" no Kanban
    await pg.update('pedidos', {
      id: orderId,
      status_pagamento: 'aprovado',
      status: 'pendente'
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
    await pg.update('pedidos', {
      id: orderId,
      status_pagamento: 'rejeitado',
      status: 'cancelado'
    });
    console.log(`[MercadoPago Webhook] Pagamento rejeitado/cancelado para pedido ${orderId}`);
  }

  return NextResponse.json({ received: true, processed: `order_${paymentData.status}` });
}

export async function POST(req: NextRequest) {
  const ctx: WebhookLogContext = {};
  let response: NextResponse;

  try {
    response = await handleWebhook(req, ctx);
  } catch (error: any) {
    console.error('[Webhook] Erro ao processar notificacao:', error);
    ctx.error = error?.message || String(error);
    response = NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  const resultado = await response.clone().json().catch(() => null);
  await logWebhook(ctx, response.status, resultado);
  return response;
}
