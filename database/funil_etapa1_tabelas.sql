-- =====================================================================
-- FUNIL DE FOLLOW-UP (CRM ZapFlow) - ETAPA 1: COLUNAS + TABELAS
-- Rodar PRIMEIRO no pgAdmin. Apenas ALTER/CREATE TABLE.
-- (Sem CREATE INDEX / COMMENT / FK de tabela nova - isso vai na Etapa 2)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1.1 Colunas novas em remarketing_contatos
-- ---------------------------------------------------------------------
ALTER TABLE remarketing_contatos
  ADD COLUMN IF NOT EXISTS estagio       text        DEFAULT 'lead_morno',
  ADD COLUMN IF NOT EXISTS estagio_desde timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS empresa_id    integer     NULL,
  ADD COLUMN IF NOT EXISTS kanban_ordem  integer     DEFAULT 0;

-- ---------------------------------------------------------------------
-- 1.2 Tabela de cadencias (passos de cada estagio do funil)
--     Substitui categorias / tipos_dor / combinacoes.
--     FK para remarketing_mensagens sera adicionada na Etapa 2.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS remarketing_cadencias (
  id              SERIAL PRIMARY KEY,
  estagio         text        NOT NULL,            -- lead_quente | lead_morno | lead_frio | trial | cliente
  passo_ordem     integer     NOT NULL DEFAULT 1,  -- ordem do passo dentro do estagio
  rotulo          text        NULL,                -- nome amigavel do passo
  offset_horas    integer     NOT NULL DEFAULT 0,  -- quando disparar relativo ao marco do estagio
  recorrente      boolean     NOT NULL DEFAULT false,
  intervalo_horas integer     NULL,                -- usado quando recorrente = true (lead frio)
  mensagem_id     integer     NULL,                -- FK -> remarketing_mensagens (adicionada na Etapa 2)
  modo            text        NOT NULL DEFAULT 'aprovacao', -- auto | aprovacao
  ativo           boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 1.3 Tabela de controle anti-duplicidade de envios das cadencias
--     FKs serao adicionadas na Etapa 2.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS remarketing_cadencia_envios (
  id          SERIAL PRIMARY KEY,
  contato_id  integer     NOT NULL,                -- FK -> remarketing_contatos
  cadencia_id integer     NOT NULL,                -- FK -> remarketing_cadencias
  passo_ordem integer     NOT NULL DEFAULT 1,
  status      text        NOT NULL DEFAULT 'agendado', -- agendado | enviado | pulado | cancelado
  fila_id     integer     NULL,                    -- FK -> remarketing_fila
  enviado_em  timestamptz NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
