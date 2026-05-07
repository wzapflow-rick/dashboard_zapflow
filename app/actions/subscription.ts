'use server';

import { noco } from '@/lib/nocodb';
import { 
  ASSINATURAS_TABLE_ID, 
  FATURAS_ASSINATURA_TABLE_ID, 
  EMPRESAS_TABLE_ID,
  SUBSCRIPTION_PLANS,
  type SubscriptionPlanId 
} from '@/lib/constants';

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
    if (!ASSINATURAS_TABLE_ID) {
      // Tabela nao configurada ainda - retorna dados mock para desenvolvimento
      return {
        id: 0,
        empresa_id: me.empresaId,
        mp_subscription_id: null,
        mp_preapproval_plan_id: null,
        plano: 'pro',
        status: 'authorized',
        valor: SUBSCRIPTION_PLANS.PRO.price,
        data_inicio: new Date().toISOString(),
        data_proxima_cobranca: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cartao_ultimos_digitos: null,
        cartao_bandeira: null,
      };
    }

    console.log('[v0] Buscando assinatura para empresa_id:', me.empresaId, 'tabela:', ASSINATURAS_TABLE_ID);
    
    const subscription = await noco.findOne(ASSINATURAS_TABLE_ID, {
      where: `(empresa_id,eq,${me.empresaId})`,
    }) as any;

    console.log('[v0] Assinatura encontrada:', JSON.stringify(subscription));

    if (!subscription) return null;

    return {
      id: subscription.id || subscription.Id,
      empresa_id: subscription.empresa_id,
      mp_subscription_id: subscription.mp_subscription_id,
      mp_preapproval_plan_id: subscription.mp_preapproval_plan_id,
      plano: subscription.plano || subscription.mp_preapproval_plan_id || 'start',
      status: subscription.status || 'pending',
      valor: Number(subscription.valor || 0),
      data_inicio: subscription.data_inicio,
      data_proxima_cobranca: subscription.data_proxima_cobranca,
      cartao_ultimos_digitos: subscription.cartao_ultimos_digitos,
      cartao_bandeira: subscription.cartao_bandeira,
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
  // Tabela de faturas ainda nao existe - retorna array vazio
  // TODO: Criar tabela faturas_assinatura no NocoDB quando necessario
  return [];
}

// ============================================================
// CRIAR ASSINATURA NO MERCADO PAGO
// ============================================================

