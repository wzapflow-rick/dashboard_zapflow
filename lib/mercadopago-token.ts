/**
 * Token da conta Mercado Pago da PLATAFORMA (cobrança das assinaturas ZapFlash).
 *
 * Historicamente o código usava dois nomes diferentes (MP_ACCESS_TOKEN e
 * MERCADOPAGO_ACCESS_TOKEN). Se cada um apontar para uma conta/aplicação
 * diferente, o checkout é criado numa conta e o webhook consulta o pagamento
 * em outra (404) ou rejeita a assinatura do webhook — e a renovação nunca é
 * aplicada. Por isso todo o fluxo da plataforma deve usar este helper.
 */
export function getPlatformMpAccessToken(): string {
  return process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN || '';
}

/** Todos os tokens de plataforma distintos configurados, na ordem de preferência. */
export function getPlatformMpAccessTokens(): string[] {
  const tokens = [process.env.MP_ACCESS_TOKEN, process.env.MERCADOPAGO_ACCESS_TOKEN].filter(
    (token): token is string => Boolean(token),
  );
  return Array.from(new Set(tokens));
}

/**
 * Busca um pagamento tentando cada token de plataforma. Cobre pagamentos
 * antigos criados com o token "legado" enquanto as variáveis não forem unificadas.
 */
export async function fetchPlatformPayment(paymentId: string): Promise<any | null> {
  const tokens = getPlatformMpAccessTokens();
  if (tokens.length === 0) {
    console.error('[MercadoPago] Nenhum token de plataforma configurado (MP_ACCESS_TOKEN)');
    return null;
  }

  for (const [index, token] of tokens.entries()) {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) return response.json();
    console.warn(
      `[MercadoPago] Pagamento ${paymentId} não encontrado com token #${index + 1} (status ${response.status})`,
    );
  }
  return null;
}
