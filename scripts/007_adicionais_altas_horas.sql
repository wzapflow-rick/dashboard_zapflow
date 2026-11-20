-- Adicionais da loja Altas Horas (empresa_id = 82).
-- Cria 2 grupos ("Adicionais" e "Adicional sachê"), seus itens e vincula
-- os grupos a todos os produtos da loja, exceto os de categorias de bebida.
-- Pode ser executado mais de uma vez: não duplica grupos, itens nem vínculos.
--
-- ANTES de rodar, confira os nomes das categorias que serão ignoradas:
--   SELECT id, nome FROM categorias WHERE empresa_id = 82 ORDER BY nome;
-- Se a categoria de bebidas tiver outro nome (ex.: "Refrigerantes", "Sucos"),
-- ajuste o filtro em "categorias_bebida" mais abaixo.

BEGIN;

-- 1) Grupos
INSERT INTO grupos_complementos (empresa_id, nome, descricao, tipo, max_opcoes, obrigatorio, created_at, updated_at)
SELECT 82, g.nome, g.descricao, 'multipla', g.max_opcoes, false, NOW(), NOW()
FROM (VALUES
    ('Adicionais', 'Turbine seu pedido', 10),
    ('Adicional sachê', 'Sachês extras', 3)
) AS g(nome, descricao, max_opcoes)
WHERE NOT EXISTS (
    SELECT 1 FROM grupos_complementos gc WHERE gc.empresa_id = 82 AND gc.nome = g.nome
);

-- 2) Itens
INSERT INTO complementos (empresa_id, grupo_id, nome, preco, disponivel, created_at, updated_at)
SELECT 82, gc.id, i.nome, i.preco, true, NOW(), NOW()
FROM (VALUES
    ('Adicionais', 'Catupiry', 10.00),
    ('Adicionais', 'Cheddar', 10.00),
    ('Adicionais', 'Bacon', 12.00),
    ('Adicionais', 'Ovo', 4.00),
    ('Adicionais', 'Bife de hambúrguer', 6.00),
    ('Adicionais', 'Frango', 15.00),
    ('Adicionais', 'Lombo', 18.00),
    ('Adicionais', 'Salada', 6.00),
    ('Adicionais', 'Batata palha', 5.00),
    ('Adicionais', 'Milho', 4.00),
    ('Adicional sachê', 'Maionese', 1.00),
    ('Adicional sachê', 'Catchup', 1.00),
    ('Adicional sachê', 'Mostarda', 1.00)
) AS i(grupo, nome, preco)
JOIN grupos_complementos gc ON gc.empresa_id = 82 AND gc.nome = i.grupo
WHERE NOT EXISTS (
    SELECT 1 FROM complementos c WHERE c.grupo_id = gc.id AND c.nome = i.nome
);

-- 3) Vínculo com os produtos (menos bebidas)
WITH categorias_bebida AS (
    SELECT id FROM categorias
    WHERE empresa_id = 82
      AND (nome ILIKE '%bebida%' OR nome ILIKE '%refri%' OR nome ILIKE '%suco%'
           OR nome ILIKE '%cerveja%' OR nome ILIKE '%drink%' OR nome ILIKE '%água%' OR nome ILIKE '%agua%')
),
grupos AS (
    SELECT id, CASE nome WHEN 'Adicionais' THEN 0 ELSE 1 END AS ordem
    FROM grupos_complementos
    WHERE empresa_id = 82 AND nome IN ('Adicionais', 'Adicional sachê')
)
INSERT INTO produto_grupos_complementos (empresa_id, produto_id, grupo_complemento_id, obrigatorio, ordem, created_at, updated_at)
SELECT 82, p.id, g.id, false, g.ordem, NOW(), NOW()
FROM produtos p
CROSS JOIN grupos g
WHERE p.empresa_id = 82
  AND (p.categoria_id IS NULL OR p.categoria_id NOT IN (SELECT id FROM categorias_bebida))
  AND NOT EXISTS (
      SELECT 1 FROM produto_grupos_complementos pgc
      WHERE pgc.produto_id = p.id AND pgc.grupo_complemento_id = g.id
  );

-- Conferência: produtos que ficaram com adicionais
SELECT p.nome AS produto, string_agg(gc.nome, ', ' ORDER BY pgc.ordem) AS grupos
FROM produto_grupos_complementos pgc
JOIN produtos p ON p.id = pgc.produto_id
JOIN grupos_complementos gc ON gc.id = pgc.grupo_complemento_id
WHERE pgc.empresa_id = 82
GROUP BY p.nome
ORDER BY p.nome;

COMMIT;