export async function createSubscription(planId: SubscriptionPlanId, cardToken?: string, cupom?: string): Promise<{
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
    // Validar cupom se fornecido
    let precoFinal: number = plan.price;
    let cupomId: number | null = null;
    let cupomCodigo: string | null = null;
    
    if (cupom) {
      const { validarCupomPlataforma, incrementarUsoCupom } = await import('./cupons-plataforma');
      const validacao = await validarCupomPlataforma(cupom, planId, plan.price);
      
      if (validacao.valid && validacao.precoFinal !== undefined) {
        precoFinal = validacao.precoFinal;
        cupomId = validacao.cupom?.id || null;
        cupomCodigo = validacao.cupom?.codigo || null;
        console.log('[Subscription] Cupom aplicado:', cupomCodigo, '- Preco final:', precoFinal);
        
        // Incrementa uso do cupom imediatamente (sera desfeito se falhar)
        if (cupomId) {
          await incrementarUsoCupom(cupomId);
        }
      } else {
        return { success: false, error: validacao.mensagem || 'Cupom invalido' };
      }
    }
    
    // Busca dados da empresa
    const empresa = await noco.findById(EMPRESAS_TABLE_ID, me.empresaId) as any;
    
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cardapio.wzapflow.com.br';
    
    // Cria a assinatura no Mercado Pago
    const preapprovalPayload: Record<string, any> = {
      reason: cupomCodigo 
        ? `Assinatura ZapFlow - Plano ${plan.name} (Cupom: ${cupomCodigo})`
        : `Assinatura ZapFlow - Plano ${plan.name}`,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: precoFinal,
        currency_id: 'BRL',
      },
      payer_email: empresa?.email || `empresa${me.empresaId}@zapflow.com.br`,
      back_url: `${baseUrl}/dashboard/subscription`,
      external_reference: `empresa_${me.empresaId}_${planId}`,
      notification_url: `${baseUrl}/api/webhooks/mercadopago`,
    };

    // Se tiver token do cartao, adiciona
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

    // Salva a assinatura no NocoDB
    if (ASSINATURAS_TABLE_ID) {
      // Verifica se ja existe assinatura
      const existing = await noco.findOne(ASSINATURAS_TABLE_ID, {
        where: `(empresa_id,eq,${me.empresaId})`,
      }) as any;

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

      if (existing) {
        await noco.update(ASSINATURAS_TABLE_ID, {
          id: existing.id || existing.Id,
          ...subscriptionData,
        });
      } else {
        await noco.create(ASSINATURAS_TABLE_ID, subscriptionData);
      }
      
      // Atualiza o plano na tabela de empresas para liberar o cardapio
      await noco.update(EMPRESAS_TABLE_ID, {
        id: me.empresaId,
        planos: planId,
      });
    }

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
    // Busca assinatura atual
    const subscription = await getSubscription();
    
    if (!subscription || !subscription.mp_subscription_id) {
      // Nao tem assinatura ativa, cria uma nova
      return createSubscription(newPlanId);
    }

    // Atualiza a assinatura no Mercado Pago
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

    // Atualiza no NocoDB
    if (ASSINATURAS_TABLE_ID && subscription.id) {
      await noco.update(ASSINATURAS_TABLE_ID, {
        id: subscription.id,
        plano: newPlanId,
        valor: plan.price,
      });
      
      // Atualiza o plano na tabela de empresas
      await noco.update(EMPRESAS_TABLE_ID, {
        id: me.empresaId,
        planos: newPlanId,
      });
    }

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

    // Cancela no Mercado Pago
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

    // Atualiza no NocoDB
    if (ASSINATURAS_TABLE_ID && subscription.id) {
      await noco.update(ASSINATURAS_TABLE_ID, {
        id: subscription.id,
        status: 'cancelled',
      });
      
      // Volta o plano da empresa para iniciante (bloqueia cardapio)
      await noco.update(EMPRESAS_TABLE_ID, {
        id: me.empresaId,
        planos: 'iniciante',
      });
    }

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

    // Atualiza o cartao no Mercado Pago
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

    // Atualiza no NocoDB
    if (ASSINATURAS_TABLE_ID && subscription.id) {
      await noco.update(ASSINATURAS_TABLE_ID, {
        id: subscription.id,
        cartao_ultimos_digitos: mpData.last_four_digits || null,
        cartao_bandeira: mpData.payment_method_id || null,
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error('[Subscription] Erro ao atualizar cartao:', error);
    return { success: false, error: error.message || 'Erro interno' };
  }
}

// ============================================================
// GERAR PIX PARA PAGAMENTO
// ============================================================

export async function generatePixPayment(planId: SubscriptionPlanId, cupom?: string): Promise<{
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
    // Validar cupom se fornecido
    let precoFinal: number = plan.price;
    let cupomCodigo: string | null = null;
    
    if (cupom) {
      const { validarCupomPlataforma, incrementarUsoCupom } = await import('./cupons-plataforma');
      const validacao = await validarCupomPlataforma(cupom, planId, plan.price);
      
      if (validacao.valid && validacao.precoFinal !== undefined) {
        precoFinal = validacao.precoFinal;
        cupomCodigo = validacao.cupom?.codigo || null;
        console.log('[Subscription PIX] Cupom aplicado:', cupomCodigo, '- Preco final:', precoFinal);
        
        // Incrementa uso do cupom
        if (validacao.cupom?.id) {
          await incrementarUsoCupom(validacao.cupom.id);
        }
      } else {
        return { success: false, error: validacao.mensagem || 'Cupom invalido' };
      }
    }
    
    const empresa = await noco.findById(EMPRESAS_TABLE_ID, me.empresaId) as any;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cardapio.wzapflow.com.br';

    // Cria pagamento PIX avulso (primeira cobranca)
    const paymentPayload = {
      transaction_amount: precoFinal,
      description: cupomCodigo 
        ? `Assinatura ZapFlow - Plano ${plan.name} (Cupom: ${cupomCodigo})`
        : `Assinatura ZapFlow - Plano ${plan.name}`,
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
  // Filtra apenas planos pagos (exclui o plano iniciante)
  return Object.values(SUBSCRIPTION_PLANS).filter(plan => plan.id !== 'iniciante');
}
