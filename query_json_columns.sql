-- Adicionar colunas JSON nas tabelas existentes

-- 1. Na tabela de GRUPOS_SLOTS adicionar coluna para storing itens (JSON array)
-- Execute no NocoDB: adicionar coluna "itens" do tipo JSON ou LongText

-- 2. Na tabela de PRODUTOS adicionar coluna para storing grupos_slots (JSON array)  
-- Execute no NocoDB: adicionar coluna "grupos" do tipo JSON ou LongText

-- 3. Na tabela de ITENS_BASE não precisa de mudanças, já temos a biblioteca

-- Exemplo de valores JSON:
-- grupos_slots.itens = [1, 2, 3]  (array de IDs de itens_base)
-- produtos.grupos = [1, 2]  (array de IDs de grupos_slots)