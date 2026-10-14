import { cookies } from 'next/headers';
import { encrypt, decrypt } from './session';

export const ADMIN_SESSION_COOKIE = 'admin_session';
const ADMIN_SCOPE = 'platform_admin';

export interface AdminSession {
  username: string;
  loginAt: string;
}

export async function createAdminSessionToken(username: string): Promise<string> {
  return encrypt({ scope: ADMIN_SCOPE, username, loginAt: new Date().toISOString() });
}

export async function readAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await decrypt(token);
  if (!payload || payload.scope !== ADMIN_SCOPE || typeof payload.username !== 'string') {
    return null;
  }
  return { username: payload.username, loginAt: String(payload.loginAt || '') };
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await readAdminSession();
  if (!session) {
    throw new Error('Nao autorizado');
  }
  return session;
}
