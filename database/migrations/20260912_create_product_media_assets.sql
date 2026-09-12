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

-- Replica as permissoes CRUD dos papeis que ja operam a tabela de produtos.
-- Execute esta migracao com o proprietario do banco/tabela, nao com a conta
-- limitada usada pela aplicacao em producao.
DO $$
DECLARE
  application_role name;
BEGIN
  FOR application_role IN
    SELECT grantee::name
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'produtos'
      AND grantee <> 'PUBLIC'
      AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    GROUP BY grantee
    HAVING COUNT(DISTINCT privilege_type) = 4
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE product_media_assets TO %I',
      application_role
    );
    EXECUTE format(
      'GRANT USAGE, SELECT ON SEQUENCE product_media_assets_id_seq TO %I',
      application_role
    );
  END LOOP;
END;
$$;

COMMIT;
