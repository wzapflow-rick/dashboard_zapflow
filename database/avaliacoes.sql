-- =====================================================
-- TABELA DE AVALIAÇÕES DE PEDIDOS (RATINGS)
-- ZapFlow - Sistema de Delivery
-- PostgreSQL (usado com NocoDB)
-- =====================================================

-- Criar tabela de avaliações
CREATE TABLE IF NOT EXISTS avaliacoes (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL,
    empresa_id INTEGER NOT NULL,
    telefone_cliente VARCHAR(20),
    nota_comida INTEGER DEFAULT 0 CHECK (nota_comida BETWEEN 1 AND 5),
    nota_entrega INTEGER DEFAULT 0 CHECK (nota_entrega BETWEEN 1 AND 5),
    comentario TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para buscas por empresa
CREATE INDEX idx_avaliacoes_empresa ON avaliacoes(empresa_id);

-- Índice para buscas por pedido
CREATE INDEX idx_avaliacoes_pedido ON avaliacoes(pedido_id);

-- Adicionar restrição de updated_at com trigger (opcional)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON avaliacoes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- NOTAS DE CONFIGURAÇÃO:
-- 1. Substitua o ID da tabela em app/actions/ratings.ts
--    Linha: const RATINGS_TABLE_ID = 'mratings123456';
-- 2. O ID gerado pelo NocoDB será algo como 'mxxxxx'
-- 3. Após criar no PostgreSQL, o NocoDB detectará automaticamente
-- =====================================================