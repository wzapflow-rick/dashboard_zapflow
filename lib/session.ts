import { SignJWT, jwtVerify } from 'jose';
import { getMe } from '@/app/actions/auth';

function getJWTSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('JWT_SECRET environment variable is required in production');
        }
        console.warn('⚠️ Using fallback JWT_SECRET for development only. Set JWT_SECRET in production!');
        return 'fallback-secret-for-dev-only';
    }
    if (secret.length < 32) {
        console.warn('⚠️ JWT_SECRET should be at least 32 characters for security');
    }
    return secret;
}

const key = new TextEncoder().encode(getJWTSecret());

export async function encrypt(payload: any) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(key);
}

export async function decrypt(input: string): Promise<any> {
    try {
        const { payload } = await jwtVerify(input, key, {
            algorithms: ['HS256'],
        });
        return payload;
    } catch (e) {
        return null;
    }
}

export async function requireAdmin() {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');
    if (user.role !== 'admin') throw new Error('Acesso negado: apenas administradores');
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
