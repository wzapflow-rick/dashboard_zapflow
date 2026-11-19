import webpush from 'web-push';
import { pg } from '@/lib/postgres';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface BrowserPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

let vapidConfigured = false;
let tableReady: Promise<void> | null = null;

export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}

function configureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:suporte@zapflash.com.br',
    publicKey,
    privateKey,
  );
  vapidConfigured = true;
  return true;
}

// Cria a tabela sob demanda para não depender de uma migração manual no deploy.
function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = pg
      .raw(`
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
      `)
      .then(() => undefined)
      .catch((error) => {
        // Em produção o usuário do app não tem CREATE no schema public; a tabela vem da
        // migração database/migrations/20261118_create_push_subscriptions.sql.
        if (/permission denied/i.test(String(error?.message))) return;
        tableReady = null;
        throw error;
      });
  }
  return tableReady;
}

export async function saveSubscription(
  empresaId: number,
  usuarioId: number | null,
  subscription: BrowserPushSubscription,
  userAgent: string | null,
) {
  await ensureTable();
  await pg.raw(
    `INSERT INTO push_subscriptions (empresa_id, usuario_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (endpoint) DO UPDATE SET
       empresa_id = EXCLUDED.empresa_id,
       usuario_id = EXCLUDED.usuario_id,
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth,
       user_agent = EXCLUDED.user_agent,
       atualizado_em = NOW()`,
    [
      empresaId,
      usuarioId,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth,
      userAgent?.slice(0, 300) ?? null,
    ],
  );
}

export async function removeSubscription(empresaId: number, endpoint: string) {
  await ensureTable();
  await pg.raw('DELETE FROM push_subscriptions WHERE empresa_id = $1 AND endpoint = $2', [
    empresaId,
    endpoint,
  ]);
}

export async function sendPushToEmpresa(empresaId: number, payload: PushPayload) {
  if (!configureVapid()) {
    console.warn('[Push] VAPID não configurado; notificação ignorada');
    return { sent: 0, failed: 0 };
  }
  await ensureTable();

  const subscriptions = await pg.raw<{ id: number; endpoint: string; p256dh: string; auth: string }>(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE empresa_id = $1',
    [empresaId],
  );
  if (subscriptions.length === 0) return { sent: 0, failed: 0 };

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/dashboard/expedition',
    tag: payload.tag,
  });

  let sent = 0;
  let failed = 0;
  const expiredIds: number[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message,
          { TTL: 60 * 60, urgency: 'high' },
        );
        sent++;
      } catch (error: any) {
        failed++;
        // 404/410: o aparelho cancelou a inscrição ou o app foi desinstalado.
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          expiredIds.push(sub.id);
        } else {
          console.error('[Push] Falha ao enviar:', error?.statusCode || error?.message);
        }
      }
    }),
  );

  if (expiredIds.length > 0) {
    await pg.raw('DELETE FROM push_subscriptions WHERE id = ANY($1::int[])', [expiredIds]);
  }

  return { sent, failed };
}

function formatBRL(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function notifyNewOrder(
  empresaId: number,
  order: { id: number | string; clienteNome?: string | null; total?: unknown; origem?: string | null },
) {
  const firstName = order.clienteNome?.trim().split(/\s+/)[0] || 'Cliente';
  const total = formatBRL(order.total);
  const origem = order.origem && order.origem !== 'cardapio' ? ` via ${order.origem}` : '';

  return sendPushToEmpresa(empresaId, {
    title: `Novo pedido #${order.id}`,
    body: `${firstName}${total ? ` - ${total}` : ''}${origem}`,
    url: '/dashboard/expedition',
    tag: `pedido-${order.id}`,
  }).catch((error) => {
    console.error('[Push] Erro ao notificar novo pedido:', error?.message);
    return { sent: 0, failed: 0 };
  });
}
