-- =====================================================
-- SCRIPTS PARA INTEGRACAO MERCADO PAGO - ZAPFLOW
-- Execute estes comandos no seu banco de dados PostgreSQL
-- =====================================================

-- 1. Adicionar campos na tabela de pedidos
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS payment_id text;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS payment_link text;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS status_pagamento text DEFAULT 'pendente';

-- 2. Criar indice para buscar por payment_id
CREATE INDEX IF NOT EXISTS idx_pedidos_payment_id ON pedidos(payment_id);

-- =====================================================
-- VERIFICACAO: Execute para confirmar que os campos foram criados
-- =====================================================
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'pedidos' 
AND column_name IN ('payment_id', 'payment_link', 'status_pagamento');
