-- ============================================================
-- 003 - CRM Etapa 1: consentimento e descadastro (opt-out)
-- ============================================================
-- Aditiva e idempotente. Nao apaga nem renomeia nada.
-- Executar SOMENTE em homologacao ate aprovacao explicita.

BEGIN;

ALTER TABLE remarketing_contatos
  ADD COLUMN IF NOT EXISTS consentimento_status     TEXT NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS consentimento_base_legal TEXT,
  ADD COLUMN IF NOT EXISTS consentimento_origem     TEXT,
  ADD COLUMN IF NOT EXISTS consentimento_em         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opt_out_em               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opt_out_motivo           TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_contatos_consentimento_status') THEN
    ALTER TABLE remarketing_contatos
      ADD CONSTRAINT chk_contatos_consentimento_status
      CHECK (consentimento_status IN ('concedido','pendente','revogado'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contatos_opt_out ON remarketing_contatos (opt_out_em) WHERE opt_out_em IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contatos_tel11 ON remarketing_contatos ((right(regexp_replace(telefone, '\D', '', 'g'), 11)));

-- Registro minimo de descadastro: guarda apenas a palavra-chave normalizada
-- (nunca o texto livre da mensagem). UNIQUE garante idempotencia por evento.
CREATE TABLE IF NOT EXISTS remarketing_opt_out_eventos (
  id                     SERIAL PRIMARY KEY,
  contato_id             INTEGER REFERENCES remarketing_contatos(id) ON DELETE SET NULL,
  telefone               TEXT,
  remote_jid             TEXT,
  instancia              TEXT NOT NULL,
  message_id             TEXT NOT NULL,
  mensagem_recebida      TEXT,
  primeiro_opt_out       BOOLEAN NOT NULL DEFAULT FALSE,
  itens_fila_cancelados  INTEGER NOT NULL DEFAULT 0,
  confirmacao_enviada_em TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_opt_out_instancia_msg UNIQUE (instancia, message_id)
);

-- Backfill: somente quem tem relacao contratual (cadastro/assinatura/empresa)
UPDATE remarketing_contatos
   SET consentimento_status     = 'concedido',
       consentimento_base_legal = 'relacao_contratual',
       consentimento_origem     = COALESCE(origem, 'assinatura'),
       consentimento_em         = COALESCE(created_at, NOW())
 WHERE consentimento_status = 'pendente'
   AND opt_out_em IS NULL
   AND (origem IN ('signup_pendente','assinatura')
        OR empresa_id IS NOT NULL
        OR estagio IN ('trial','cliente'));

COMMIT;

-- ============================================================
-- ROLLBACK (manual, somente se necessario)
-- ============================================================
-- BEGIN;
-- DROP TABLE IF EXISTS remarketing_opt_out_eventos;
-- ALTER TABLE remarketing_contatos DROP CONSTRAINT IF EXISTS chk_contatos_consentimento_status;
-- DROP INDEX IF EXISTS idx_contatos_opt_out;
-- DROP INDEX IF EXISTS idx_contatos_tel11;
-- ALTER TABLE remarketing_contatos
--   DROP COLUMN IF EXISTS consentimento_status,
--   DROP COLUMN IF EXISTS consentimento_base_legal,
--   DROP COLUMN IF EXISTS consentimento_origem,
--   DROP COLUMN IF EXISTS consentimento_em,
--   DROP COLUMN IF EXISTS opt_out_em,
--   DROP COLUMN IF EXISTS opt_out_motivo;
-- COMMIT;
