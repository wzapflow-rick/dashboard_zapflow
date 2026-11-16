import { SignJWT, jwtVerify } from 'jose';
import { getJWTSecret } from './jwt-secret';

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
