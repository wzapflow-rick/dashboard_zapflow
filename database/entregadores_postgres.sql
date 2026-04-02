-- =====================================================
-- ZAPFLOW - Tabelas para Sistema de Entregadores
-- Compatível com PostgreSQL
-- =====================================================

-- =====================================================
-- 1. TABELA DE ENTREGADORES
-- =====================================================
CREATE TABLE IF NOT EXISTS entregadores (
    id SERIAL PRIMARY KEY,
    
    -- Dados pessoais
    nome VARCHAR(255) NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    
    -- Login (senha é o telefone por segurança)
    senha_hash VARCHAR(255),
    
    -- Dados do veículo
    veiculo VARCHAR(50) NOT NULL,
    placa VARCHAR(15),
    foto_url TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'offline',
    ativo BOOLEAN DEFAULT TRUE,
    
    -- Métricas
    comissao_por_entrega NUMERIC(10, 2) DEFAULT 0.00,
    entregas_hoje INTEGER DEFAULT 0,
    entregas_total INTEGER DEFAULT 0,
    avaliacao NUMERIC(2, 1) DEFAULT 5.0,
    
    -- Relacionamento com empresa
    empresa_id INTEGER,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_entregadores_empresa ON entregadores(empresa_id);
CREATE INDEX idx_entregadores_status ON entregadores(status);
CREATE INDEX idx_entregadores_ativo ON entregadores(ativo);

-- =====================================================
-- 2. TABELA DE HISTÓRICO DE ENTREGAS
-- =====================================================
CREATE TABLE IF NOT EXISTS historico_entregas (
    id SERIAL PRIMARY KEY,
    
    -- Relacionamentos
    pedido_id INTEGER NOT NULL,
    entregador_id INTEGER NOT NULL,
    empresa_id INTEGER NOT NULL,
    
    -- Dados da entrega
    endereco TEXT,
    bairro VARCHAR(255),
    distancia_km NUMERIC(10, 2),
    tempo_estimado_min INTEGER,
    tempo_real_min INTEGER,
    
    -- Valores
    valor_pedido NUMERIC(10, 2),
    taxa_entrega NUMERIC(10, 2),
    comissao NUMERIC(10, 2),
    
    -- Status da entrega
    status VARCHAR(20) DEFAULT 'atribuida',
    
    -- Avaliação do cliente
    avaliacao_cliente INTEGER,
    feedback_cliente TEXT,
    
    -- Timestamps
    atribuida_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    coletada_em TIMESTAMP,
    entregue_em TIMESTAMP,
    cancelada_em TIMESTAMP
);

CREATE INDEX idx_historico_entregador ON historico_entregas(entregador_id);
CREATE INDEX idx_historico_pedido ON historico_entregas(pedido_id);
CREATE INDEX idx_historico_empresa ON historico_entregas(empresa_id);
CREATE INDEX idx_historico_status ON historico_entregas(status);
CREATE INDEX idx_historico_data ON historico_entregas(atribuida_em);

-- =====================================================
-- 3. TABELA DE COMISSÕES (para relatórios)
-- =====================================================
CREATE TABLE IF NOT EXISTS comissoes_entregadores (
    id SERIAL PRIMARY KEY,
    
    -- Relacionamentos
    entregador_id INTEGER NOT NULL,
    empresa_id INTEGER NOT NULL,
    
    -- Período
    data DATE NOT NULL,
    semana INTEGER,
    mes INTEGER,
    ano INTEGER,
    
    -- Métricas do dia
    total_entregas INTEGER DEFAULT 0,
    valor_total_pedidos NUMERIC(10, 2) DEFAULT 0.00,
    taxa_entrega_total NUMERIC(10, 2) DEFAULT 0.00,
    comissao_total NUMERIC(10, 2) DEFAULT 0.00,
    
    -- Status do pagamento da comissão
    comissao_paga BOOLEAN DEFAULT FALSE,
    data_pagamento DATE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraint única para evitar duplicatas
    CONSTRAINT uk_entregador_data UNIQUE (entregador_id, data)
);

CREATE INDEX idx_comissoes_entregador ON comissoes_entregadores(entregador_id);
CREATE INDEX idx_comissoes_empresa ON comissoes_entregadores(empresa_id);
CREATE INDEX idx_comissoes_data ON comissoes_entregadores(data);
CREATE INDEX idx_comissoes_periodo ON comissoes_entregadores(ano, mes);

-- =====================================================
-- 4. TABELA DE CONFIGURAÇÕES DE ENTREGA
-- =====================================================
CREATE TABLE IF NOT EXISTS configuracoes_entrega (
    id SERIAL PRIMARY KEY,
    
    -- Relacionamento
    empresa_id INTEGER NOT NULL UNIQUE,
    
    -- Configurações gerais
    entrega_ativa BOOLEAN DEFAULT TRUE,
    taxa_fixa NUMERIC(10, 2) DEFAULT 0.00,
    raio_maximo_km NUMERIC(10, 2) DEFAULT 0.00,
    
    -- Configurações de entregador
    max_entregadores_simultaneos INTEGER DEFAULT 5,
    tempo_limite_coleta_min INTEGER DEFAULT 15,
    tempo_limite_entrega_min INTEGER DEFAULT 45,
    
    -- Comissões
    comissao_padrao NUMERIC(10, 2) DEFAULT 5.00,
    comissao_bonus_km NUMERIC(10, 2) DEFAULT 1.00,
    comissao_bonus_noite NUMERIC(10, 2) DEFAULT 2.00,
    
    -- Notificações
    notificar_whatsapp BOOLEAN DEFAULT TRUE,
    template_mensagem TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_config_entrega_empresa ON configuracoes_entrega(empresa_id);

-- =====================================================
-- 5. TRIGGER PARA ATUALIZAR updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_entregadores_updated_at 
    BEFORE UPDATE ON entregadores 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_config_entrega_updated_at 
    BEFORE UPDATE ON configuracoes_entrega 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. ATUALIZAR TABELA DE PEDIDOS (adicionar campo entregador)
-- =====================================================
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS entregador_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_pedidos_entregador ON pedidos(entregador_id);

-- =====================================================
-- QUERIES ÚTEIS
-- =====================================================

-- Buscar entregadores disponíveis de uma empresa
-- SELECT * FROM entregadores 
-- WHERE empresa_id = $1 AND status = 'disponivel' AND ativo = TRUE;

-- Buscar pedidos com entregador
-- SELECT p.*, e.nome as entregador_nome, e.telefone as entregador_telefone
-- FROM pedidos p
-- LEFT JOIN entregadores e ON p.entregador_id = e.id
-- WHERE p.empresa_id = $1;

-- Relatório de entregas por entregador (hoje)
-- SELECT 
--     e.nome,
--     e.veiculo,
--     COUNT(h.id) as total_entregas,
--     COALESCE(SUM(h.comissao), 0) as comissao_total
-- FROM entregadores e
-- LEFT JOIN historico_entregas h ON e.id = h.entregador_id 
--     AND DATE(h.atribuida_em) = CURRENT_DATE
--     AND h.status = 'entregue'
-- WHERE e.empresa_id = $1
-- GROUP BY e.id
-- ORDER BY total_entregas DESC;

-- Ranking de entregadores do mês
-- SELECT 
--     e.nome,
--     e.avaliacao,
--     COUNT(h.id) as total_entregas,
--     COALESCE(SUM(h.comissao), 0) as comissao_total,
--     COALESCE(AVG(h.avaliacao_cliente), 0) as media_avaliacao
-- FROM entregadores e
-- INNER JOIN historico_entregas h ON e.id = h.entregador_id
-- WHERE e.empresa_id = $1
--     AND EXTRACT(MONTH FROM h.atribuida_em) = EXTRACT(MONTH FROM CURRENT_DATE)
--     AND h.status = 'entregue'
-- GROUP BY e.id
-- ORDER BY total_entregas DESC;

-- Comissões pendentes de pagamento
-- SELECT 
--     e.nome,
--     SUM(c.comissao_total) as comissao_pendente
-- FROM comissoes_entregadores c
-- INNER JOIN entregadores e ON c.entregador_id = e.id
-- WHERE c.empresa_id = $1
--     AND c.comissao_paga = FALSE
-- GROUP BY e.id;

-- Resetar entregas diárias (executar diariamente via cron)
-- UPDATE entregadores SET entregas_hoje = 0;
