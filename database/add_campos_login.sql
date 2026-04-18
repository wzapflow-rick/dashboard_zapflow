-- Adicionar campos de login na tabela empresas
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS senha_hash VARCHAR(255);
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS login VARCHAR(255);
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;

-- Criar índices para login rápido
CREATE INDEX IF NOT EXISTS idx_empresas_login ON empresas(login);
CREATE INDEX IF NOT EXISTS idx_empresas_email_auth ON empresas(email);