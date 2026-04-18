'use server';

import { cookies } from 'next/headers';
import { decrypt } from './session';
import { User } from './validations';

export async function getMe(): Promise<User | null> {
    try {
        const cookieStore = await cookies();
        const sessionValue = cookieStore.get('session')?.value;
        if (!sessionValue) return null;
        return await decrypt(sessionValue) as User;
    } catch (error) {
        return null;
    }
}

export async function requireAdmin() {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');
    if (user.role !== 'admin') throw new Error('Acesso negado: apenas administradores');
    return user;
}

export async function requireOnboardingDone() {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');
    if (!user.onboarded) throw new Error('Complete o onboarding primeiro');
    return user;
}

export async function requireRole(allowedRoles: string[]) {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');
    if (!allowedRoles.includes(user.role)) {
        throw new Error(`Acesso negado: necessário um dos perfis: ${allowedRoles.join(', ')}`);
    }
    return user;
}

export async function logout() {
    (await cookies()).set('session', '', { expires: new Date(0) });
}
