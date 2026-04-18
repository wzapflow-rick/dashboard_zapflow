-- =====================================================
-- ZAPFLOW - BANCO DE DADOS COMPLETO (NOCODB)
-- PostgreSQL - Criar todas as tabelas do zero
-- =====================================================

-- =====================================================
-- 1. TABELA DE EMPRESAS
-- =====================================================
CREATE TABLE IF NOT EXISTS empresas (
    id SERIAL PRIMARY KEY,
    nome_fantasia VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    chave_pix VARCHAR(255),
    nome_recebedor_pix VARCHAR(255),
    nome_admin VARCHAR(255),
    telefone_loja VARCHAR(20),
    cnpj VARCHAR(20),
    endereco TEXT,
    cidade VARCHAR(100),
    estado VARCHAR(2),
    instancia_evolution VARCHAR(255),
    nincho VARCHAR(100),
    raio_entrega_automatico BOOLEAN DEFAULT FALSE,
    valor_por_km NUMERIC(10,2) DEFAULT 0,
    taxa_entrega_fixa NUMERIC(10,2) DEFAULT 0,
    taxa_entrega_gratis NUMERIC(10,2) DEFAULT 0,
    raio_entrega_gratis NUMERIC(10,2) DEFAULT 0,
    auto_radius BOOLEAN DEFAULT FALSE,
    lat_loja NUMERIC(10,8),
    lng_loja NUMERIC(10,8),
    cobra_embalagem BOOLEAN DEFAULT FALSE,
    valor_embalagem NUMERIC(10,2) DEFAULT 0,
    controle_estoque BOOLEAN DEFAULT FALSE,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_empresas_nome ON empresas(nome_fantasia);

-- =====================================================
-- 2. TABELA DE USUÁRIOS
-- =====================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'atendente' CHECK (role IN ('admin', 'atendente', 'cozinheiro')),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usuarios_empresa ON usuarios(empresa_id);
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_role ON usuarios(role);

-- =====================================================
-- 3. TABELA DE CLIENTES
-- =====================================================
CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    endereco TEXT,
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    numero VARCHAR(20),
    complemento TEXT,
    referencia TEXT,
    cep VARCHAR(10),
    ponto_referencia TEXT,
    latitude NUMERIC(10,8),
    longitude NUMERIC(10,8),
    total_pedidos INTEGER DEFAULT 0,
    total_gasto NUMERIC(10,2) DEFAULT 0,
    primeiro_pedido TIMESTAMP,
    ultimo_pedido TIMESTAMP,
    ativo BOOLEAN DEFAULT TRUE,
    observacoes TEXT,
    tags TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clientes_empresa ON clientes(empresa_id);
CREATE INDEX idx_clientes_telefone ON clientes(telefone);

-- =====================================================
-- 4. TABELA DE CATEGORIAS
-- =====================================================
CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    nome VARCHAR(100) NOT NULL,
    ordem INTEGER DEFAULT 0,
    icone VARCHAR(50),
    cor VARCHAR(20),
    disponivel BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categorias_empresa ON categorias(empresa_id);

-- =====================================================
-- 5. TABELA DE PRODUTOS
-- =====================================================
CREATE TABLE IF NOT EXISTS produtos (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    nome VARCHAR(255) NOT NULL,
    preco NUMERIC(10,2) DEFAULT 0,
    preco_original NUMERIC(10,2),
    descricao TEXT,
    categoria_id INTEGER,
    categorias INTEGER,
    disponivel BOOLEAN DEFAULT TRUE,
    imagem_url TEXT,
    imagem TEXT,
    ordem INTEGER DEFAULT 0,
    destaque BOOLEAN DEFAULT FALSE,
    velocidade_preparo_minutos INTEGER,
    controla_estoque BOOLEAN DEFAULT FALSE,
    quantidade_estoque INTEGER DEFAULT 0,
    alerta_estoque_minimo INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_produtos_empresa ON produtos(empresa_id);
CREATE INDEX idx_produtos_categoria ON produtos(categoria_id);
CREATE INDEX idx_produtos_disponivel ON produtos(disponivel);

-- =====================================================
-- 6. TABELA DE PEDIDOS
-- =====================================================
CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    telefone_cliente VARCHAR(20),
    cliente_nome VARCHAR(255),
    itens JSONB,
    valor_total NUMERIC(10,2) DEFAULT 0,
    subtotal NUMERIC(10,2) DEFAULT 0,
    desconto NUMERIC(10,2) DEFAULT 0,
    taxa_entrega NUMERIC(10,2) DEFAULT 0,
    troco_necessario NUMERIC(10,2) DEFAULT 0,
    endereco_entrega TEXT,
    bairro_entrega VARCHAR(100),
    cidade_entrega VARCHAR(100),
    estado_entrega VARCHAR(2),
    numero_casa TEXT,
    complemento TEXT,
    referencia TEXT,
    latitude NUMERIC(10,8),
    longitude NUMERIC(10,8),
    tipo_entrega VARCHAR(20) DEFAULT 'delivery',
    tipo_pagamento TEXT,
    status VARCHAR(30) DEFAULT 'pendente',
    cupom_codigo TEXT,
    desconto_pontos NUMERIC(10,2) DEFAULT 0,
    pontos_usados INTEGER DEFAULT 0,
    pontos_ganhos INTEGER DEFAULT 0,
    observacoes TEXT,
    entregador_id INTEGER,
    payment_id TEXT,
    payment_link TEXT,
    status_pagamento TEXT DEFAULT 'pendente',
    data_agendamento TIMESTAMP,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pedidos_empresa ON pedidos(empresa_id);
CREATE INDEX idx_pedidos_status ON pedidos(status);
CREATE INDEX idx_pedidos_cliente ON pedidos(telefone_cliente);
CREATE INDEX idx_pedidos_data ON pedidos(created_at);
CREATE INDEX idx_pedidos_agendamento ON pedidos(data_agendamento);
CREATE INDEX idx_pedidos_entregador ON pedidos(entregador_id);

-- =====================================================
-- 7. TABELA DE ENTREGADORES
-- =====================================================
CREATE TABLE IF NOT EXISTS entregadores (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    nome VARCHAR(255) NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    senha_hash VARCHAR(255),
    veiculo VARCHAR(50) NOT NULL,
    placa VARCHAR(15),
    foto_url TEXT,
    status VARCHAR(20) DEFAULT 'offline',
    ativo BOOLEAN DEFAULT TRUE,
    comissao_por_entrega NUMERIC(10,2) DEFAULT 0,
    entregas_hoje INTEGER DEFAULT 0,
    entregas_total INTEGER DEFAULT 0,
    avaliacao NUMERIC(2,1) DEFAULT 5.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_entregadores_empresa ON entregadores(empresa_id);
CREATE INDEX idx_entregadores_status ON entregadores(status);

-- =====================================================
-- 8. TABELA DE ENDEREÇOS DOS CLIENTES
-- =====================================================
CREATE TABLE IF NOT EXISTS cliente_enderecos (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL,
    empresa_id INTEGER NOT NULL,
    nome TEXT,
    endereco TEXT NOT NULL,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    numero TEXT,
    complemento TEXT,
    referencia TEXT,
    cep TEXT,
    tipo TEXT DEFAULT 'delivery',
    ativo BOOLEAN DEFAULT TRUE,
    principal BOOLEAN DEFAULT FALSE,
    latitude NUMERIC(10,8),
    longitude NUMERIC(10,8),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cliente_enderecos_cliente ON cliente_enderecos(cliente_id);
CREATE INDEX idx_cliente_enderecos_empresa ON cliente_enderecos(empresa_id);

-- =====================================================
-- 9. TABELA DE CUPONS
-- =====================================================
CREATE TABLE IF NOT EXISTS cupons (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    codigo VARCHAR(20) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('percentual', 'valor_fixo')),
    valor NUMERIC(10,2) NOT NULL DEFAULT 0,
    valor_minimo_pedido NUMERIC(10,2) NOT NULL DEFAULT 0,
    limite_uso INTEGER,
    usos_atuais INTEGER NOT NULL DEFAULT 0,
    data_inicio DATE,
    data_fim DATE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(empresa_id, codigo)
);

CREATE INDEX idx_cupons_empresa ON cupons(empresa_id);
CREATE INDEX idx_cupons_codigo ON cupons(codigo);

-- =====================================================
-- 10. TABELA DE AVALIAÇÕES
-- =====================================================
CREATE TABLE IF NOT EXISTS avaliacoes (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL,
    empresa_id INTEGER NOT NULL,
    telefone_cliente VARCHAR(20),
    nota_comida INTEGER DEFAULT 0 CHECK (nota_comida BETWEEN 1 AND 5),
    nota_entrega INTEGER DEFAULT 0 CHECK (nota_entrega BETWEEN 1 AND 5),
    comentario TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_avaliacoes_empresa ON avaliacoes(empresa_id);
CREATE INDEX idx_avaliacoes_pedido ON avaliacoes(pedido_id);

-- =====================================================
-- 11. TABELA DE CONFIGURAÇÃO DE FIDELIDADE
-- =====================================================
CREATE TABLE IF NOT EXISTS loyalty_config (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL UNIQUE,
    pontos_por_real NUMERIC(10,2) NOT NULL DEFAULT 1,
    valor_ponto NUMERIC(10,2) NOT NULL DEFAULT 0.10,
    pontos_para_desconto INTEGER NOT NULL DEFAULT 100,
    desconto_tipo VARCHAR(20) NOT NULL DEFAULT 'valor_fixo',
    desconto_valor NUMERIC(10,2) NOT NULL DEFAULT 10,
    pontos_para_item_gratis INTEGER,
    ativo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 12. TABELA DE PONTOS DOS CLIENTES
-- =====================================================
CREATE TABLE IF NOT EXISTS loyalty_points (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    cliente_telefone VARCHAR(20) NOT NULL,
    cliente_nome VARCHAR(255),
    pontos_acumulados INTEGER NOT NULL DEFAULT 0,
    pontos_gastos INTEGER NOT NULL DEFAULT 0,
    total_gasto NUMERIC(10,2) NOT NULL DEFAULT 0,
    ultima_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(empresa_id, cliente_telefone)
);

CREATE INDEX idx_loyalty_points_empresa ON loyalty_points(empresa_id);
CREATE INDEX idx_loyalty_points_telefone ON loyalty_points(cliente_telefone);

-- =====================================================
-- 13. TABELA DE HISTÓRICO DE PONTOS
-- =====================================================
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
CREATE INDEX idx_loyalty_history_data ON loyalty_history(data);

-- =====================================================
-- 14. TABELA DE INSUMOS
-- =====================================================
CREATE TABLE IF NOT EXISTS insumos (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    nome VARCHAR(255) NOT NULL,
    quantidade_atual NUMERIC(10,2) DEFAULT 0,
    unidade_medida VARCHAR(20) NOT NULL,
    estoque_minimo NUMERIC(10,2) DEFAULT 0,
    custo_por_unidade NUMERIC(10,2) DEFAULT 0,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_insumos_empresa ON insumos(empresa_id);

-- =====================================================
-- 15. TABELA DE RELAÇÃO PRODUTO-INSUMO
-- =====================================================
CREATE TABLE IF NOT EXISTS produto_insumos (
    id SERIAL PRIMARY KEY,
    produto_id INTEGER NOT NULL,
    insumo_id INTEGER NOT NULL,
    quantidade_usada NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_produto_insumos_produto ON produto_insumos(produto_id);
CREATE INDEX idx_produto_insumos_insumo ON produto_insumos(insumo_id);

-- =====================================================
-- 16. TABELA DE GRUPOS DE COMPLEMENTOS
-- =====================================================
CREATE TABLE IF NOT EXISTS grupos_complementos (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    tipo VARCHAR(20) DEFAULT 'multipla' CHECK (tipo IN ('unico', 'multipla')),
    max_opcoes INTEGER DEFAULT 1,
    preco NUMERIC(10,2) DEFAULT 0,
    produto_composto BOOLEAN DEFAULT FALSE,
    obrigatorio BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_grupos_complementos_empresa ON grupos_complementos(empresa_id);

-- =====================================================
-- 17. TABELA DE COMPLEMENTOS
-- =====================================================
CREATE TABLE IF NOT EXISTS complementos (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    nome VARCHAR(100) NOT NULL,
    grupo_id INTEGER NOT NULL,
    preco NUMERIC(10,2) DEFAULT 0,
    disponivel BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_complementos_grupo ON complementos(grupo_id);
CREATE INDEX idx_complementos_empresa ON complementos(empresa_id);

-- =====================================================
-- 18. TABELA DE GRUPOS DE SLOTS
-- =====================================================
CREATE TABLE IF NOT EXISTS grupos_slots (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    tipo VARCHAR(20) DEFAULT 'fracionado' CHECK (tipo IN ('fracionado', 'adicional')),
    qtd_slots INTEGER DEFAULT 1,
    regra_preco VARCHAR(20) DEFAULT 'mais_caro' CHECK (regra_preco IN ('mais_caro', 'media', 'soma')),
    min_slots INTEGER DEFAULT 0,
    max_slots INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_grupos_slots_empresa ON grupos_slots(empresa_id);

-- =====================================================
-- 19. TABELA DE ITENS BASE (para slots)
-- =====================================================
CREATE TABLE IF NOT EXISTS itens_base (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    nome VARCHAR(100) NOT NULL,
    preco_sugerido NUMERIC(10,2) DEFAULT 0,
    preco_custo NUMERIC(10,2) DEFAULT 0,
    disponivel BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_itens_base_empresa ON itens_base(empresa_id);

-- =====================================================
-- 20. TABELA DE HORÁRIOS DE FUNCIONAMENTO
-- =====================================================
CREATE TABLE IF NOT EXISTS horarios (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    hora_abertura VARCHAR(5) DEFAULT '00:00',
    hora_fechamento VARCHAR(5) DEFAULT '23:59',
    fechado_o_dia_todo BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_horarios_empresa ON horarios(empresa_id);
CREATE INDEX idx_horarios_dia ON horarios(dia_semana);

-- =====================================================
-- 21. TABELA DE HISTÓRICO DE ENTREGAS
-- =====================================================
CREATE TABLE IF NOT EXISTS historico_entregas (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL,
    entregador_id INTEGER NOT NULL,
    empresa_id INTEGER NOT NULL,
    endereco TEXT,
    bairro VARCHAR(255),
    distancia_km NUMERIC(10,2),
    tempo_estimado_min INTEGER,
    tempo_real_min INTEGER,
    valor_pedido NUMERIC(10,2),
    taxa_entrega NUMERIC(10,2),
    comissao NUMERIC(10,2),
    status VARCHAR(20) DEFAULT 'atribuida',
    avaliacao_cliente INTEGER,
    feedback_cliente TEXT,
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
-- 22. TABELA DE COMISSÕES DOS ENTREGADORES
-- =====================================================
CREATE TABLE IF NOT EXISTS comissoes_entregadores (
    id SERIAL PRIMARY KEY,
    entregador_id INTEGER NOT NULL,
    empresa_id INTEGER NOT NULL,
    data DATE NOT NULL,
    semana INTEGER,
    mes INTEGER,
    ano INTEGER,
    total_entregas INTEGER DEFAULT 0,
    valor_total_pedidos NUMERIC(10,2) DEFAULT 0,
    taxa_entrega_total NUMERIC(10,2) DEFAULT 0,
    comissao_total NUMERIC(10,2) DEFAULT 0,
    comissao_paga BOOLEAN DEFAULT FALSE,
    data_pagamento DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_entregador_data UNIQUE (entregador_id, data)
);

CREATE INDEX idx_comissoes_entregador ON comissoes_entregadores(entregador_id);
CREATE INDEX idx_comissoes_empresa ON comissoes_entregadores(empresa_id);
CREATE INDEX idx_comissoes_data ON comissoes_entregadores(data);
CREATE INDEX idx_comissoes_periodo ON comissoes_entregadores(ano, mes);

-- =====================================================
-- 23. TABELA DE CONFIGURAÇÕES DE ENTREGA
-- =====================================================
CREATE TABLE IF NOT EXISTS configuracoes_entrega (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL UNIQUE,
    entrega_ativa BOOLEAN DEFAULT TRUE,
    taxa_fixa NUMERIC(10,2) DEFAULT 0,
    raio_maximo_km NUMERIC(10,2) DEFAULT 0,
    max_entregadores_simultaneos INTEGER DEFAULT 5,
    tempo_limite_coleta_min INTEGER DEFAULT 15,
    tempo_limite_entrega_min INTEGER DEFAULT 45,
    comissao_padrao NUMERIC(10,2) DEFAULT 5.00,
    comissao_bonus_km NUMERIC(10,2) DEFAULT 1.00,
    comissao_bonus_noite NUMERIC(10,2) DEFAULT 2.00,
    notificar_whatsapp BOOLEAN DEFAULT TRUE,
    template_mensagem TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 24. TABELA DE ACERTOS DOS ENTREGADORES
-- =====================================================
CREATE TABLE IF NOT EXISTS acertos_entregadores (
    id SERIAL PRIMARY KEY,
    entregador_id INTEGER NOT NULL,
    empresa_id INTEGER NOT NULL,
    data_acerto DATE DEFAULT CURRENT_DATE,
    valor_taxas NUMERIC(10,2) DEFAULT 0,
    valor_recebido NUMERIC(10,2) DEFAULT 0,
    valor_liquido NUMERIC(10,2) DEFAULT 0,
    quantidade_entregas INTEGER DEFAULT 0,
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_acertos_entregador ON acertos_entregadores(entregador_id);
CREATE INDEX idx_acertos_empresa ON acertos_entregadores(empresa_id);
CREATE INDEX idx_acertos_data ON acertos_entregadores(data_acerto);

-- =====================================================
-- 25. TABELA DE CAMPANHAS (CONFIGURAÇÃO)
-- =====================================================
CREATE TABLE IF NOT EXISTS campanhas_config (
    id BIGSERIAL PRIMARY KEY,
    empresa_id TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'reengajamento',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
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

CREATE INDEX idx_campanhas_config_empresa ON campanhas_config(empresa_id);

-- =====================================================
-- 26. TABELA DE CAMPANHAS (DISPAROS)
-- =====================================================
CREATE TABLE IF NOT EXISTS campanhas_disparos (
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

CREATE INDEX idx_campanhas_disparos_empresa ON campanhas_disparos(empresa_id, enviado_em DESC);
CREATE INDEX idx_campanhas_disparos_campanha ON campanhas_disparos(campanha_id);

-- =====================================================
-- TRIGGER PARA ATUALIZAR updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Criar triggers para todas as tabelas
DROP TRIGGER IF EXISTS set_empresas_updated_at ON empresas;
CREATE TRIGGER set_empresas_updated_at BEFORE UPDATE ON empresas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_usuarios_updated_at ON usuarios;
CREATE TRIGGER set_usuarios_updated_at BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_clientes_updated_at ON clientes;
CREATE TRIGGER set_clientes_updated_at BEFORE UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_categorias_updated_at ON categorias;
CREATE TRIGGER set_categorias_updated_at BEFORE UPDATE ON categorias FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_produtos_updated_at ON produtos;
CREATE TRIGGER set_produtos_updated_at BEFORE UPDATE ON produtos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_pedidos_updated_at ON pedidos;
CREATE TRIGGER set_pedidos_updated_at BEFORE UPDATE ON pedidos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_entregadores_updated_at ON entregadores;
CREATE TRIGGER set_entregadores_updated_at BEFORE UPDATE ON entregadores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_cupons_updated_at ON cupons;
CREATE TRIGGER set_cupons_updated_at BEFORE UPDATE ON cupons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_avaliacoes_updated_at ON avaliacoes;
CREATE TRIGGER set_avaliacoes_updated_at BEFORE UPDATE ON avaliacoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_loyalty_config_updated_at ON loyalty_config;
CREATE TRIGGER set_loyalty_config_updated_at BEFORE UPDATE ON loyalty_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_loyalty_points_updated_at ON loyalty_points;
CREATE TRIGGER set_loyalty_points_updated_at BEFORE UPDATE ON loyalty_points FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_insumos_updated_at ON insumos;
CREATE TRIGGER set_insumos_updated_at BEFORE UPDATE ON insumos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_grupos_complementos_updated_at ON grupos_complementos;
CREATE TRIGGER set_grupos_complementos_updated_at BEFORE UPDATE ON grupos_complementos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_complementos_updated_at ON complementos;
CREATE TRIGGER set_complementos_updated_at BEFORE UPDATE ON complementos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_grupos_slots_updated_at ON grupos_slots;
CREATE TRIGGER set_grupos_slots_updated_at BEFORE UPDATE ON grupos_slots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_itens_base_updated_at ON itens_base;
CREATE TRIGGER set_itens_base_updated_at BEFORE UPDATE ON itens_base FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_horarios_updated_at ON horarios;
CREATE TRIGGER set_horarios_updated_at BEFORE UPDATE ON horarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_campanhas_config_updated_at ON campanhas_config;
CREATE TRIGGER set_campanhas_config_updated_at BEFORE UPDATE ON campanhas_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================