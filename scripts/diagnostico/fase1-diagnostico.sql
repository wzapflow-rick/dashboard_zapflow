-- ============================================================
-- ZAPFLASH — DIAGNOSTICO DA FASE 1 (SOMENTE LEITURA)
-- Rodar na VPS:  psql "$DATABASE_URL" -f scripts/diagnostico/fase1-diagnostico.sql > diag.txt
-- Nenhum comando abaixo altera dados. A transacao e READ ONLY.
-- ============================================================
BEGIN TRANSACTION READ ONLY;

\echo '== 1. SCHEMA REAL DAS TABELAS ENVOLVIDAS'
SELECT table_name, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name IN ('empresas','assinaturas','pending_signups','remarketing_contatos',
                      'remarketing_cadencias','remarketing_cadencia_envios','remarketing_fila',
                      'remarketing_historico','remarketing_config','cron_logs','rate_limit_attempts')
 ORDER BY table_name, ordinal_position;

\echo '== 2. MIGRACAO 001_funil_cadencias APLICADA?'
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='remarketing_contatos' AND column_name='estagio')      AS contatos_estagio,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='remarketing_contatos' AND column_name='estagio_desde') AS contatos_estagio_desde,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='remarketing_contatos' AND column_name='kanban_ordem')  AS contatos_kanban_ordem,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='remarketing_contatos' AND column_name='empresa_id')    AS contatos_empresa_id,
  to_regclass('public.remarketing_cadencias')       IS NOT NULL AS tabela_cadencias,
  to_regclass('public.remarketing_cadencia_envios') IS NOT NULL AS tabela_cadencia_envios,
  to_regclass('public.cron_logs')                   IS NOT NULL AS tabela_cron_logs;

SELECT indexname, tablename FROM pg_indexes
 WHERE indexname IN ('idx_remarketing_contatos_estagio','idx_remarketing_contatos_empresa',
                     'idx_cadencias_estagio_ativo','idx_cadencia_envios_contato');

\echo '== 3. CANDIDATAS A DEMO (empresas) — revisar manualmente'
SELECT e.id, e.nome_fantasia, e.email, e.created_at
  FROM empresas e
 WHERE e.nome_fantasia ILIKE '%demo%' OR e.email ILIKE '%demo%'
    OR e.email ILIKE '%teste%' OR e.email ILIKE '%example%'
 ORDER BY e.id;

\echo '== 3b. ASSINATURAS DESSAS EMPRESAS'
SELECT a.id, a.empresa_id, a.plano, a.status, a.valor, a.cartao_bandeira, a.data_inicio
  FROM assinaturas a
  JOIN empresas e ON e.id = a.empresa_id
 WHERE e.nome_fantasia ILIKE '%demo%' OR e.email ILIKE '%demo%'
    OR e.email ILIKE '%teste%' OR e.email ILIKE '%example%'
 ORDER BY a.empresa_id;

\echo '== 3c. DISTRIBUICAO DE cartao_bandeira (TRIA/Trial/PIX/...)'
SELECT cartao_bandeira, status, COUNT(*) FROM assinaturas GROUP BY 1,2 ORDER BY 3 DESC;

\echo '== 4. DUPLICIDADES ENTRE pending_signups, remarketing_contatos e empresas'
-- Telefones normalizados (apenas digitos, ultimos 11)
WITH ps AS (SELECT DISTINCT right(regexp_replace(telefone,'\D','','g'),11) tel FROM pending_signups WHERE telefone IS NOT NULL),
     rc AS (SELECT DISTINCT right(regexp_replace(telefone,'\D','','g'),11) tel FROM remarketing_contatos WHERE telefone IS NOT NULL)
SELECT
  (SELECT COUNT(*) FROM ps)                                   AS pending_total,
  (SELECT COUNT(*) FROM rc)                                   AS contatos_total,
  (SELECT COUNT(*) FROM ps JOIN rc USING (tel))               AS pending_em_contatos;

SELECT COUNT(*) AS pending_com_email_em_empresas
  FROM pending_signups p JOIN empresas e ON lower(e.email) = lower(p.email);

SELECT right(regexp_replace(telefone,'\D','','g'),11) tel, COUNT(*) qtd
  FROM remarketing_contatos WHERE telefone IS NOT NULL
 GROUP BY 1 HAVING COUNT(*) > 1 ORDER BY 2 DESC LIMIT 50;

SELECT status, COUNT(*) FROM pending_signups GROUP BY 1;

\echo '== 5. CRONS: ULTIMAS EXECUCOES REGISTRADAS'
SELECT job_name, MAX(created_at) ultima, COUNT(*) FILTER (WHERE created_at > now() - interval '7 days') ult_7d,
       COUNT(*) FILTER (WHERE status = 'error' AND created_at > now() - interval '7 days') erros_7d
  FROM cron_logs GROUP BY 1 ORDER BY 2 DESC;

\echo '== 6. MOTOR DE CADENCIAS / FILA'
SELECT estagio, COUNT(*) FROM remarketing_contatos GROUP BY 1 ORDER BY 2 DESC;
SELECT estagio, COUNT(*) total, COUNT(*) FILTER (WHERE ativo) ativas FROM remarketing_cadencias GROUP BY 1;
SELECT status, COUNT(*), MAX(created_at) FROM remarketing_fila GROUP BY 1;
SELECT MAX(created_at) ultimo_envio_historico FROM remarketing_historico;
SELECT ativo, limite_por_dia, (api_key_cron IS NOT NULL AND api_key_cron <> '') AS tem_api_key FROM remarketing_config;

ROLLBACK;
