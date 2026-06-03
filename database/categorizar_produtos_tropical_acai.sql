-- =====================================================================
-- CATEGORIZAR PRODUTOS SEM CATEGORIA
-- Cliente: TROPICAL ACAI -> empresa_id = 63
-- Objetivo: mover todos os produtos com categoria_id NULL para a
--           categoria "Hamburguer".
-- O app (admin e cardapio publico) filtra SOMENTE por categoria_id.
-- A coluna legada "categorias" e ignorada e nao precisa ser alterada.
-- =====================================================================


-- ---------------------------------------------------------------------
-- STEP 0 — DESCOBERTA (somente leitura). Rode primeiro e confira.
-- ---------------------------------------------------------------------

-- 0.1 Confirma a empresa
SELECT id AS empresa_id, nome_fantasia, nome_admin, telefone_loja
FROM empresas
WHERE id = 63;

-- 0.2 Lista as categorias dessa empresa (confirme que ha UMA "Hamburguer")
SELECT id AS categoria_id, nome, ordem, disponivel
FROM categorias
WHERE empresa_id = 63
ORDER BY id;

-- 0.3 Quantos produtos serao afetados (estao sem categoria)
SELECT count(*) AS produtos_sem_categoria
FROM produtos
WHERE empresa_id = 63
  AND categoria_id IS NULL;

-- 0.4 Lista os produtos que serao alterados (confira se faz sentido)
SELECT id, nome, preco, categoria_id
FROM produtos
WHERE empresa_id = 63
  AND categoria_id IS NULL
ORDER BY id;


-- ---------------------------------------------------------------------
-- STEP 1 — UPDATE (transacional e auto-localizado).
-- Localiza a categoria "Hamburguer" da empresa 63 automaticamente
-- (nome comecando com "hamburg", ignorando emoji/maiusculas) e move
-- todos os produtos sem categoria para ela.
-- ---------------------------------------------------------------------

BEGIN;

WITH cat AS (
  SELECT id
  FROM categorias
  WHERE empresa_id = 63
    AND nome ILIKE 'hamburg%'
  ORDER BY id
  LIMIT 1
)
UPDATE produtos p
SET categoria_id = (SELECT id FROM cat)
WHERE p.empresa_id = 63
  AND p.categoria_id IS NULL
  AND (SELECT id FROM cat) IS NOT NULL;

-- Confira o resultado AINDA dentro da transacao:
SELECT id, nome, categoria_id
FROM produtos
WHERE empresa_id = 63
ORDER BY id;

-- Se estiver tudo certo:
COMMIT;

-- Se algo estiver errado, em vez do COMMIT acima rode:
-- ROLLBACK;
