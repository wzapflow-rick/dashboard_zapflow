'use server';

import bcrypt from 'bcryptjs';
import { getMe, requireAdmin } from '@/lib/session-server';
import { revalidatePath } from 'next/cache';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const USUARIOS_TABLE_ID = process.env.USUARIOS_TABLE_ID || 'msrjfeb28e07cwx';

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
        if (!user?.empresaId) {
            return [];
        }

        const res = await nocoFetch(`/records?where=(empresa_id,eq,${user.empresaId})&sort=-id`);
        const data = await res.json();

        return (data.list || []).map((u: any) => ({
            id: u.id || u.Id,
            nome: u.nome,
            email: u.email,
            role: u.role || 'atendente',
            ativo: u.ativo !== false,
        }));
    } catch (error: any) {
        console.error('[getUsers] ERROR:', error);
        return [];
    }
}

export async function createUser(data: { nome: string; email: string; senha: string; role: string }) {
    try {
        const me = await requireAdmin();

        const hashedPassword = bcrypt.hashSync(data.senha, 10);

        const res = await nocoFetch('/records', {
            method: 'POST',
            body: JSON.stringify({
                empresa_id: me.empresaId,
                nome: data.nome,
                email: data.email,
                senha_hash: hashedPassword,
                role: data.role || 'atendente',
                ativo: true,
            }),
        });

        revalidatePath('/dashboard/users');
        return await res.json();
    } catch (error: any) {
        throw new Error(error.message || 'Erro ao criar usuário');
    }
}

export async function updateUser(id: number, data: { nome?: string; email?: string; senha?: string; role?: string; ativo?: boolean }) {
    try {
        const me = await requireAdmin();

        const body: any = { id };
        if (data.nome !== undefined) body.nome = data.nome;
        if (data.email !== undefined) body.email = data.email;
        if (data.role !== undefined) body.role = data.role;
        if (data.ativo !== undefined) body.ativo = data.ativo;
        if (data.senha) body.senha_hash = bcrypt.hashSync(data.senha, 10);

        const res = await nocoFetch(`/records/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        });

        revalidatePath('/dashboard/users');
        return await res.json();
    } catch (error: any) {
        throw new Error(error.message || 'Erro ao atualizar usuário');
    }
}

export async function deleteUser(id: number | string) {
    try {
        const me = await requireAdmin();

        const numericId = Number(id);
        if (isNaN(numericId)) throw new Error('ID inválido');

        await nocoFetch('/records', {
            method: 'DELETE',
            body: JSON.stringify([{ id: numericId, Id: numericId }])
        });

        revalidatePath('/dashboard/users');
        return { success: true };
    } catch (error: any) {
        console.error('deleteUser Error:', error);
        throw new Error(error.message || 'Erro ao deletar usuário');
    }
}

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
