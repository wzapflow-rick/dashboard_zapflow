import { SignJWT, jwtVerify } from 'jose';

function getJWTSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        // Durante o build, usar fallback para evitar erro
        // Em runtime de producao, a variavel deve estar configurada
        if (process.env.NODE_ENV === 'production' && typeof window === 'undefined' && !process.env.NEXT_PHASE) {
            console.warn('JWT_SECRET not set - using fallback for build');
        }
        return secret || 'fallback-secret-for-build-only-change-in-production';
    }
    if (secret.length < 32) {
        console.warn('JWT_SECRET should be at least 32 characters for security');
    }
    return secret;
}

// Lazy initialization to avoid build-time errors
let _key: Uint8Array | null = null;
function getKey(): Uint8Array {
    if (!_key) {
        _key = new TextEncoder().encode(getJWTSecret());
    }
    return _key;
}

export async function encrypt(payload: any) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(getKey());
}

export async function decrypt(input: string): Promise<any> {
    try {
        const { payload } = await jwtVerify(input, getKey(), {
            algorithms: ['HS256'],
        });
        return payload;
    } catch (e) {
        return null;
    }
}
