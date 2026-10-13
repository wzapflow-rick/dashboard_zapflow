'use server';

import { cookies } from 'next/headers';
import { timingSafeEqual } from 'crypto';
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  readAdminSession,
} from '@/lib/admin-session';

// Defina ADMIN_USERNAME e ADMIN_PASSWORD nas variaveis de ambiente da Vercel.
// Os valores abaixo sao mantidos apenas como fallback para nao bloquear o acesso atual.
function getAdminCredentials() {
  return {
    username: process.env.ADMIN_USERNAME || 'Rick',
    password: process.env.ADMIN_PASSWORD || '006677',
  };
}

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function loginAdmin(username: string, password: string) {
  const admin = getAdminCredentials();
  const userOk = safeEqual(String(username || '').toLowerCase(), admin.username.toLowerCase());
  const passOk = safeEqual(String(password || ''), admin.password);

  if (!userOk || !passOk) {
    return { success: false, error: 'Credenciais invalidas' };
  }

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
