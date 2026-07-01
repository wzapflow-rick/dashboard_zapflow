'use server';

import { pg } from '@/lib/postgres';
import { SUBSCRIPTION_PLANS } from '@/lib/constants';

const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cardapio.wzapflow.com.br';

/**
 * Resolve os dados do plano (nome + preco) a partir da string de plano
 * gravada na assinatura (ex: 'start', 'pro', 'elite').
 */
function resolvePlano(plano: string | null): { id: string; name: string; price: number } | null {
  if (!plano) return null;
  const key = plano.toUpperCase() as keyof typeof SUBSCRIPTION_PLANS;
  const data = SUBSCRIPTION_PLANS[key];
  if (!data) return null;
  return { id: data.id, name: data.name, price: data.price };
}

/**
 * Gera um link de pagamento (PIX/checkout) do Mercado Pago para a RENOVACAO
 * de uma empresa ja cadastrada.
 *
 * O external_reference usa o formato `sub_<empresaId>_<plano>_<timestamp>`, que
 * o webhook de /api/webhooks/mercadopago ja reconhece: ao aprovar o pagamento,
 * ele avanca `data_proxima_cobranca` em +1 mes e notifica o Discord. Ou seja,
 * pagar por este link renova a assinatura automaticamente.
 *
 * Retorna a pagina de assinatura como fallback caso o MP nao esteja
 * configurado ou o plano nao tenha preco (ex: contas de teste/cortesia).
 */
export async function criarLinkPagamentoRenovacao(
  empresaId: number,
  plano: string | null,
): Promise<{ url: string; isCheckout: boolean }> {
  const fallbackUrl = `${BASE_URL}/dashboard/subscription`;
  const planData = resolvePlano(plano);

  // Sem token do MP, plano invalido ou plano gratuito -> manda para a pagina.
  if (!MP_ACCESS_TOKEN || !planData || planData.price <= 0) {
    return { url: fallbackUrl, isCheckout: false };
  }

  try {
    const externalReference = `sub_${empresaId}_${planData.id}_${Date.now()}`;

    const preference = {
      items: [
        {
          title: `ZapFlow - Renovacao Plano ${planData.name}`,
          quantity: 1,
          unit_price: planData.price,
          currency_id: 'BRL',
        },
      ],
      payment_methods: {
        excluded_payment_types: [
          { id: 'credit_card' },
          { id: 'debit_card' },
          { id: 'ticket' },
        ],
        default_payment_method_id: 'pix',
      },
      external_reference: externalReference,
      back_urls: {
        success: `${BASE_URL}/dashboard/subscription?payment=success`,
        failure: `${BASE_URL}/dashboard/subscription?payment=failure`,
        pending: `${BASE_URL}/dashboard/subscription?payment=pending`,
      },
      notification_url: `${BASE_URL}/api/webhooks/mercadopago`,
    };

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[billing-renewal] Erro ao criar link de renovacao:', JSON.stringify(errorData));
      return { url: fallbackUrl, isCheckout: false };
    }

    const mpData = await response.json();
    const initPoint = mpData.init_point || mpData.sandbox_init_point;

    if (!initPoint) {
      return { url: fallbackUrl, isCheckout: false };
    }

    return { url: String(initPoint), isCheckout: true };
  } catch (error) {
    console.error('[billing-renewal] Falha ao gerar link de renovacao:', error);
    return { url: fallbackUrl, isCheckout: false };
  }
}

/**
 * Verifica se a empresa possui um telefone de loja para receber os lembretes.
 * (helper simples reutilizavel pelo cron/testes futuros)
 */
export async function getTelefoneLoja(empresaId: number): Promise<string | null> {
  try {
    const empresa = await pg.findById('empresas', empresaId) as { telefone_loja?: string } | null;
    return empresa?.telefone_loja?.trim() || null;
  } catch {
    return null;
  }
}
