-- ============================================================
-- FUNIL DE FOLLOW-UP / CADENCIAS
-- Execute este script uma unica vez no banco PostgreSQL.
-- E idempotente: pode ser rodado novamente sem erro.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Colunas de funil na tabela de contatos do remarketing
-- ------------------------------------------------------------
ALTER TABLE remarketing_contatos
  ADD COLUMN IF NOT EXISTS estagio TEXT NOT NULL DEFAULT 'lead_frio',
  ADD COLUMN IF NOT EXISTS estagio_desde TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS kanban_ordem INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS empresa_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_remarketing_contatos_estagio
  ON remarketing_contatos (estagio);

CREATE INDEX IF NOT EXISTS idx_remarketing_contatos_empresa
  ON remarketing_contatos (empresa_id);

-- ------------------------------------------------------------
-- 2. Cadencias (passos automaticos por estagio)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS remarketing_cadencias (
  id              SERIAL PRIMARY KEY,
  estagio         TEXT NOT NULL,
  passo_ordem     INTEGER NOT NULL,
  rotulo          TEXT,
  offset_horas    INTEGER NOT NULL DEFAULT 24,
  recorrente      BOOLEAN NOT NULL DEFAULT FALSE,
  intervalo_horas INTEGER,
  mensagem_id     INTEGER REFERENCES remarketing_mensagens (id) ON DELETE SET NULL,
  modo            TEXT NOT NULL DEFAULT 'aprovacao', -- 'auto' | 'aprovacao'
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_cadencia_estagio_passo UNIQUE (estagio, passo_ordem)
);

-- Garante a constraint UNIQUE mesmo quando a tabela ja existia de uma execucao
-- anterior (o CREATE TABLE IF NOT EXISTS acima nao recria/altera tabelas
-- existentes, entao a UNIQUE poderia estar faltando e quebrar o ON CONFLICT).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_cadencia_estagio_passo'
  ) THEN
    ALTER TABLE remarketing_cadencias
      ADD CONSTRAINT uq_cadencia_estagio_passo UNIQUE (estagio, passo_ordem);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cadencias_estagio_ativo
  ON remarketing_cadencias (estagio, ativo);

-- ------------------------------------------------------------
-- 3. Controle de envios de cadencia (anti-duplicidade)
--    A UNIQUE garante que cada passo so seja agendado 1x por contato.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS remarketing_cadencia_envios (
  id          SERIAL PRIMARY KEY,
  contato_id  INTEGER NOT NULL,
  cadencia_id INTEGER NOT NULL,
  passo_ordem INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'agendado', -- agendado | rejeitado | cancelado
  fila_id     INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_cadencia_envio UNIQUE (contato_id, cadencia_id, passo_ordem)
);

CREATE INDEX IF NOT EXISTS idx_cadencia_envios_contato
  ON remarketing_cadencia_envios (contato_id);

-- ------------------------------------------------------------
-- 4. Seed: cadencias padrao (so insere se ainda nao existirem)
--    Leads -> modo 'aprovacao' (passam pela caixa de aprovacao)
--    Trial / Cliente -> modo 'auto' (disparo automatico)
--    mensagem_id fica NULL: associe uma mensagem na aba "Cadencias".
-- ------------------------------------------------------------
INSERT INTO remarketing_cadencias (estagio, passo_ordem, rotulo, offset_horas, modo, ativo)
VALUES
  ('lead_quente', 1, 'Primeiro contato',      2,   'aprovacao', TRUE),
  ('lead_quente', 2, 'Follow-up rapido',      24,  'aprovacao', TRUE),
  ('lead_morno',  1, 'Reaquecer',             24,  'aprovacao', TRUE),
  ('lead_morno',  2, 'Segundo toque',         72,  'aprovacao', TRUE),
  ('lead_frio',   1, 'Resgate',               168, 'aprovacao', TRUE),
  ('trial',       1, 'Boas-vindas trial',     2,   'auto',      TRUE),
  ('trial',       2, 'Dica de uso (dia 2)',   48,  'auto',      TRUE),
  ('trial',       3, 'Trial acabando (dia 5)', 120, 'auto',     TRUE),
  ('cliente',     1, 'Onboarding cliente',    24,  'auto',      TRUE)
ON CONFLICT (estagio, passo_ordem) DO NOTHING;
