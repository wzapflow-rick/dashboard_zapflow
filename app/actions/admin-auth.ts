'use server';

import { cookies } from 'next/headers';
import { timingSafeEqual } from 'crypto';
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  readAdminSession,
} from '@/lib/admin-session';
import { checkRateLimit, clearRateLimitAttempts, getClientIp } from '@/lib/rate-limit';

const ADMIN_LOGIN_ACTION = 'admin_login';
const GENERIC_ERROR = 'Credenciais invalidas';

// Credenciais obrigatorias no servidor. Sem fallback: se faltar qualquer uma,
// o login administrativo fica bloqueado (fail-closed).
function getAdminCredentials(): { username: string; password: string } | null {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return null;
  return { username, password };
}

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function loginAdmin(username: string, password: string) {
  const admin = getAdminCredentials();
  if (!admin) {
    console.error('[AdminAuth] ADMIN_USERNAME/ADMIN_PASSWORD ausentes — login bloqueado');
    return { success: false, error: 'Login administrativo indisponivel. Contate o responsavel tecnico.' };
  }

  const ip = await getClientIp();
  const ipKey = `admin:ip:${ip}`;
  const userKey = `admin:user:${String(username || '').toLowerCase().slice(0, 64)}`;

  const [ipLimit, userLimit] = await Promise.all([
    checkRateLimit(ipKey, ADMIN_LOGIN_ACTION, {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
      blockDurationMs: 30 * 60 * 1000,
    }),
    checkRateLimit(userKey, ADMIN_LOGIN_ACTION, {
      maxAttempts: 10,
      windowMs: 15 * 60 * 1000,
      blockDurationMs: 30 * 60 * 1000,
    }),
  ]);

  if (!ipLimit.allowed || !userLimit.allowed) {
    const retryMs = Math.max(ipLimit.retryAfterMs || 0, userLimit.retryAfterMs || 0);
    const minutos = Math.max(1, Math.ceil(retryMs / 60000));
    console.warn('[AdminAuth] Login admin bloqueado por rate limit');
    return { success: false, error: `Muitas tentativas. Tente novamente em ${minutos} minutos.` };
  }

  const userOk = safeEqual(String(username || '').toLowerCase(), admin.username.toLowerCase());
  const passOk = safeEqual(String(password || ''), admin.password);

  if (!userOk || !passOk) {
    return { success: false, error: GENERIC_ERROR };
  }

  await Promise.all([
    clearRateLimitAttempts(ipKey, ADMIN_LOGIN_ACTION),
    clearRateLimitAttempts(userKey, ADMIN_LOGIN_ACTION),
  ]);

  const token = await createAdminSessionToken(admin.username);
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  });

  return { success: true, username: admin.username };
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  return { success: true };
}

export async function getAdminSession() {
  return readAdminSession();
}

export async function isAdminAuthenticated() {
  const session = await readAdminSession();
  return !!session;
}
