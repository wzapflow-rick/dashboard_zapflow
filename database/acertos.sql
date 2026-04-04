-- =====================================================
-- TABELA DE ACERTOS DE ENTREGADORES
-- ZapFlow - Sistema de Delivery
-- PostgreSQL (usado com NocoDB)
-- =====================================================

-- Criar tabela de acertos
CREATE TABLE IF NOT EXISTS acertos_entregadores (
    id SERIAL PRIMARY KEY,
    entregador_id INTEGER NOT NULL,
    empresa_id INTEGER NOT NULL,
    data_acerto DATE DEFAULT CURRENT_DATE,
    valor_taxas DECIMAL(10,2) DEFAULT 0, -- Total de taxas de entrega a receber
    valor_recebido DECIMAL(10,2) DEFAULT 0, -- Valor recebido em dinheiro do cliente
    valor_liquido DECIMAL(10,2) DEFAULT 0, -- valor_taxas - valor_recebido (o que a empresa deve pagar)
    quantidade_entregas INTEGER DEFAULT 0,
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Adicionar coluna de taxação por entrega na tabela de entregadores (se não existir)
-- Esta coluna indica quanto a empresa paga por entrega ao entregador
-- ALTER TABLE entregadores ADD COLUMN IF NOT EXISTS valor_por_entrega DECIMAL(10,2) DEFAULT 0;

-- Adicionar coluna data_agendamento na tabela de pedidos
-- ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS data_agendamento TIMESTAMP;

-- Índices para buscas
CREATE INDEX idx_acertos_entregador ON acertos_entregadores(entregador_id);
CREATE INDEX idx_acertos_empresa ON acertos_entregadores(empresa_id);
CREATE INDEX idx_acertos_data ON acertos_entregadores(data_acerto);

-- =====================================================
-- NOTAS DE CONFIGURAÇÃO:
-- 1. ID da tabela no NocoDB: 'm25kv7bfnre70sd'
-- 2. Adicionar coluna 'valor_por_entrega' na tabela de entregadores
-- =====================================================