-- Adiciona valor automático para a coluna "id" em todas as tabelas do schema public
-- que ainda não têm (ex.: campanhas, comissoes, configuracoes_loja, disparos).
-- Inteiros ganham uma sequence; UUID ganha gen_random_uuid().

DO $$
DECLARE
  r RECORD;
  seq_name TEXT;
BEGIN
  FOR r IN
    SELECT c.table_name, c.data_type
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'id'
      AND c.column_default IS NULL
      AND c.is_identity = 'NO'
      AND t.table_type = 'BASE TABLE'
  LOOP
    IF r.data_type IN ('integer', 'bigint', 'smallint') THEN
      seq_name := r.table_name || '_id_seq';
      EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I OWNED BY %I.id', seq_name, r.table_name);
      EXECUTE format(
        'SELECT setval(%L, COALESCE((SELECT MAX(id) FROM %I), 0) + 1, false)',
        seq_name, r.table_name
      );
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN id SET DEFAULT nextval(%L)',
        r.table_name, seq_name
      );
      RAISE NOTICE 'Sequence aplicada em %', r.table_name;
    ELSIF r.data_type = 'uuid' THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN id SET DEFAULT gen_random_uuid()', r.table_name);
      RAISE NOTICE 'gen_random_uuid() aplicado em %', r.table_name;
    ELSE
      RAISE NOTICE 'Tipo % não tratado em %, ajuste manualmente', r.data_type, r.table_name;
    END IF;
  END LOOP;
END $$;

-- Conferência: deve voltar vazio
SELECT table_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'id'
  AND column_default IS NULL
  AND is_identity = 'NO'
ORDER BY table_name;
