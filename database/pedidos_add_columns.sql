-- Adicionar campos faltantes na tabela de pedidos do NocoDB
-- Execute via interface NocoDB ou API

-- Taxa de entrega
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS taxa_entrega numeric(10,2) DEFAULT 0;

-- Troco necessário
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS troco_necessario numeric(10,2) DEFAULT 0;

-- Tipo de entrega (delivery/retirada)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS tipo_entrega text DEFAULT 'delivery';

-- Nome do cliente
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_nome text;

-- Subtotal (sem desconto)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS subtotal numeric(10,2) DEFAULT 0;

-- Desconto total
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS desconto numeric(10,2) DEFAULT 0;

-- Código do cupom usado
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cupom_codigo text;

-- Pontos ganhos
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pontos_ganhos integer DEFAULT 0;

-- Observações do pedido
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS observacoes text;

-- Número da casa / complemento
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS numero_casa text;

-- Referência do local (para delivery)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS referencia text;

-- Número da casa
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS numero text;

-- Complemento
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS complemento text;
