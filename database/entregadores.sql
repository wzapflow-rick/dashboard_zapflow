-- =====================================================
-- ZAPFLOW - Tabelas para Sistema de Entregadores
-- Compatível com MySQL/MariaDB (usado pelo NocoDB)
-- =====================================================

-- =====================================================
-- 1. TABELA DE ENTREGADORES
-- =====================================================
CREATE TABLE IF NOT EXISTS entregadores (
    id INT PRIMARY KEY AUTO_INCREMENT,
    
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
    ativo TINYINT(1) DEFAULT 1,
    
    -- Métricas
    comissao_por_entrega DECIMAL(10, 2) DEFAULT 0.00,
    entregas_hoje INT DEFAULT 0,
    entregas_total INT DEFAULT 0,
    avaliacao DECIMAL(2, 1) DEFAULT 5.0,
    
    -- Relacionamento com empresa
    empresa_id INT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Índices
    INDEX idx_empresa (empresa_id),
    INDEX idx_status (status),
    INDEX idx_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- 2. TABELA DE HISTÓRICO DE ENTREGAS
-- =====================================================
CREATE TABLE IF NOT EXISTS historico_entregas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Relacionamentos
    pedido_id INT NOT NULL,
    entregador_id INT NOT NULL,
    empresa_id INT NOT NULL,
    
    -- Dados da entrega
    endereco TEXT,
    bairro VARCHAR(255),
    distancia_km DECIMAL(10, 2),
    tempo_estimado_min INT,
    tempo_real_min INT,
    
    -- Valores
    valor_pedido DECIMAL(10, 2),
    taxa_entrega DECIMAL(10, 2),
    comissao DECIMAL(10, 2),
    
    -- Status da entrega
    status VARCHAR(20) DEFAULT 'atribuida',
    
    -- Avaliação do cliente
    avaliacao_cliente INT,
    feedback_cliente TEXT,
    
    -- Timestamps
    atribuida_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    coletada_em TIMESTAMP NULL,
    entregue_em TIMESTAMP NULL,
    cancelada_em TIMESTAMP NULL,
    
    -- Índices
    INDEX idx_entregador (entregador_id),
    INDEX idx_pedido (pedido_id),
    INDEX idx_empresa (empresa_id),
    INDEX idx_status (status),
    INDEX idx_data (atribuida_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- 3. TABELA DE COMISSÕES (para relatórios)
-- =====================================================
CREATE TABLE IF NOT EXISTS comissoes_entregadores (
    id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Relacionamentos
    entregador_id INT NOT NULL,
    empresa_id INT NOT NULL,
    
    -- Período
    data DATE NOT NULL,
    semana INT,
    mes INT,
    ano INT,
    
    -- Métricas do dia
    total_entregas INT DEFAULT 0,
    valor_total_pedidos DECIMAL(10, 2) DEFAULT 0.00,
    taxa_entrega_total DECIMAL(10, 2) DEFAULT 0.00,
    comissao_total DECIMAL(10, 2) DEFAULT 0.00,
    
    -- Status do pagamento da comissão
    comissao_paga TINYINT(1) DEFAULT 0,
    data_pagamento DATE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Índices
    INDEX idx_entregador (entregador_id),
    INDEX idx_empresa (empresa_id),
    INDEX idx_data (data),
    INDEX idx_periodo (ano, mes),
    
    -- Constraint única para evitar duplicatas
    UNIQUE KEY uk_entregador_data (entregador_id, data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- 4. TABELA DE CONFIGURAÇÕES DE ENTREGA
-- =====================================================
CREATE TABLE IF NOT EXISTS configuracoes_entrega (
    id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Relacionamento
    empresa_id INT NOT NULL,
    
    -- Configurações gerais
    entrega_ativa TINYINT(1) DEFAULT 1,
    taxa_fixa DECIMAL(10, 2) DEFAULT 0.00,
    raio_maximo_km DECIMAL(10, 2) DEFAULT 0.00,
    
    -- Configurações de entregador
    max_entregadores_simultaneos INT DEFAULT 5,
    tempo_limite_coleta_min INT DEFAULT 15,
    tempo_limite_entrega_min INT DEFAULT 45,
    
    -- Comissões
    comissao_padrao DECIMAL(10, 2) DEFAULT 5.00,
    comissao_bonus_km DECIMAL(10, 2) DEFAULT 1.00,
    comissao_bonus_noite DECIMAL(10, 2) DEFAULT 2.00,
    
    -- Notificações
    notificar_whatsapp TINYINT(1) DEFAULT 1,
    template_mensagem TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Índices
    INDEX idx_empresa (empresa_id),
    UNIQUE KEY uk_empresa (empresa_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- 5. ATUALIZAR TABELA DE PEDIDOS (adicionar campo entregador)
-- =====================================================
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS entregador_id INT NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_entregador ON pedidos(entregador_id);

-- =====================================================
-- 6. DADOS INICIAIS (OPCIONAL)
-- =====================================================

-- Exemplo de configuração inicial (substitua EMPRESA_ID pelo ID real)
-- INSERT INTO configuracoes_entrega (empresa_id, entrega_ativa, comissao_padrao)
-- VALUES (EMPRESA_ID, TRUE, 5.00)
-- ON DUPLICATE KEY UPDATE empresa_id = empresa_id;

-- =====================================================
-- QUERIES ÚTEIS
-- =====================================================

-- Buscar entregadores disponíveis de uma empresa
-- SELECT * FROM entregadores 
-- WHERE empresa_id = ? AND status = 'disponivel' AND ativo = TRUE;

-- Buscar pedidos com entregador
-- SELECT p.*, e.nome as entregador_nome, e.telefone as entregador_telefone
-- FROM pedidos p
-- LEFT JOIN entregadores e ON p.entregador_id = e.id
-- WHERE p.empresa_id = ?;

-- Relatório de entregas por entregador (hoje)
-- SELECT 
--     e.nome,
--     e.veiculo,
--     COUNT(h.id) as total_entregas,
--     SUM(h.comissao) as comissao_total
-- FROM entregadores e
-- LEFT JOIN historico_entregas h ON e.id = h.entregador_id 
--     AND DATE(h.atribuida_em) = CURDATE()
--     AND h.status = 'entregue'
-- WHERE e.empresa_id = ?
-- GROUP BY e.id
-- ORDER BY total_entregas DESC;

-- Ranking de entregadores do mês
-- SELECT 
--     e.nome,
--     e.avaliacao,
--     COUNT(h.id) as total_entregas,
--     SUM(h.comissao) as comissao_total,
--     AVG(h.avaliacao_cliente) as media_avaliacao
-- FROM entregadores e
-- INNER JOIN historico_entregas h ON e.id = h.entregador_id
-- WHERE e.empresa_id = ?
--     AND MONTH(h.atribuida_em) = MONTH(CURDATE())
--     AND h.status = 'entregue'
-- GROUP BY e.id
-- ORDER BY total_entregas DESC;

-- Comissões pendentes de pagamento
-- SELECT 
--     e.nome,
--     SUM(c.comissao_total) as comissao_pendente
-- FROM comissoes_entregadores c
-- INNER JOIN entregadores e ON c.entregador_id = e.id
-- WHERE c.empresa_id = ?
--     AND c.comissao_paga = FALSE
-- GROUP BY e.id;
