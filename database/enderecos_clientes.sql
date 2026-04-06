-- Tabela de endereços dos clientes
CREATE TABLE IF NOT EXISTS cliente_enderecos (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL,
    nome TEXT, -- ex: "Casa", "Trabalho", "Outro"
    endereco TEXT NOT NULL,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    numero TEXT,
    complemento TEXT,
    referencia TEXT,
    cep TEXT,
    tipo TEXT DEFAULT 'delivery', -- delivery ou retirada
    ativo BOOLEAN DEFAULT true,
    principal BOOLEAN DEFAULT false,
    empresa_id INTEGER NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para buscar endereços por cliente
CREATE INDEX idx_cliente_enderecos_cliente ON cliente_enderecos(cliente_id);
CREATE INDEX idx_cliente_enderecos_empresa ON cliente_enderecos(empresa_id);
