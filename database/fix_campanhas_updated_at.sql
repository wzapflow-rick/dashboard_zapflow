-- ============================================================
-- FIX: erro "record \"new\" has no field \"updated_at\""
-- ao editar/atualizar uma campanha em campanhas_config
-- ============================================================
--
-- CAUSA:
-- A função global update_updated_at_column() foi redefinida
-- (CREATE OR REPLACE) para setar NEW.updated_at, mas a tabela
-- campanhas_config usa a coluna "atualizado_em" (não "updated_at").
-- O trigger set_campanhas_config_updated_at chamava essa função
-- global e falhava em todo UPDATE.
--
-- SOLUÇÃO:
-- Dar à campanhas_config um trigger com função DEDICADA que
-- usa a coluna correta (atualizado_em), sem depender da função
-- global compartilhada pelas outras tabelas.
-- ============================================================

-- 1) Remove quaisquer triggers antigos/conflitantes desta tabela
DROP TRIGGER IF EXISTS set_campanhas_config_updated_at ON campanhas_config;
DROP TRIGGER IF EXISTS trg_campanhas_config_updated_at ON campanhas_config;

-- 2) Função dedicada que atualiza a coluna correta desta tabela
CREATE OR REPLACE FUNCTION update_campanhas_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Recria o trigger apontando para a função dedicada
CREATE TRIGGER trg_campanhas_config_atualizado_em
    BEFORE UPDATE ON campanhas_config
    FOR EACH ROW
    EXECUTE FUNCTION update_campanhas_atualizado_em();

-- ============================================================
-- Após rodar este script, editar campanhas volta a funcionar.
-- ============================================================
