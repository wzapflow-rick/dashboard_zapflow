'use server';

import { cookies } from 'next/headers';

// Credenciais admin (em producao, usar env vars)
const ADMIN_USERS = [
  { username: 'Rick', password: '006677' },
];

const ADMIN_SESSION_COOKIE = 'admin_session';
const ADMIN_SESSION_SECRET = 'zapflow_admin_secret_2026';

export async function loginAdmin(username: string, password: string) {
  const admin = ADMIN_USERS.find(
    (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password
  );

  if (!admin) {
    return { success: false, error: 'Credenciais invalidas' };
  }

  // Criar sessao simples
  const sessionData = {
    username: admin.username,
    loginAt: new Date().toISOString(),
  };

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, Buffer.from(JSON.stringify(sessionData)).toString('base64'), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 horas
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
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_SESSION_COOKIE);

  if (!sessionCookie) {
    return null;
  }

  try {
    const sessionData = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());
    return sessionData;
  } catch {
    return null;
  }
}

export async function isAdminAuthenticated() {
  const session = await getAdminSession();
  return !!session;
}
