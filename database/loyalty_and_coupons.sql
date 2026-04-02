-- ============================================
-- ZAPFLOW - TABELAS DE CUPONS E FIDELIDADE
-- ============================================

-- 1. TABELA DE CUPONS
CREATE TABLE IF NOT EXISTS cupons (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    codigo VARCHAR(20) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('percentual', 'valor_fixo')),
    valor DECIMAL(10,2) NOT NULL DEFAULT 0,
    valor_minimo_pedido DECIMAL(10,2) NOT NULL DEFAULT 0,
    limite_uso INTEGER,
    usos_atuais INTEGER NOT NULL DEFAULT 0,
    data_inicio DATE,
    data_fim DATE,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(empresa_id, codigo)
);

CREATE INDEX idx_cupons_empresa ON cupons(empresa_id);
CREATE INDEX idx_cupons_codigo ON cupons(codigo);

-- 2. TABELA DE CONFIGURAÇÃO DE FIDELIDADE
CREATE TABLE IF NOT EXISTS loyalty_config (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL UNIQUE,
    pontos_por_real DECIMAL(10,2) NOT NULL DEFAULT 1,
    valor_ponto DECIMAL(10,2) NOT NULL DEFAULT 0.10,
    pontos_para_desconto INTEGER NOT NULL DEFAULT 100,
    desconto_tipo VARCHAR(20) NOT NULL DEFAULT 'valor_fixo',
    desconto_valor DECIMAL(10,2) NOT NULL DEFAULT 10,
    pontos_para_item_gratis INTEGER,
    ativo BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_loyalty_config_empresa ON loyalty_config(empresa_id);

-- 3. TABELA DE PONTOS DOS CLIENTES
CREATE TABLE IF NOT EXISTS loyalty_points (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    cliente_telefone VARCHAR(20) NOT NULL,
    cliente_nome VARCHAR(255),
    pontos_acumulados INTEGER NOT NULL DEFAULT 0,
    pontos_gastos INTEGER NOT NULL DEFAULT 0,
    total_gasto DECIMAL(10,2) NOT NULL DEFAULT 0,
    ultima_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(empresa_id, cliente_telefone)
);

CREATE INDEX idx_loyalty_points_empresa ON loyalty_points(empresa_id);
CREATE INDEX idx_loyalty_points_telefone ON loyalty_points(cliente_telefone);

-- 4. TABELA DE HISTÓRICO DE PONTOS (OPCIONAL)
CREATE TABLE IF NOT EXISTS loyalty_history (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    cliente_telefone VARCHAR(20) NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    pontos INTEGER NOT NULL,
    descricao VARCHAR(500),
    pedido_id INTEGER,
    data TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_loyalty_history_empresa ON loyalty_history(empresa_id);
CREATE INDEX idx_loyalty_history_data ON loyalty_history(data DESC);

-- ============================================
-- FUNÇÃO PARA ATUALIZAR updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cupons_updated_at BEFORE UPDATE ON cupons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loyalty_config_updated_at BEFORE UPDATE ON loyalty_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
