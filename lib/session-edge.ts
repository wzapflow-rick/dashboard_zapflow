/**
 * Session utilities for Edge Runtime (middleware)
 * This file is Edge-compatible and doesn't use 'use server' directive
 */

import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import type { User } from './validations';

function getJWTSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
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
