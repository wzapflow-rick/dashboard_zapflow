/**
 * Session utilities for Edge Runtime (middleware)
 * This file is Edge-compatible and doesn't use 'use server' directive
 */

import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import type { User } from './validations';
import { getJWTSecret } from './jwt-secret';

let _key: Uint8Array | null = null;
function getKey(): Uint8Array {
    if (!_key) {
        _key = new TextEncoder().encode(getJWTSecret());
    }
    return _key;
}

async function decrypt(input: string): Promise<any> {
    try {
        const { payload } = await jwtVerify(input, getKey(), {
            algorithms: ['HS256'],
        });
        return payload;
    } catch (e) {
        return null;
    }
}

export async function getMeEdge(): Promise<User | null> {
    try {
        const cookieStore = await cookies();
        const sessionValue = cookieStore.get('session')?.value;
        if (!sessionValue) return null;
        return await decrypt(sessionValue) as User;
    } catch (error) {
        return null;
    }
}
