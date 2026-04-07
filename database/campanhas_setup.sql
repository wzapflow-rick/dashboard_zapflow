-- ============================================
-- ZapFlow - Campanhas Automáticas
-- Script PostgreSQL para NocoDB
-- ============================================

-- Tabela 1: campanhas_config
CREATE TABLE campanhas_config (
    id BIGSERIAL PRIMARY KEY,
    empresa_id TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'reengajamento',
    ativo BOOLEAN NOT NULL DEFAULT true,
    nome TEXT NOT NULL,
    gatilho_dias INTEGER,
    horario_envio TEXT,
    dias_semana TEXT,
    desconto_percentual NUMERIC(10,2) DEFAULT 0,
    variante_1 TEXT NOT NULL,
    variante_2 TEXT,
    variante_3 TEXT,
    variante_4 TEXT,
    max_envios_semana INTEGER NOT NULL DEFAULT 2,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- tipo: 'reengajamento' | 'cupom' | 'pos_pedido' | 'horario' | 'data_especial' | 'produto_destaque'
-- dias_semana: JSON array, ex: '["seg","ter","qua","qui","sex"]'
-- Trigger para atualizar atualizado_em automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_campanhas_config_updated_at
    BEFORE UPDATE ON campanhas_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Tabela 2: campanhas_disparos
CREATE TABLE campanhas_disparos (
    id BIGSERIAL PRIMARY KEY,
    empresa_id TEXT NOT NULL,
    campanha_id BIGINT NOT NULL,
    cliente_id BIGINT NOT NULL,
    telefone TEXT NOT NULL,
    variante_usada INTEGER NOT NULL DEFAULT 1,
    mensagem_enviada TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'enviado',
    erro_detalhe TEXT,
    enviado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para melhorar performance das consultas
CREATE INDEX idx_campanhas_config_empresa ON campanhas_config(empresa_id);
CREATE INDEX idx_campanhas_disparos_empresa ON campanhas_disparos(empresa_id, enviado_em DESC);
CREATE INDEX idx_campanhas_disparos_campanha ON campanhas_disparos(campanha_id);
