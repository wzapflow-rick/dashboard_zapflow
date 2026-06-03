-- =====================================================================
-- FUNIL DE FOLLOW-UP (CRM ZapFlow) - ETAPA 2: FKs + INDICES + COMMENTS
-- Rodar DEPOIS da Etapa 1 (quando as tabelas ja existem).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 2.1 Foreign Keys (DO $$ para serem idempotentes)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cadencias_mensagem') THEN
    ALTER TABLE remarketing_cadencias
      ADD CONSTRAINT fk_cadencias_mensagem
      FOREIGN KEY (mensagem_id) REFERENCES remarketing_mensagens(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cad_envios_contato') THEN
    ALTER TABLE remarketing_cadencia_envios
      ADD CONSTRAINT fk_cad_envios_contato
      FOREIGN KEY (contato_id) REFERENCES remarketing_contatos(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cad_envios_cadencia') THEN
    ALTER TABLE remarketing_cadencia_envios
      ADD CONSTRAINT fk_cad_envios_cadencia
      FOREIGN KEY (cadencia_id) REFERENCES remarketing_cadencias(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cad_envios_fila') THEN
    ALTER TABLE remarketing_cadencia_envios
      ADD CONSTRAINT fk_cad_envios_fila
      FOREIGN KEY (fila_id) REFERENCES remarketing_fila(id) ON DELETE SET NULL;
  END IF;
END$$;

-- ---------------------------------------------------------------------
-- 2.2 Indices
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_contatos_estagio        ON remarketing_contatos(estagio);
CREATE INDEX IF NOT EXISTS idx_contatos_empresa        ON remarketing_contatos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cadencias_estagio        ON remarketing_cadencias(estagio, passo_ordem);
CREATE INDEX IF NOT EXISTS idx_cad_envios_contato       ON remarketing_cadencia_envios(contato_id);
CREATE INDEX IF NOT EXISTS idx_cad_envios_cadencia      ON remarketing_cadencia_envios(cadencia_id);

-- Anti-duplicidade: cada passo de uma cadencia so pode existir 1x por contato
CREATE UNIQUE INDEX IF NOT EXISTS uniq_cad_envios_passo
  ON remarketing_cadencia_envios(contato_id, cadencia_id, passo_ordem);

-- ---------------------------------------------------------------------
-- 2.3 Comments (documentacao)
-- ---------------------------------------------------------------------
COMMENT ON COLUMN remarketing_contatos.estagio       IS 'lead_quente | lead_morno | lead_frio | trial | cliente | perdido';
COMMENT ON COLUMN remarketing_contatos.estagio_desde IS 'Reinicia ao mover no Kanban; base de calculo das cadencias de lead';
COMMENT ON COLUMN remarketing_contatos.empresa_id    IS 'Vincula contato a empresa/assinatura (trial/cliente)';
COMMENT ON COLUMN remarketing_contatos.kanban_ordem  IS 'Ordem do card dentro da coluna do Kanban';

COMMENT ON TABLE  remarketing_cadencias            IS 'Passos de follow-up por estagio do funil (substitui categorias/combinacoes)';
COMMENT ON COLUMN remarketing_cadencias.offset_horas    IS 'Horas relativas ao marco do estagio para disparar o passo';
COMMENT ON COLUMN remarketing_cadencias.recorrente      IS 'Se true, repete a cada intervalo_horas (lead frio)';
COMMENT ON COLUMN remarketing_cadencias.modo            IS 'auto = envia sozinho | aprovacao = entra na caixa de aprovacao';

COMMENT ON TABLE  remarketing_cadencia_envios      IS 'Controle anti-duplicidade dos envios de cadencia por contato';
COMMENT ON COLUMN remarketing_cadencia_envios.status IS 'agendado | enviado | pulado | cancelado';
