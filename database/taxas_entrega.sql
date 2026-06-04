-- =====================================================
-- TABELA DE TAXAS DE ENTREGA POR BAIRRO
-- =====================================================
-- Esta tabela armazena as taxas de entrega configuradas
-- por bairro para cada empresa.
-- =====================================================

CREATE TABLE IF NOT EXISTS taxas_entrega (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    bairro VARCHAR(255) NOT NULL,
    valor_taxa NUMERIC(10,2) NOT NULL DEFAULT 0,
    tempo_estimado VARCHAR(50),
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_taxas_entrega_empresa ON taxas_entrega(empresa_id);
CREATE INDEX idx_taxas_entrega_bairro ON taxas_entrega(bairro);

-- Exemplo de insercao:
-- INSERT INTO taxas_entrega (empresa_id, bairro, valor_taxa, tempo_estimado) 
-- VALUES (1, 'Centro', 5.00, '20-30');
