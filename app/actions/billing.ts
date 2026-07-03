'use server';

import { pg } from '@/lib/postgres';
import { SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '@/lib/constants';

const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cardapio.wzapflow.com.br';

export interface BillingStatus {
  tipo_pagamento: 'cartao' | 'pix' | null;
  data_vencimento: string | null;
  dias_inadimplente: number;
  bloqueado: boolean;
  plano: string | null;
  /** Data da proxima cobranca (renovacao automatica no cartao), vinda da tabela assinaturas */
  data_proxima_cobranca: string | null;
  /** Valor da assinatura */
  valor: number | null;
  /** Ultimos 4 digitos do cartao usado na assinatura */
  cartao_ultimos_digitos: string | null;
}

/**
 * Busca status de cobranca de uma empresa.
 * Combina dados da tabela `empresas` (PIX/inadimplencia) com a tabela
 * `assinaturas` (renovacao automatica no cartao).
 */
export async function getBillingStatus(empresaId: number): Promise<BillingStatus | null> {
  try {
    const empresa = await pg.findById('empresas', empresaId) as any;
    
    if (!empresa) return null;

    // Dados da assinatura (renovacao no cartao)
    const assinaturaResult = await pg.query(
      'SELECT plano, valor, data_proxima_cobranca, cartao_ultimos_digitos FROM assinaturas WHERE empresa_id = $1 ORDER BY id DESC LIMIT 1',
      [empresaId]
    );
    const assinatura = assinaturaResult?.rows?.[0] as any;
    
    return {
      tipo_pagamento: empresa.tipo_pagamento || null,
      data_vencimento: empresa.data_vencimento || null,
      dias_inadimplente: empresa.dias_inadimplente || 0,
      bloqueado: empresa.bloqueado || false,
      plano: empresa.planos || assinatura?.plano || null,
      data_proxima_cobranca: assinatura?.data_proxima_cobranca || null,
      valor: assinatura?.valor != null ? Number(assinatura.valor) : null,
      cartao_ultimos_digitos: assinatura?.cartao_ultimos_digitos || null,
    };
  } catch (error) {
    console.error('[Billing] Erro ao buscar status:', error);
    return null;
  }
}

/**
 * Gera cobranca PIX para uma empresa
 * Usa o valor personalizado da assinatura se existir, senao usa o valor padrao do plano
 */
export async function generatePixPayment(empresaId: number, plano: SubscriptionPlanId) {
  try {
    const plan = SUBSCRIPTION_PLANS[plano.toUpperCase() as keyof typeof SUBSCRIPTION_PLANS];
    if (!plan) {
      return { success: false, error: 'Plano invalido' };
    }

    const empresa = await pg.findById('empresas', empresaId) as any;
    if (!empresa) {
      return { success: false, error: 'Empresa nao encontrada' };
    }

    // Buscar valor personalizado da assinatura
    const assinaturaResult = await pg.query(
      'SELECT valor FROM assinaturas WHERE empresa_id = $1 LIMIT 1',
      [empresaId]
    );
    
    // Usar valor personalizado se existir e for maior que 0, senao usa preco do plano
    const assinatura = assinaturaResult?.rows?.[0];
    const valorCobranca = assinatura?.valor && Number(assinatura.valor) > 0 
      ? Number(assinatura.valor) 
      : plan.price;

    console.log(`[Billing] Gerando PIX para empresa ${empresaId}: valor personalizado = ${assinatura?.valor}, valor final = ${valorCobranca}`);

    const preference = {
      items: [
        {
          title: `ZapFlow - Plano ${plan.name}`,
          quantity: 1,
          unit_price: valorCobranca,
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
        valorPersonalizado: valorCobranca,
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
      valor: valorCobranca,
    };
  } catch (error: any) {
    console.error('[Billing] Erro ao gerar PIX:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Gera um checkout do Mercado Pago com TODOS os metodos de pagamento habilitados
 * (PIX, cartao de credito/debito e boleto). Diferente de generatePixPayment, aqui
 * nao excluimos nenhum tipo — o cliente escolhe como pagar na tela do Mercado Pago.
 * Usado pelo botao "Pagar agora" do banner de cobranca.
 */
export async function generateCheckoutLink(empresaId: number) {
  try {
    const empresa = await pg.findById('empresas', empresaId) as any;
    if (!empresa) {
      return { success: false, error: 'Empresa nao encontrada' };
    }

    // Busca plano e valor da assinatura
    const assinaturaResult = await pg.query(
      'SELECT plano, valor FROM assinaturas WHERE empresa_id = $1 ORDER BY id DESC LIMIT 1',
      [empresaId]
    );
    const assinatura = assinaturaResult?.rows?.[0] as any;

    const planoId = (assinatura?.plano || empresa.planos || 'start') as SubscriptionPlanId;
    const plan = SUBSCRIPTION_PLANS[String(planoId).toUpperCase() as keyof typeof SUBSCRIPTION_PLANS];

    // Usa valor personalizado se existir e for maior que 0, senao usa preco do plano
    const valorCobranca = assinatura?.valor && Number(assinatura.valor) > 0
      ? Number(assinatura.valor)
      : (plan?.price || 0);

    if (!valorCobranca || valorCobranca <= 0) {
      return { success: false, error: 'Valor da assinatura invalido' };
    }

    const preference = {
      items: [
        {
          title: `ZapFlow - Plano ${plan?.name || planoId}`,
          quantity: 1,
          unit_price: valorCobranca,
          currency_id: 'BRL',
        },
      ],
      payer: {
        email: empresa.email,
        first_name: empresa.nome_admin || empresa.nome_fantasia,
      },
      // Sem excluded_payment_types: habilita PIX, cartao e boleto
      external_reference: JSON.stringify({
        empresaId,
        plano: String(planoId).toLowerCase(),
        tipo: 'checkout_mensal',
        valorPersonalizado: valorCobranca,
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
      console.error('[Billing] Erro MP checkout:', errorData);
      return { success: false, error: 'Erro ao gerar checkout' };
    }

    const data = await response.json();

    return {
      success: true,
      initPoint: data.init_point as string,
      preferenceId: data.id as string,
      valor: valorCobranca,
    };
  } catch (error: any) {
    console.error('[Billing] Erro ao gerar checkout:', error);
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
    await pg.update('empresas', { id: empresaId, ...data });
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
    
    const result = await pg.query(
      `SELECT * FROM empresas WHERE tipo_pagamento = 'pix' AND data_vencimento < $1 AND bloqueado = false LIMIT 100`,
      [today]
    );

    return result?.rows || [];
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
  let month = now.getMonth() + 1;
  
  if (month > 11) {
    month = 0;
    year += 1;
  }
  
  const dueDate = new Date(year, month, 5);
  return dueDate.toISOString().split('T')[0];
}

/**
 * Bloqueia empresa por inadimplencia
 */
export async function blockCompany(empresaId: number) {
  try {
    await pg.update('empresas', {
      id: empresaId,
      bloqueado: true,
      planos: 'iniciante',
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
    const nextDueDate = await calculateNextDueDate();
    
    await pg.update('empresas', {
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
