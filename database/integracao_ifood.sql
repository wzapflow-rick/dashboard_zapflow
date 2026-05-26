-- =====================================================
-- INTEGRACAO IFOOD - Campos para credenciais
-- Execute no pgAdmin APENAS quando tiver a aprovacao do iFood
-- =====================================================

-- Etapa 1: Adicionar colunas de credenciais iFood
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS ifood_client_id VARCHAR(100);
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS ifood_client_secret VARCHAR(200);
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS ifood_access_token TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS ifood_refresh_token TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS ifood_token_expires_at TIMESTAMP;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS ifood_merchant_id VARCHAR(100);
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS ifood_ativo BOOLEAN DEFAULT false;

-- Etapa 2: Criar indice
CREATE INDEX IF NOT EXISTS idx_empresas_ifood_merchant ON empresas(ifood_merchant_id);

-- Etapa 3: Comentarios
COMMENT ON COLUMN empresas.ifood_client_id IS 'Client ID do app iFood';
COMMENT ON COLUMN empresas.ifood_client_secret IS 'Client Secret do app iFood';
COMMENT ON COLUMN empresas.ifood_merchant_id IS 'ID da loja no iFood';
COMMENT ON COLUMN empresas.ifood_ativo IS 'Se a integracao iFood esta ativa';
