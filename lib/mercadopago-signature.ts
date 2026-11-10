import crypto from 'crypto';

export interface MercadoPagoSignatureInput {
  secret: string;
  isProduction: boolean;
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}

export interface MercadoPagoSignatureResult {
  valid: boolean;
  reason?: string;
}

/**
 * Valida o header x-signature do Mercado Pago (HMAC-SHA256).
 * Manifest oficial: id:[data.id];request-id:[x-request-id];ts:[ts];
 * Em producao, a ausencia do secret rejeita a notificacao (fail-closed).
 */
export function validateMercadoPagoSignature({
  secret,
  isProduction,
  xSignature,
  xRequestId,
  dataId,
}: MercadoPagoSignatureInput): MercadoPagoSignatureResult {
  if (!secret) {
    if (isProduction) return { valid: false, reason: 'secret_not_configured' };
    return { valid: true, reason: 'dev_no_secret' };
  }

  if (!xSignature) return { valid: false, reason: 'missing_x_signature_header' };

  let ts: string | null = null;
  let hash: string | null = null;
  for (const part of xSignature.split(',')) {
    const [key, value] = part.split('=');
    if (key?.trim() === 'ts') ts = value?.trim() || null;
    else if (key?.trim() === 'v1') hash = value?.trim() || null;
  }

  if (!ts || !hash || !/^[a-f0-9]{64}$/i.test(hash)) {
    return { valid: false, reason: 'invalid_x_signature_format' };
  }

  // O Mercado Pago exige data.id alfanumerico em minusculas no manifest.
  let manifest = '';
  if (dataId) manifest += `id:${dataId.toLowerCase()};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  manifest += `ts:${ts};`;

  const calculated = crypto.createHmac('sha256', secret).update(manifest).digest();
  const received = Buffer.from(hash, 'hex');

  if (received.length === calculated.length && crypto.timingSafeEqual(received, calculated)) {
    return { valid: true };
  }
  return { valid: false, reason: 'signature_mismatch' };
}
