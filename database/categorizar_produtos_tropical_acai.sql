-- =====================================================================
-- CATEGORIZAR PRODUTOS "SEM CATEGORIA"
-- Cliente: TROPICAL ACAI -> empresa_id = 63
--
-- DIAGNOSTICO (confirmado em producao):
--   - 34 produtos tinham categoria_id = 61 -> categoria 61 NAO EXISTE
--     (orfã, foi deletada). Por isso apareciam como "Sem Categoria".
--   - 3 produtos ja estavam na categoria 62 = "Hamburguer" (correta).
--   - A unica categoria real da empresa 63 e o id 62.
--
-- Objetivo: mover todo produto da empresa 63 cuja categoria nao exista
--           ou nao pertenca a ela para a categoria 62.
-- O app (admin e cardapio publico) filtra SOMENTE por categoria_id.
-- =====================================================================


-- ---------------------------------------------------------------------
-- STEP 0 — DIAGNOSTICO (somente leitura).
-- ---------------------------------------------------------------------

-- 0.1 Categorias reais da empresa 63 (esperado: apenas id 62 = Hamburguer)
SELECT id AS categoria_id, nome, ordem, disponivel
FROM categorias
WHERE empresa_id = 63
ORDER BY id;

-- 0.2 Para cada categoria_id usado pelos produtos: existe? e de quem e?
SELECT
  p.categoria_id,
  count(*)      AS qtd_produtos,
  c.id          AS categoria_existe,
  c.nome        AS categoria_nome,
  c.empresa_id  AS categoria_dona
FROM produtos p
LEFT JOIN categorias c ON c.id = p.categoria_id
WHERE p.empresa_id = 63
GROUP BY p.categoria_id, c.id, c.nome, c.empresa_id
ORDER BY p.categoria_id;


-- ---------------------------------------------------------------------
-- STEP 1 — UPDATE (transacional).
-- Move para a categoria 62 todo produto da empresa 63 cuja categoria
-- atual NAO EXISTA ou NAO PERTENCA a empresa 63 (cobre NULL e orfãos).
-- Preserva os que ja estao corretos (categoria_id = 62).
-- ---------------------------------------------------------------------

BEGIN;

UPDATE produtos p
SET categoria_id = 62
WHERE p.empresa_id = 63
  AND p.categoria_id IS DISTINCT FROM 62
  AND NOT EXISTS (
    SELECT 1 FROM categorias c
    WHERE c.id = p.categoria_id
      AND c.empresa_id = 63
  );

-- Confira o resultado AINDA dentro da transacao:
-- esperado: uma unica linha -> categoria_id = 62, qtd = 37
SELECT categoria_id, count(*) AS qtd
FROM produtos
WHERE empresa_id = 63
GROUP BY categoria_id
ORDER BY categoria_id;

-- Se estiver tudo certo:
COMMIT;

-- Se algo estiver errado, em vez do COMMIT acima rode:
-- ROLLBACK;
