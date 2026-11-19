-- =====================================================
-- NOTIFICAÇÕES PUSH (celular / navegador)
-- Execute com um usuário administrador do banco (dono do schema public).
-- O usuário do app não tem permissão de CREATE no schema public.
-- =====================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL,
  usuario_id INTEGER,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_empresa ON push_subscriptions (empresa_id);

-- Libera o acesso para o usuário que o app usa (troque "app_user" pelo usuário da DATABASE_URL, se for diferente do admin).
-- GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO app_user;
-- GRANT USAGE, SELECT ON SEQUENCE push_subscriptions_id_seq TO app_user;
