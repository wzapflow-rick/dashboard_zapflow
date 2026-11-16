/**
 * Chave de assinatura das sessões (compatível com Edge Runtime).
 *
 * Em produção, sem JWT_SECRET, falha fechado: nenhuma sessão é emitida nem
 * aceita. Antes existia uma chave fixa no código, o que permitia forjar sessões.
 * No build e em desenvolvimento usamos uma chave aleatória por processo, que
 * nunca valida tokens de outro ambiente.
 */

const MIN_SECRET_LENGTH = 32;

let ephemeralSecret: string | null = null;

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build';
}

function getEphemeralSecret(): string {
  if (!ephemeralSecret) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    ephemeralSecret = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return ephemeralSecret;
}

export function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    if (isProductionRuntime()) {
      throw new Error('JWT_SECRET não configurado: sessões desativadas até a variável ser definida.');
    }
    return getEphemeralSecret();
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    console.warn(`JWT_SECRET deve ter pelo menos ${MIN_SECRET_LENGTH} caracteres`);
  }
  return secret;
}
