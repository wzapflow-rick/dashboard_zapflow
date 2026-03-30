'use server';

import bcrypt from 'bcryptjs';
import { getMe } from './auth';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
// NOTE: You need to create a 'usuarios' table in NocoDB with fields:
// empresa_id (Number), nome (Text), email (Text), senha (Text), role (Text: 'atendente' | 'admin')
const USUARIOS_TABLE_ID = process.env.USUARIOS_TABLE_ID || 'REPLACE_WITH_ACTUAL_TABLE_ID';

async function nocoFetch(endpoint: string, options: RequestInit = {}) {
    const url = `${NOCODB_URL}/api/v2/tables/${USUARIOS_TABLE_ID}${endpoint}`;
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
        console.error(`NocoDB Error (Usuarios): ${res.status} ${text}`);
        throw new Error(`NocoDB API Error: ${res.status}`);
    }
    return res;
}

export async function getUsers() {
    try {
        const user = await getMe();
        if (!user?.empresaId || user.role !== 'admin') throw new Error('Não autorizado');

        const res = await nocoFetch(`/records?where=(empresa_id,eq,${user.empresaId})&sort=-Id`);
        const data = await res.json();
        return (data.list || []).map((u: any) => ({
            id: u.id,
            nome: u.nome,
            email: u.email,
            role: u.role || 'atendente',
        }));
    } catch (error) {
        console.error('getUsers error:', error);
        return [];
    }
}

export async function createUser(data: { nome: string; email: string; senha: string; role: string }) {
    try {
        const me = await getMe();
        if (!me?.empresaId || me.role !== 'admin') throw new Error('Não autorizado');

        const hashedPassword = bcrypt.hashSync(data.senha, 10);

        const res = await nocoFetch('/records', {
            method: 'POST',
            body: JSON.stringify({
                empresa_id: me.empresaId,
                nome: data.nome,
                email: data.email,
                senha: hashedPassword,
                role: data.role || 'atendente',
            }),
        });

        return await res.json();
    } catch (error: any) {
        throw new Error(error.message || 'Erro ao criar usuário');
    }
}

export async function deleteUser(id: number) {
    try {
        const me = await getMe();
        if (!me?.empresaId || me.role !== 'admin') throw new Error('Não autorizado');

        await nocoFetch('/records', {
            method: 'DELETE',
            body: JSON.stringify({ id }),
        });

        return { success: true };
    } catch (error: any) {
        throw new Error(error.message || 'Erro ao deletar usuário');
    }
}

// Used by auth.ts to verify attendant login
export async function findUserByEmail(email: string) {
    try {
        const url = `${NOCODB_URL}/api/v2/tables/${USUARIOS_TABLE_ID}/records?where=(email,eq,${email})`;
        const res = await fetch(url, {
            headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' },
            cache: 'no-store',
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.list?.[0] || null;
    } catch {
        return null;
    }
}
