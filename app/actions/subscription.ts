'use server';

import { pg } from '@/lib/postgres';
import { 
  SUBSCRIPTION_PLANS,
  type SubscriptionPlanId 
} from '@/lib/constants';
import {
  getAssinaturaByEmpresaId,
  createAssinatura,
  updateAssinaturaByEmpresaId,
} from '@/lib/assinaturas';

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';
const MP_PUBLIC_KEY = process.env.MP_PUBLIC_KEY || '';

// ============================================================
// TIPOS
// ============================================================

export interface Subscription {
  id: number;
  empresa_id: number;
  mp_subscription_id: string | null;
  mp_preapproval_plan_id: string | null;
  plano: SubscriptionPlanId;
  status: 'authorized' | 'pending' | 'paused' | 'cancelled';
  valor: number;
  data_inicio: string | null;
  data_proxima_cobranca: string | null;
  cartao_ultimos_digitos: string | null;
  cartao_bandeira: string | null;
}

export interface Invoice {
  id: number;
  assinatura_id: number;
  empresa_id: number;
  mp_payment_id: string | null;
  valor: number;
  status: 'approved' | 'pending' | 'rejected';
  data_vencimento: string;
  data_pagamento: string | null;
}

// ============================================================
// FUNCOES AUXILIARES
// ============================================================

async function getCurrentUser() {
  const { getMe } = await import('./auth');
  const me = await getMe();
  if (!me || !me.empresaId) {
    throw new Error('Nao autorizado');
  }
  return me;
}

// ============================================================
// BUSCAR ASSINATURA ATUAL
// ============================================================

export async function getSubscription(): Promise<Subscription | null> {
  const me = await getCurrentUser();

  try {
    console.log('[Subscription] Buscando assinatura PostgreSQL para empresa_id:', me.empresaId);
    
    const subscription = await getAssinaturaByEmpresaId(me.empresaId);

    if (!subscription) {
      console.log('[Subscription] Nenhuma assinatura encontrada');
      return null;
    }

    console.log('[Subscription] Assinatura encontrada:', subscription.plano, subscription.status);

    return {
      id: subscription.id,
      empresa_id: subscription.empresa_id,
      mp_subscription_id: subscription.mp_subscription_id || null,
      mp_preapproval_plan_id: subscription.mp_preapproval_plan_id || null,
      plano: (subscription.plano || 'start') as SubscriptionPlanId,
      status: (subscription.status || 'pending') as Subscription['status'],
      valor: Number(subscription.valor || 0),
      data_inicio: subscription.data_inicio || null,
      data_proxima_cobranca: subscription.data_proxima_cobranca || null,
      cartao_ultimos_digitos: subscription.cartao_ultimos_digitos || null,
      cartao_bandeira: subscription.cartao_bandeira || null,
    };
  } catch (error) {
    console.error('[Subscription] Erro ao buscar assinatura:', error);
    return null;
  }
}

// ============================================================
// BUSCAR FATURAS
// ============================================================

export async function getInvoices(): Promise<Invoice[]> {
  return [];
}

// ============================================================
// CRIAR ASSINATURA NO MERCADO PAGO
// ============================================================

