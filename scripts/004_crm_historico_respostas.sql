-- ============================================================
-- 004 - CRM Etapa 2: historico de interacoes e captura de respostas
-- ============================================================
-- Aditiva e idempotente. Nao apaga, nao renomeia e nao altera dados existentes.
-- O historico comeca vazio (sem backfill).

BEGIN;

-- Estado de atendimento do contato
ALTER TABLE remarketing_contatos
  ADD COLUMN IF NOT EXISTS ultima_resposta_em       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS automacao_pausada_em     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS automacao_pausada_motivo TEXT,
  ADD COLUMN IF NOT EXISTS atendimento_pendente_em  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contatos_atendimento_pendente
  ON remarketing_contatos (atendimento_pendente_em)
  WHERE atendimento_pendente_em IS NOT NULL;

-- Historico permanente de cada lead.
-- Separado de remarketing_historico porque o cron /limpar apaga aquela tabela apos 90 dias.
CREATE TABLE IF NOT EXISTS remarketing_interacoes (
  id          BIGSERIAL PRIMARY KEY,
  contato_id  INTEGER NOT NULL REFERENCES remarketing_contatos(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL,
  direcao     TEXT NOT NULL DEFAULT 'interna',
  instancia   TEXT,
  message_id  TEXT,
  conteudo    TEXT,
  dados       JSONB NOT NULL DEFAULT '{}'::jsonb,
  autor       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_interacoes_direcao') THEN
    ALTER TABLE remarketing_interacoes
      ADD CONSTRAINT chk_interacoes_direcao CHECK (direcao IN ('entrada','saida','interna'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_interacoes_contato
  ON remarketing_interacoes (contato_id, created_at DESC);

-- Idempotencia: a mesma mensagem da Evolution nunca e registrada duas vezes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_interacoes_instancia_msg
  ON remarketing_interacoes (contato_id, instancia, message_id)
  WHERE message_id IS NOT NULL;

COMMIT;

-- ============================================================
-- VERIFICACAO (rodar depois do COMMIT)
-- ============================================================
-- 1) As 4 colunas novas devem aparecer
SELECT column_name
  FROM information_schema.columns
 WHERE table_name = 'remarketing_contatos'
   AND column_name IN ('ultima_resposta_em','automacao_pausada_em',
                       'automacao_pausada_motivo','atendimento_pendente_em');

-- 2) A tabela de historico deve existir e comecar vazia (0)
SELECT COUNT(*) AS interacoes FROM remarketing_interacoes;
