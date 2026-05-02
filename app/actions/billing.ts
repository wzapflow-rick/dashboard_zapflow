'use server';

import { noco } from '@/lib/nocodb';
import { EMPRESAS_TABLE_ID, SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '@/lib/constants';

const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cardapio.wzapflow.com.br';

export interface BillingStatus {
  tipo_pagamento: 'cartao' | 'pix' | null;
  data_vencimento: string | null;
  dias_inadimplente: number;
  bloqueado: boolean;
  plano: string | null;
}

/**
 * Busca status de cobranca de uma empresa
 */
export async function getBillingStatus(empresaId: number): Promise<BillingStatus | null> {
  try {
    const empresa = await noco.read(EMPRESAS_TABLE_ID, empresaId);
    
    if (!empresa) return null;
    
    return {
      tipo_pagamento: empresa.tipo_pagamento || null,
      data_vencimento: empresa.data_vencimento || null,
      dias_inadimplente: empresa.dias_inadimplente || 0,
      bloqueado: empresa.bloqueado || false,
      plano: empresa.planos || null,
    };
  } catch (error) {
    console.error('[Billing] Erro ao buscar status:', error);
    return null;
  }
}

/**
 * Gera cobranca PIX para uma empresa
 */
export async function generatePixPayment(empresaId: number, plano: SubscriptionPlanId) {
  try {
    const plan = SUBSCRIPTION_PLANS[plano.toUpperCase() as keyof typeof SUBSCRIPTION_PLANS];
    if (!plan) {
      return { success: false, error: 'Plano invalido' };
    }

    // Buscar dados da empresa
    const empresa = await noco.read(EMPRESAS_TABLE_ID, empresaId);
    if (!empresa) {
      return { success: false, error: 'Empresa nao encontrada' };
    }

    // Criar pagamento PIX no Mercado Pago
    const preference = {
      items: [
        {
          title: `ZapFlow - Plano ${plan.name}`,
          quantity: 1,
          unit_price: plan.price,
          currency_id: 'BRL',
        },
      ],
      payer: {
        email: empresa.email,
        first_name: empresa.nome_admin || empresa.nome_fantasia,
      },
      payment_methods: {
        excluded_payment_types: [
          { id: 'credit_card' },
          { id: 'debit_card' },
          { id: 'ticket' },
        ],
        default_payment_method_id: 'pix',
      },
      external_reference: JSON.stringify({
        empresaId,
        plano: plano.toLowerCase(),
        tipo: 'pix_mensal',
      }),
      back_urls: {
        success: `${BASE_URL}/dashboard?payment=success`,
        failure: `${BASE_URL}/dashboard/subscription?payment=failure`,
        pending: `${BASE_URL}/dashboard/subscription?payment=pending`,
      },
      auto_return: 'approved',
      notification_url: `${BASE_URL}/api/webhooks/mercadopago`,
    };

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Billing] Erro MP PIX:', errorData);
      return { success: false, error: 'Erro ao gerar PIX' };
    }

    const data = await response.json();

    return {
      success: true,
      initPoint: data.init_point,
      preferenceId: data.id,
    };
  } catch (error: any) {
    console.error('[Billing] Erro ao gerar PIX:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Atualiza status de pagamento de uma empresa
 */
export async function updatePaymentStatus(
  empresaId: number,
  data: {
    tipo_pagamento?: 'cartao' | 'pix';
    data_vencimento?: string;
    dias_inadimplente?: number;
    ultimo_aviso_enviado?: number;
    bloqueado?: boolean;
    planos?: string;
  }
) {
  try {
    await noco.update(EMPRESAS_TABLE_ID, {
      id: empresaId,
      ...data,
    });
    return { success: true };
  } catch (error: any) {
    console.error('[Billing] Erro ao atualizar status:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Busca empresas com pagamento PIX vencido
 */
export async function getOverdueCompanies() {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await noco.list(EMPRESAS_TABLE_ID, {
      where: `(tipo_pagamento,eq,pix)~and(data_vencimento,lt,${today})~and(bloqueado,eq,false)`,
      limit: 100,
    });

    return result?.list || [];
  } catch (error) {
    console.error('[Billing] Erro ao buscar empresas inadimplentes:', error);
    return [];
  }
}

/**
 * Calcula proxima data de vencimento (dia 5 do proximo mes)
 */
export async function calculateNextDueDate(): Promise<string> {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1; // Proximo mes
  
  if (month > 11) {
    month = 0;
    year += 1;
  }
  
  // Dia 5 do proximo mes
  const dueDate = new Date(year, month, 5);
  return dueDate.toISOString().split('T')[0];
}

/**
 * Bloqueia empresa por inadimplencia
 */
export async function blockCompany(empresaId: number) {
  try {
    await noco.update(EMPRESAS_TABLE_ID, {
      id: empresaId,
      bloqueado: true,
      planos: 'iniciante', // Bloqueia cardapio tambem
    });
    return { success: true };
  } catch (error: any) {
    console.error('[Billing] Erro ao bloquear empresa:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Desbloqueia empresa apos pagamento
 */
export async function unblockCompany(empresaId: number, plano: string) {
  try {
    const nextDueDate = calculateNextDueDate();
    
    await noco.update(EMPRESAS_TABLE_ID, {
      id: empresaId,
      bloqueado: false,
      dias_inadimplente: 0,
      ultimo_aviso_enviado: 0,
      data_vencimento: nextDueDate,
      planos: plano,
    });
    return { success: true };
  } catch (error: any) {
    console.error('[Billing] Erro ao desbloquear empresa:', error);
    return { success: false, error: error.message };
  }
}
