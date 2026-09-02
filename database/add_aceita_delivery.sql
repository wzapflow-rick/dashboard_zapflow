-- Execute este script no banco radar_jk pelo pgAdmin (Query Tool).
-- A operacao e idempotente e nao remove nem altera dados existentes.

ALTER TABLE empresas
ADD COLUMN IF NOT EXISTS aceita_delivery BOOLEAN;

UPDATE empresas
SET aceita_delivery = TRUE
WHERE aceita_delivery IS NULL;

ALTER TABLE empresas
ALTER COLUMN aceita_delivery SET DEFAULT TRUE;

ALTER TABLE empresas
ALTER COLUMN aceita_delivery SET NOT NULL;

-- Verificacao: todas as empresas e a modalidade atualmente configurada.
SELECT
  id,
  nome_fantasia,
  aceita_delivery
FROM empresas
ORDER BY id;
