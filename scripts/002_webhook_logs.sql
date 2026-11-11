-- Registro das notificacoes do Mercado Pago (lib/webhook-logger.ts).
-- O app cria a tabela sozinho na primeira notificacao; este script e opcional.
CREATE TABLE IF NOT EXISTS webhook_logs (
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
  ON webhook_logs (resource_id, created_at DESC);

-- Consulta util:
-- SELECT created_at, topic, resource_id, payment_status, http_status, resultado, erro
--   FROM webhook_logs ORDER BY created_at DESC LIMIT 50;
