-- Opcao B: um unico primeiro contato (interesse legitimo) para leads sem consentimento.
BEGIN;

ALTER TABLE remarketing_contatos
  ADD COLUMN IF NOT EXISTS contato_inicial_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_remarketing_contatos_primeiro_contato
  ON remarketing_contatos (consentimento_status, contato_inicial_em)
  WHERE consentimento_status = 'pendente';

COMMIT;

-- Verificacao
SELECT consentimento_status,
       COUNT(*) FILTER (WHERE contato_inicial_em IS NULL)     AS aguardando_1o_contato,
       COUNT(*) FILTER (WHERE contato_inicial_em IS NOT NULL) AS ja_contatados
  FROM remarketing_contatos
 GROUP BY consentimento_status;
