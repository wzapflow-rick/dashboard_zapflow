ALTER TABLE grupos_slots ADD COLUMN IF NOT EXISTS modo_preco VARCHAR(20) DEFAULT 'por_item';
ALTER TABLE grupos_slots ADD COLUMN IF NOT EXISTS preco_fixo NUMERIC(10,2) DEFAULT 0;
ALTER TABLE grupos_slots ADD COLUMN IF NOT EXISTS completamentos_ids JSONB DEFAULT '[]'::jsonb;