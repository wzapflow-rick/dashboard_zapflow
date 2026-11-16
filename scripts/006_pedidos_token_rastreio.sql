-- Rastreio de pedido por token aleatorio (em vez do ID sequencial).
-- Pedidos existentes recebem um token cada um automaticamente (DEFAULT volatil).
-- gen_random_uuid() e nativo a partir do PostgreSQL 13; em versoes anteriores,
-- rode antes: CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- A tabela e reescrita uma vez: rode em horario de pouco movimento.
BEGIN;

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS token_rastreio UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS uniq_pedidos_token_rastreio
  ON pedidos (token_rastreio);

COMMIT;

-- Conferencia (deve retornar 0):
-- SELECT COUNT(*) FROM pedidos WHERE token_rastreio IS NULL;
