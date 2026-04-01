-- Implementação do Sistema de Slots (v2 - SIMPLIFICADA)

-- Colunas necessárias no NocoDB:

-- 1. ITENS_BASE (micgsgj6jtr8i8m)
-- Já deve ter: id, nome, preco_sugerido, preco_custo
-- Adicionar: empresa (number)

-- 2. GRUPOS_SLOTS (momln55c27s3k9j)  
-- Já deve ter: id, nome, descricao, tipo, qtd_slots, regra_preco, min_slots, max_slots
-- Adicionar: empresa (number), itens (JSON array - ex: [1,2,3])

-- 3. PRODUTOS (mdm2nwjjpv5g3e)
-- Já deve ter: todos os campos existentes
-- Adicionar: grupos (JSON array - ex: [1,2])

-- exemplo de valores JSON:
-- grupos_slots.itens = "[1, 5, 10]"  (array de IDs de itens_base)
-- produtos.grupos = "[1, 3]"  (array de IDs de grupos_slots)