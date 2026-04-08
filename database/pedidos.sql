-- Adicionar campos faltantes na tabela de pedidos (execute no NocoDB)

-- Taxa de entrega
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS taxa_entrega numeric DEFAULT 0;

-- Troco necessário
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS troco_necessario numeric DEFAULT 0;

-- Número da casa / complemento
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS numero_casa text;

-- Referência do local (para delivery)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS referencia text;

-- Tempo estimado de entrega (em minutos)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS tempo_estimado integer;

-- Tipo de pagamento detalhado
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS tipo_pagamento text;

-- Campos de fidelidade
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pontos_usados integer DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pontos_ganhos integer DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS desconto_pontos numeric DEFAULT 0;

-- Campos de configuração do estabelecimento
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS taxa_entrega_fixa numeric DEFAULT 0;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS taxa_entrega_gratis numeric DEFAULT 0;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS raio_entrega_gratis numeric DEFAULT 0;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS auto_radius boolean DEFAULT false;

-- Campos para integração Mercado Pago
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS payment_id text;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS payment_link text;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS status_pagamento text DEFAULT 'pendente';

-- Index para performance
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_empresa ON pedidos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_data_agendamento ON pedidos(data_agendamento);
CREATE INDEX IF NOT EXISTS idx_pedidos_criado ON pedidos(criado_em);
CREATE INDEX IF NOT EXISTS idx_pedidos_payment ON pedidos(payment_id);
