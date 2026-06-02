-- =====================================================================
-- FUNIL DE FOLLOW-UP (CRM ZapFlow) - ETAPA 3: SEEDS (mensagens + cadencias)
-- Rodar DEPOIS das Etapas 1 e 2. Idempotente (nao duplica se rodar 2x).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 3.1 Mensagens padrao do funil (so insere se ainda nao existir pelo nome)
-- ---------------------------------------------------------------------
INSERT INTO remarketing_mensagens (nome, conteudo, tipo_midia, variaveis_disponiveis, ativo, ordem, created_at)
SELECT v.nome, v.conteudo, 'texto', '["nome","telefone"]'::json, true, v.ordem, now()
FROM (VALUES
  ('Funil - Trial 48h',     'Opa, {{nome}}, tudo bem? Como tem se saido com o app? Posso tirar alguma duvida?', 1),
  ('Funil - Trial dia 4',   'Oi {{nome}}! Quero te mostrar um recurso que costuma encantar quem usa o ZapFlow. Posso te mandar um exemplo rapido?', 2),
  ('Funil - Trial dia 6',   '{{nome}}, seu teste do ZapFlow acaba amanha! Pra nao perder seus dados, deixei uma oferta especial de R$ 29,90 no primeiro mes. Quer que eu te mande o link?', 3),
  ('Funil - Cliente 15d',   'Oi {{nome}}! Como esta se saindo o ZapFlow ai? Esta tranquilo de usar no dia a dia?', 4),
  ('Funil - Cliente 25d',   '{{nome}}, passando pra fazer um check-in antes da renovacao. Ta tudo certo? Qualquer ajuste eu te ajudo por aqui.', 5),
  ('Funil - Lead Quente 2h','Oi {{nome}}! Vi seu interesse no ZapFlow. Posso te explicar rapidinho como funciona e tirar suas duvidas?', 6),
  ('Funil - Lead Morno 24h','Oi {{nome}}, tudo bem? Ainda da tempo de organizar seu delivery com o ZapFlow. Quer que eu te mande uma demonstracao?', 7),
  ('Funil - Lead Frio',     'Oi {{nome}}! Faz um tempo que a gente nao se fala. O ZapFlow evoluiu bastante - quer dar uma olhada no que mudou?', 8)
) AS v(nome, conteudo, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM remarketing_mensagens m WHERE m.nome = v.nome
);

-- ---------------------------------------------------------------------
-- 3.2 Cadencias padrao (so insere se ainda nao existir aquele estagio+passo)
--     mensagem_id resolvido via subquery pelo nome da mensagem acima.
-- ---------------------------------------------------------------------

-- TRIAL (auto) - marco = data_inicio da assinatura
INSERT INTO remarketing_cadencias (estagio, passo_ordem, rotulo, offset_horas, recorrente, intervalo_horas, mensagem_id, modo, ativo, created_at)
SELECT v.estagio, v.passo_ordem, v.rotulo, v.offset_horas, false, NULL,
       (SELECT id FROM remarketing_mensagens WHERE nome = v.msg LIMIT 1),
       'auto', true, now()
FROM (VALUES
  ('trial', 1, 'Trial 48h - como tem se saido', 48,  'Funil - Trial 48h'),
  ('trial', 2, 'Trial dia 4 - recurso que encanta', 96, 'Funil - Trial dia 4'),
  ('trial', 3, 'Trial dia 6 - trial acaba amanha + oferta', 144, 'Funil - Trial dia 6')
) AS v(estagio, passo_ordem, rotulo, offset_horas, msg)
WHERE NOT EXISTS (
  SELECT 1 FROM remarketing_cadencias c WHERE c.estagio = v.estagio AND c.passo_ordem = v.passo_ordem
);

-- CLIENTE (auto) - marco = data_inicio da assinatura
INSERT INTO remarketing_cadencias (estagio, passo_ordem, rotulo, offset_horas, recorrente, intervalo_horas, mensagem_id, modo, ativo, created_at)
SELECT v.estagio, v.passo_ordem, v.rotulo, v.offset_horas, false, NULL,
       (SELECT id FROM remarketing_mensagens WHERE nome = v.msg LIMIT 1),
       'auto', true, now()
FROM (VALUES
  ('cliente', 1, 'Cliente 15d - como esta se saindo', 360, 'Funil - Cliente 15d'),
  ('cliente', 2, 'Cliente 25d - check-in pre-cobranca', 600, 'Funil - Cliente 25d')
) AS v(estagio, passo_ordem, rotulo, offset_horas, msg)
WHERE NOT EXISTS (
  SELECT 1 FROM remarketing_cadencias c WHERE c.estagio = v.estagio AND c.passo_ordem = v.passo_ordem
);

-- LEAD QUENTE (aprovacao) - marco = estagio_desde
INSERT INTO remarketing_cadencias (estagio, passo_ordem, rotulo, offset_horas, recorrente, intervalo_horas, mensagem_id, modo, ativo, created_at)
SELECT 'lead_quente', 1, 'Lead Quente - 2h', 2, false, NULL,
       (SELECT id FROM remarketing_mensagens WHERE nome = 'Funil - Lead Quente 2h' LIMIT 1),
       'aprovacao', true, now()
WHERE NOT EXISTS (
  SELECT 1 FROM remarketing_cadencias c WHERE c.estagio = 'lead_quente' AND c.passo_ordem = 1
);

-- LEAD MORNO (aprovacao) - marco = estagio_desde
INSERT INTO remarketing_cadencias (estagio, passo_ordem, rotulo, offset_horas, recorrente, intervalo_horas, mensagem_id, modo, ativo, created_at)
SELECT 'lead_morno', 1, 'Lead Morno - 24h', 24, false, NULL,
       (SELECT id FROM remarketing_mensagens WHERE nome = 'Funil - Lead Morno 24h' LIMIT 1),
       'aprovacao', true, now()
WHERE NOT EXISTS (
  SELECT 1 FROM remarketing_cadencias c WHERE c.estagio = 'lead_morno' AND c.passo_ordem = 1
);

-- LEAD FRIO (aprovacao) - passos com intervalo crescente: 48h, 120h, 240h, 480h
INSERT INTO remarketing_cadencias (estagio, passo_ordem, rotulo, offset_horas, recorrente, intervalo_horas, mensagem_id, modo, ativo, created_at)
SELECT v.estagio, v.passo_ordem, v.rotulo, v.offset_horas, false, NULL,
       (SELECT id FROM remarketing_mensagens WHERE nome = 'Funil - Lead Frio' LIMIT 1),
       'aprovacao', true, now()
FROM (VALUES
  ('lead_frio', 1, 'Lead Frio - 48h',  48),
  ('lead_frio', 2, 'Lead Frio - 120h', 120),
  ('lead_frio', 3, 'Lead Frio - 240h', 240),
  ('lead_frio', 4, 'Lead Frio - 480h', 480)
) AS v(estagio, passo_ordem, rotulo, offset_horas)
WHERE NOT EXISTS (
  SELECT 1 FROM remarketing_cadencias c WHERE c.estagio = v.estagio AND c.passo_ordem = v.passo_ordem
);
