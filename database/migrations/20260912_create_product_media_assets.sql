BEGIN;

CREATE TABLE IF NOT EXISTS product_media_assets (
  id BIGSERIAL PRIMARY KEY,
  empresa_id BIGINT NOT NULL,
  nome VARCHAR(120) NOT NULL,
  url TEXT NOT NULL,
  categoria VARCHAR(24) NOT NULL DEFAULT 'products'
    CHECK (categoria IN ('products', 'combos', 'drinks', 'other')),
  mime_type VARCHAR(100) NOT NULL,
  tamanho_bytes BIGINT NOT NULL DEFAULT 0 CHECK (tamanho_bytes >= 0),
  largura INTEGER,
  altura INTEGER,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, url)
);

CREATE INDEX IF NOT EXISTS product_media_assets_empresa_criado_idx
  ON product_media_assets (empresa_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS product_media_assets_empresa_categoria_idx
  ON product_media_assets (empresa_id, categoria);

COMMIT;
