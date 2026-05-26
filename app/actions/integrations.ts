'use server';

import { getMe } from '@/lib/session-server';
import { pg } from '@/lib/postgres';
import { EMPRESAS_TABLE } from '@/lib/tables';
import crypto from 'crypto';

const BASE_URL = 'https://cardapio.wzapflow.com.br';

interface IntegrationStatus {
  whatsapp: {
    connected: boolean;
    instance: string | null;
  };
  mercadopago: {
    connected: boolean;
  };
  webhook: {
    token: string | null;
    url: string;
  };
}

/**
 * Obtem o status de todas as integracoes da empresa
 */
export async function getIntegrationStatus(): Promise<IntegrationStatus> {
  const user = await getMe();
  if (!user?.empresaId) {
    throw new Error('Nao autorizado');
  }

  // Buscar dados da empresa
  const empresaResult: any = await pg.query(
    `SELECT instancia_evolution, mp_access_token, webhook_token FROM ${EMPRESAS_TABLE} WHERE id = $1`,
    [user.empresaId]
  );

  const empresa = empresaResult.rows?.[0] || empresaResult?.[0];

  return {
    whatsapp: {
      connected: !!empresa?.instancia_evolution,
      instance: empresa?.instancia_evolution || null,
    },
    mercadopago: {
      connected: !!empresa?.mp_access_token,
    },
    webhook: {
      token: empresa?.webhook_token || null,
      url: `${BASE_URL}/api/webhooks/delivery-apps`,
    },
  };
}

/**
 * Gera ou regenera o token de webhook da empresa
 */
export async function regenerateWebhookToken(): Promise<string> {
  const user = await getMe();
  if (!user?.empresaId) {
    throw new Error('Nao autorizado');
  }

  // Gerar novo token aleatorio de 64 caracteres
  const newToken = crypto.randomBytes(32).toString('hex');

  // Atualizar no banco
  await pg.query(
    `UPDATE ${EMPRESAS_TABLE} SET webhook_token = $1, updated_at = NOW() WHERE id = $2`,
    [newToken, user.empresaId]
  );

  return newToken;
}

/**
 * Valida um token de webhook (usado internamente pelo webhook)
 */
export async function validateWebhookToken(token: string): Promise<{ valid: boolean; empresaId?: number }> {
  if (!token) {
    return { valid: false };
  }

  const result: any = await pg.query(
    `SELECT id FROM ${EMPRESAS_TABLE} WHERE webhook_token = $1 LIMIT 1`,
    [token]
  );

  const empresa = result.rows?.[0] || result?.[0];

  if (!empresa) {
    return { valid: false };
  }

  return { valid: true, empresaId: empresa.id };
}
