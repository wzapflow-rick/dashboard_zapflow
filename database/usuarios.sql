-- =====================================================
-- ZAPFLOW - TABELA DE USUÁRIOS (MULTI-USUÁRIO COM NÍVEIS DE ACESSO)
-- PostgreSQL
-- =====================================================

-- 1. TABELA DE USUÁRIOS (ATENDENTES, COZINHEIROS, ADMINS)
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    
    -- Relacionamento com empresa
    empresa_id INTEGER NOT NULL,
    
    -- Dados pessoais
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    
    -- Autenticação
    senha_hash VARCHAR(255) NOT NULL,
    
    -- Nível de acesso
    role VARCHAR(20) NOT NULL DEFAULT 'atendente' 
        CHECK (role IN ('admin', 'atendente', 'cozinheiro')),
    
    -- Status
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usuarios_empresa ON usuarios(empresa_id);
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_role ON usuarios(role);
CREATE INDEX idx_usuarios_ativo ON usuarios(ativo);

-- 2. TRIGGER PARA ATUALIZAR updated_at
CREATE OR REPLACE FUNCTION update_usuarios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_usuarios_updated_at ON usuarios;

CREATE TRIGGER set_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION update_usuarios_updated_at();

-- =====================================================
-- APÓS EXECUTAR:
-- 1. Vá ao NocoDB e sincronize o banco
-- 2. A tabela 'usuarios' aparecerá automaticamente
-- 3. Pegue o novo ID da tabela no NocoDB
-- 4. Atualize em app/actions/users.ts -> USUARIOS_TABLE_ID
-- =====================================================
