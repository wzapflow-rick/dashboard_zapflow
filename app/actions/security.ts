'use server';

import bcrypt from 'bcryptjs';
import { getMe } from './auth';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const EMPRESAS_TABLE_ID = process.env.EMPRESAS_TABLE_ID || 'mp08yd7oaxn5xo2';

async function nocoFetch(endpoint: string, options: RequestInit = {}) {
    const url = `${NOCODB_URL}/api/v2/tables/${EMPRESAS_TABLE_ID}${endpoint}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            'xc-token': NOCODB_TOKEN,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
        cache: 'no-store',
    });

    if (!res.ok) {
        const text = await res.text();
        console.error(`NocoDB Error (Security): ${res.status} ${text}`);
        throw new Error(`NocoDB API Error: ${res.status}`);
    }

    return res;
}

export async function changePassword(newPassword: string) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const hashedPassword = bcrypt.hashSync(newPassword, 10);

        const res = await nocoFetch(`/records`, {
            method: 'PATCH',
            body: JSON.stringify({
                Id: user.empresaId,
                id: user.empresaId,
                senha: hashedPassword,
                password: newPassword // Mantendo sync com o campo plain se existir
            })
        });

        return { success: true };
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to update password');
    }
}