export async function createSubscription(planId: SubscriptionPlanId, cardToken?: string): Promise<{
  success: boolean;
  subscriptionId?: string;
  initPoint?: string;
  qrCode?: string;
  qrCodeBase64?: string;
  error?: string;
}> {
  const me = await getCurrentUser();
  const plan = SUBSCRIPTION_PLANS[planId.toUpperCase() as keyof typeof SUBSCRIPTION_PLANS];

  if (!plan) {
    return { success: false, error: 'Plano invalido' };
  }

  try {
    // Busca dados da empresa
    const empresa = await pg.findById('empresas', me.empresaId) as any;
    
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cardapio.wzapflow.com.br';
    
    // Cria a assinatura no Mercado Pago
    const preapprovalPayload: Record<string, any> = {
      reason: `Assinatura ZapFlow - Plano ${plan.name}`,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: plan.price,
        currency_id: 'BRL',
      },
      payer_email: empresa?.email || `empresa${me.empresaId}@zapflow.com.br`,
      back_url: `${baseUrl}/dashboard/subscription`,
      external_reference: `empresa_${me.empresaId}_${planId}`,
      notification_url: `${baseUrl}/api/webhooks/mercadopago`,
    };

    if (cardToken) {
      preapprovalPayload.card_token_id = cardToken;
    }

    const mpResponse = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preapprovalPayload),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('[Subscription] Erro MP:', mpData);
      return { 
        success: false, 
        error: mpData.message || 'Erro ao criar assinatura no Mercado Pago' 
      };
    }

    // Salva a assinatura no PostgreSQL
    const subscriptionData = {
      empresa_id: me.empresaId,
      mp_subscription_id: mpData.id,
      mp_preapproval_plan_id: mpData.preapproval_plan_id || null,
      plano: planId,
      status: mpData.status || 'pending',
      valor: plan.price,
      data_inicio: mpData.date_created || new Date().toISOString(),
      data_proxima_cobranca: mpData.next_payment_date || null,
      cartao_ultimos_digitos: mpData.payment_method_id ? mpData.last_four_digits : null,
      cartao_bandeira: mpData.payment_method_id || null,
    };

    const existing = await getAssinaturaByEmpresaId(me.empresaId);

    if (existing) {
      await updateAssinaturaByEmpresaId(me.empresaId, subscriptionData);
    } else {
      await createAssinatura(subscriptionData);
    }
    
    // Atualiza o plano na tabela de empresas
    await pg.update('empresas', me.empresaId, {
      planos: planId,
    });

    return {
      success: true,
      subscriptionId: mpData.id,
      initPoint: mpData.init_point,
    };
  } catch (error: any) {
    console.error('[Subscription] Erro ao criar assinatura:', error);
    return { success: false, error: error.message || 'Erro interno' };
  }
}

// ============================================================
// TROCAR PLANO
// ============================================================

export async function changePlan(newPlanId: SubscriptionPlanId): Promise<{
  success: boolean;
  error?: string;
}> {
  const me = await getCurrentUser();
  const plan = SUBSCRIPTION_PLANS[newPlanId.toUpperCase() as keyof typeof SUBSCRIPTION_PLANS];

  if (!plan) {
    return { success: false, error: 'Plano invalido' };
  }

  try {
    const subscription = await getSubscription();
    
    if (!subscription || !subscription.mp_subscription_id) {
      return createSubscription(newPlanId);
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/preapproval/${subscription.mp_subscription_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        auto_recurring: {
          transaction_amount: plan.price,
        },
        reason: `Assinatura ZapFlow - Plano ${plan.name}`,
      }),
    });

    if (!mpResponse.ok) {
      const error = await mpResponse.json();
      console.error('[Subscription] Erro ao alterar plano:', error);
      return { success: false, error: 'Erro ao alterar plano no Mercado Pago' };
    }

    await updateAssinaturaByEmpresaId(me.empresaId, {
      plano: newPlanId,
      valor: plan.price,
    });
    
    await pg.update('empresas', me.empresaId, {
      planos: newPlanId,
    });

    return { success: true };
  } catch (error: any) {
    console.error('[Subscription] Erro ao trocar plano:', error);
    return { success: false, error: error.message || 'Erro interno' };
  }
}

// ============================================================
// CANCELAR ASSINATURA
// ============================================================

