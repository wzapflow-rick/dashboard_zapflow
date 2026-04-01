-- 1. LIMPEZA
DROP TABLE IF EXISTS grupo_itens_base CASCADE;
DROP TABLE IF EXISTS produto_grupos_slots CASCADE;
DROP TABLE IF EXISTS grupos_slots CASCADE;
DROP TABLE IF EXISTS item_base_insumo CASCADE;
DROP TABLE IF EXISTS itens_base CASCADE;

-- 2. CRIAÇÃO DAS TIPOS (se não existirem)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_grupo') THEN
        CREATE TYPE tipo_grupo AS ENUM ('fracionado', 'adicional');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'regra_preco') THEN
        CREATE TYPE regra_preco AS ENUM ('mais_caro', 'media', 'soma');
    END IF;
END $$;

-- 3. ITENS_BASE (Biblioteca de Sabores)
CREATE TABLE itens_base (
    id SERIAL PRIMARY KEY,
    empresa INTEGER NOT NULL,
    nome VARCHAR(255) NOT NULL,
    preco_sugerido DECIMAL(10,2) DEFAULT 0.00,
    preco_custo DECIMAL(10,2) DEFAULT 0.00
);

-- 4. ITEM_BASE_INSUMO (Ficha Técnica)
CREATE TABLE item_base_insumo (
    id SERIAL PRIMARY KEY,
    item INTEGER NOT NULL REFERENCES itens_base(id) ON DELETE CASCADE,
    insumo INTEGER NOT NULL,
    quantidade DECIMAL(10,3) NOT NULL
);

-- 5. GRUPOS_SLOTS (Grupos de Opcionais)
CREATE TABLE grupos_slots (
    id SERIAL PRIMARY KEY,
    empresa INTEGER NOT NULL,
    nome VARCHAR(255) NOT NULL,
    descricao VARCHAR(500),
    tipo tipo_grupo DEFAULT 'fracionado',
    qtd_slots INTEGER DEFAULT 1,
    regra_preco regra_preco DEFAULT 'mais_caro',
    min_slots INTEGER DEFAULT 0,
    max_slots INTEGER DEFAULT 1
);

-- 6. PRODUTO_GRUPOS_SLOTS (Vincula Produto ao Grupo)
CREATE TABLE produto_grupos_slots (
    id SERIAL PRIMARY KEY,
    prod_id INTEGER NOT NULL,
    grupo_id INTEGER NOT NULL REFERENCES grupos_slots(id) ON DELETE CASCADE,
    obrigatorio BOOLEAN DEFAULT FALSE,
    ordem INTEGER DEFAULT 0
);

-- 7. GRUPO_ITENS_BASE (Itens da Biblioteca no Grupo)
CREATE TABLE grupo_itens_base (
    id SERIAL PRIMARY KEY,
    grp_id INTEGER NOT NULL REFERENCES grupos_slots(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES itens_base(id) ON DELETE CASCADE,
    preco_override DECIMAL(10,2)
);