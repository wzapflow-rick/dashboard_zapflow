'use server';

import bcrypt from 'bcryptjs';
import { getMe, requireAdmin } from '@/lib/session-server';
import { revalidatePath } from 'next/cache';
import { pg } from '@/lib/postgres';

export async function getUsers() {
    try {
        const user = await getMe();
        if (!user?.empresaId) return [];

        const data = await pg.list('usuarios', {
            where: { empresa_id: user.empresaId },
            sort: '-id',
        });

        return (data.list || []).map((u: any) => ({
            id: u.id,
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

        const result = await pg.create('usuarios', {
            empresa_id: me.empresaId,
            nome: data.nome,
            email: data.email,
            senha_hash: hashedPassword,
            role: data.role || 'atendente',
            ativo: true,
        });

        revalidatePath('/dashboard/users');
        return result;
    } catch (error: any) {
        throw new Error(error.message || 'Erro ao criar usuário');
    }
}

export async function updateUser(id: number, data: { nome?: string; email?: string; senha?: string; role?: string; ativo?: boolean }) {
    try {
        await requireAdmin();

        const body: any = {};
        if (data.nome !== undefined) body.nome = data.nome;
        if (data.email !== undefined) body.email = data.email;
        if (data.role !== undefined) body.role = data.role;
        if (data.ativo !== undefined) body.ativo = data.ativo;
        if (data.senha) body.senha_hash = bcrypt.hashSync(data.senha, 10);

        const result = await pg.update('usuarios', id, body);

        revalidatePath('/dashboard/users');
        return result;
    } catch (error: any) {
        throw new Error(error.message || 'Erro ao atualizar usuário');
    }
}

export async function deleteUser(id: number | string) {
    try {
        await requireAdmin();

        const numericId = Number(id);
        if (isNaN(numericId)) throw new Error('ID inválido');

        await pg.delete('usuarios', numericId);

        revalidatePath('/dashboard/users');
        return { success: true };
    } catch (error: any) {
        console.error('deleteUser Error:', error);
        throw new Error(error.message || 'Erro ao deletar usuário');
    }
}

export async function findUserByEmail(email: string) {
    try {
        const result = await pg.findOne('usuarios', {
            where: { email },
        });
        return result || null;
    } catch {
        return null;
    }
}
