-- Corrige o INSERT em pagamentos_config (Mercado Pago OAuth):
-- a coluna id nao tinha valor automatico e o INSERT gravava NULL.
BEGIN;

CREATE SEQUENCE IF NOT EXISTS pagamentos_config_id_seq OWNED BY pagamentos_config.id;

SELECT setval(
  'pagamentos_config_id_seq',
  COALESCE((SELECT MAX(id) FROM pagamentos_config), 0) + 1,
  false
);

ALTER TABLE pagamentos_config
  ALTER COLUMN id SET DEFAULT nextval('pagamentos_config_id_seq');

COMMIT;

-- Conferencia: outras tabelas com coluna id sem valor automatico
SELECT table_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'id'
  AND column_default IS NULL
  AND is_identity = 'NO'
ORDER BY table_name;