export async function cancelSubscription(): Promise<{
  success: boolean;
  error?: string;
}> {
  const me = await getCurrentUser();

  try {
    const subscription = await getSubscription();
    
    if (!subscription || !subscription.mp_subscription_id) {
      return { success: false, error: 'Nenhuma assinatura ativa encontrada' };
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/preapproval/${subscription.mp_subscription_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        status: 'cancelled',
      }),
    });

    if (!mpResponse.ok) {
      const error = await mpResponse.json();
      console.error('[Subscription] Erro ao cancelar:', error);
      return { success: false, error: 'Erro ao cancelar assinatura' };
    }

    await updateAssinaturaByEmpresaId(me.empresaId, {
      status: 'cancelled',
    });
    
    await pg.update('empresas', me.empresaId, {
      planos: 'iniciante',
    });

    return { success: true };
  } catch (error: any) {
    console.error('[Subscription] Erro ao cancelar:', error);
    return { success: false, error: error.message || 'Erro interno' };
  }
}

// ============================================================
// ATUALIZAR CARTAO
// ============================================================

export async function updatePaymentCard(cardToken: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const me = await getCurrentUser();

  try {
    const subscription = await getSubscription();
    
    if (!subscription || !subscription.mp_subscription_id) {
      return { success: false, error: 'Nenhuma assinatura ativa encontrada' };
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/preapproval/${subscription.mp_subscription_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        card_token_id: cardToken,
      }),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('[Subscription] Erro ao atualizar cartao:', mpData);
      return { success: false, error: 'Erro ao atualizar cartao' };
    }

    await updateAssinaturaByEmpresaId(me.empresaId, {
      cartao_ultimos_digitos: mpData.last_four_digits || null,
      cartao_bandeira: mpData.payment_method_id || null,
    });

    return { success: true };
  } catch (error: any) {
    console.error('[Subscription] Erro ao atualizar cartao:', error);
    return { success: false, error: error.message || 'Erro interno' };
  }
}

// ============================================================
// GERAR PIX PARA PAGAMENTO
// ============================================================

export async function generatePixPayment(planId: SubscriptionPlanId): Promise<{
  success: boolean;
  qrCode?: string;
  qrCodeBase64?: string;
  copyPaste?: string;
  expirationDate?: string;
  error?: string;
}> {
  const me = await getCurrentUser();
  const plan = SUBSCRIPTION_PLANS[planId.toUpperCase() as keyof typeof SUBSCRIPTION_PLANS];

  if (!plan) {
    return { success: false, error: 'Plano invalido' };
  }

  try {
    const empresa = await pg.findById('empresas', me.empresaId) as any;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cardapio.wzapflow.com.br';

    const paymentPayload = {
      transaction_amount: plan.price,
      description: `Assinatura ZapFlow - Plano ${plan.name}`,
      payment_method_id: 'pix',
      payer: {
        email: empresa?.email || `empresa${me.empresaId}@zapflow.com.br`,
      },
      external_reference: `sub_${me.empresaId}_${planId}_${Date.now()}`,
      notification_url: `${baseUrl}/api/webhooks/mercadopago`,
    };

    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'X-Idempotency-Key': `pix_sub_${me.empresaId}_${Date.now()}`,
      },
      body: JSON.stringify(paymentPayload),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('[Subscription] Erro ao gerar PIX:', mpData);
      return { success: false, error: 'Erro ao gerar QR Code PIX' };
    }

    const txData = mpData.point_of_interaction?.transaction_data;

    return {
      success: true,
      qrCode: txData?.qr_code,
      qrCodeBase64: txData?.qr_code_base64,
      copyPaste: txData?.qr_code,
      expirationDate: mpData.date_of_expiration,
    };
  } catch (error: any) {
    console.error('[Subscription] Erro ao gerar PIX:', error);
    return { success: false, error: error.message || 'Erro interno' };
  }
}

// ============================================================
// OBTER PUBLIC KEY DO MERCADO PAGO
// ============================================================

export async function getMPPublicKeyForSubscription(): Promise<string> {
  return MP_PUBLIC_KEY;
}

// ============================================================
// OBTER PLANOS DISPONIVEIS
// ============================================================

export async function getAvailablePlans() {
  return Object.values(SUBSCRIPTION_PLANS).filter(plan => plan.id !== 'iniciante');
}
