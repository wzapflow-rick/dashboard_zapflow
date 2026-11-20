-- Execute este script no banco cardapio pelo pgAdmin (Query Tool).
-- Cria a opcao "aceita dinheiro" por empresa (padrao: aceita) e desativa para a Altas Horas.

ALTER TABLE empresas
ADD COLUMN IF NOT EXISTS aceita_dinheiro BOOLEAN;

UPDATE empresas
SET aceita_dinheiro = TRUE
WHERE aceita_dinheiro IS NULL;

ALTER TABLE empresas
ALTER COLUMN aceita_dinheiro SET DEFAULT TRUE;

ALTER TABLE empresas
ALTER COLUMN aceita_dinheiro SET NOT NULL;

UPDATE empresas
SET aceita_dinheiro = FALSE
WHERE id = 82;

-- Verificacao
SELECT id, nome_fantasia, aceita_dinheiro
FROM empresas
ORDER BY id;
