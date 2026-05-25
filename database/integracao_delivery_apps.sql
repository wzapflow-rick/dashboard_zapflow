-- =====================================================
-- INTEGRACAO COM APPS DE ENTREGA (iFood, Rappi, etc.)
-- Execute este script no pgAdmin
-- =====================================================

-- 1. Adicionar coluna 'origem' na tabela pedidos
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS origem VARCHAR(50) DEFAULT 'whatsapp';
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pedido_externo_id VARCHAR(100);

-- 2. Adicionar coluna 'webhook_token' na tabela empresas (para autenticacao)
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS webhook_token VARCHAR(64);

-- 3. Adicionar coluna 'origem' na tabela clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS origem VARCHAR(50) DEFAULT 'whatsapp';

-- 4. Criar indices para performance
CREATE INDEX IF NOT EXISTS idx_pedidos_origem ON pedidos(origem);
CREATE INDEX IF NOT EXISTS idx_pedidos_externo_id ON pedidos(pedido_externo_id);
CREATE INDEX IF NOT EXISTS idx_empresas_webhook_token ON empresas(webhook_token);

-- 5. Gerar tokens para empresas existentes (executar separadamente se quiser)
-- UPDATE empresas SET webhook_token = encode(gen_random_bytes(32), 'hex') WHERE webhook_token IS NULL;

-- =====================================================
-- COMENTARIOS
-- =====================================================
COMMENT ON COLUMN pedidos.origem IS 'Origem do pedido: whatsapp, ifood, rappi, 99food, aiqfome, ubereats, manual, outros';
COMMENT ON COLUMN pedidos.pedido_externo_id IS 'ID do pedido na plataforma externa (para evitar duplicatas)';
COMMENT ON COLUMN empresas.webhook_token IS 'Token de autenticacao para receber pedidos via webhook';
