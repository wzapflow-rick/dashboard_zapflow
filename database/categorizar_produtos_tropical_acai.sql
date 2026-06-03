-- =====================================================================
-- CATEGORIZAR PRODUTOS SEM CATEGORIA
-- Cliente: TROPICAL ACAI -> empresa_id = 63
-- Objetivo: mover todos os produtos com categoria_id NULL para a
--           UNICA categoria existente dessa empresa.
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

-- 0.2 Confirma que ha EXATAMENTE UMA categoria nessa empresa
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
-- Usa a UNICA categoria da empresa 63 e move todos os produtos sem
-- categoria para ela. Se houver mais de uma categoria, o UPDATE NAO
-- altera nada (protecao) e voce vera o aviso abaixo.
-- ---------------------------------------------------------------------

BEGIN;

WITH cat AS (
  -- Pega a categoria somente se existir EXATAMENTE uma para a empresa 63
  SELECT max(id) AS id
  FROM categorias
  WHERE empresa_id = 63
  HAVING count(*) = 1
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
