import { pg } from '@/lib/postgres';

/**
 * @file lib/webhook-logger.ts
 * @description Registro de cada notificacao do Mercado Pago na tabela `webhook_logs`.
 *
 * Os logs da Vercel expiram rapido; esta tabela guarda o que chegou, o status
 * do pagamento e o que o webhook fez, para investigar renovacoes que falharam.
 *
 * A tabela e criada automaticamente na primeira escrita (CREATE TABLE IF NOT EXISTS).
 * SQL equivalente em scripts/002_webhook_logs.sql.
 *
 * A escrita e "best-effort": falhas aqui nunca alteram a resposta do webhook.
 */

export interface WebhookLogContext {
  topic?: string;
  resourceId?: string;
  paymentStatus?: string;
  externalReference?: string;
  error?: string;
}

let tableReady: Promise<void> | null = null;

function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = pg
      .query(
        `CREATE TABLE IF NOT EXISTS webhook_logs (
           id                 SERIAL PRIMARY KEY,
           provider           TEXT NOT NULL DEFAULT 'mercadopago',
           topic              TEXT,
           resource_id        TEXT,
           payment_status     TEXT,
           external_reference TEXT,
           http_status        INTEGER NOT NULL,
           resultado          JSONB,
           erro               TEXT,
           created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
         );
         CREATE INDEX IF NOT EXISTS idx_webhook_logs_resource
           ON webhook_logs (resource_id, created_at DESC);`
      )
      .then(() => undefined)
      .catch((error) => {
        tableReady = null;
        throw error;
      });
  }
  return tableReady;
}

export async function logWebhook(
  ctx: WebhookLogContext,
  httpStatus: number,
  resultado: unknown
): Promise<void> {
  try {
    await ensureTable();
    await pg.query(
      `INSERT INTO webhook_logs
         (topic, resource_id, payment_status, external_reference, http_status, resultado, erro)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [
        ctx.topic ?? null,
        ctx.resourceId ?? null,
        ctx.paymentStatus ?? null,
        ctx.externalReference ? ctx.externalReference.slice(0, 1000) : null,
        httpStatus,
        JSON.stringify(resultado ?? null),
        ctx.error ? ctx.error.slice(0, 2000) : null,
      ]
    );
  } catch (error) {
    console.warn('[webhook-logger] Falha ao registrar notificacao:', (error as Error)?.message);
  }
}
