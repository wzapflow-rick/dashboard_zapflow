/**
 * @jest-environment node
 */
import crypto from 'crypto';
import { validateMercadoPagoSignature } from './mercadopago-signature';

const SECRET = 'test-secret';
const TS = '1704908010';
const REQUEST_ID = 'req-123';
const DATA_ID = 'ABC123';

function sign(secret = SECRET, dataId = DATA_ID) {
  const manifest = `id:${dataId.toLowerCase()};request-id:${REQUEST_ID};ts:${TS};`;
  return crypto.createHmac('sha256', secret).update(manifest).digest('hex');
}

const base = { secret: SECRET, isProduction: true, xRequestId: REQUEST_ID, dataId: DATA_ID };

describe('validateMercadoPagoSignature', () => {
  it('aceita assinatura valida', () => {
    expect(validateMercadoPagoSignature({ ...base, xSignature: `ts=${TS},v1=${sign()}` }).valid).toBe(true);
  });

  it('rejeita assinatura gerada com outro secret', () => {
    const r = validateMercadoPagoSignature({ ...base, xSignature: `ts=${TS},v1=${sign('outro')}` });
    expect(r).toEqual({ valid: false, reason: 'signature_mismatch' });
  });

  it('rejeita data.id adulterado', () => {
    const r = validateMercadoPagoSignature({ ...base, dataId: 'XYZ999', xSignature: `ts=${TS},v1=${sign()}` });
    expect(r.valid).toBe(false);
  });

  it('rejeita header ausente', () => {
    expect(validateMercadoPagoSignature({ ...base, xSignature: null }).reason).toBe('missing_x_signature_header');
  });

  it('rejeita formato invalido', () => {
    expect(validateMercadoPagoSignature({ ...base, xSignature: 'ts=1,v1=zz' }).reason).toBe('invalid_x_signature_format');
    expect(validateMercadoPagoSignature({ ...base, xSignature: 'lixo' }).reason).toBe('invalid_x_signature_format');
  });

  it('falha fechado em producao sem secret', () => {
    const r = validateMercadoPagoSignature({ ...base, secret: '', xSignature: null });
    expect(r).toEqual({ valid: false, reason: 'secret_not_configured' });
  });

  it('permite sem secret apenas fora de producao', () => {
    const r = validateMercadoPagoSignature({ ...base, secret: '', isProduction: false, xSignature: null });
    expect(r.valid).toBe(true);
  });
});
