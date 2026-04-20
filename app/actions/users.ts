'use server';

import bcrypt from 'bcryptjs';
import { getMe, requireAdmin } from '@/lib/session-server';
import { revalidatePath } from 'next/cache';
import { noco } from '@/lib/nocodb';
import { USUARIOS_TABLE_ID } from '@/lib/constants';

export async function getUsers() {
    try {
        const user = await getMe();
        if (!user?.empresaId) return [];

        const data = await noco.list(USUARIOS_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})`,
            sort: '-id',
        });

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

        const result = await noco.create(USUARIOS_TABLE_ID, {
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

        const body: any = { id };
        if (data.nome !== undefined) body.nome = data.nome;
        if (data.email !== undefined) body.email = data.email;
        if (data.role !== undefined) body.role = data.role;
        if (data.ativo !== undefined) body.ativo = data.ativo;
        if (data.senha) body.senha_hash = bcrypt.hashSync(data.senha, 10);

        const result = await noco.update(USUARIOS_TABLE_ID, body);

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

        await noco.delete(USUARIOS_TABLE_ID, numericId);

        revalidatePath('/dashboard/users');
        return { success: true };
    } catch (error: any) {
        console.error('deleteUser Error:', error);
        throw new Error(error.message || 'Erro ao deletar usuário');
    }
}

export async function findUserByEmail(email: string) {
    try {
        const result = await noco.findOne(USUARIOS_TABLE_ID, {
            where: `(email,eq,${email})`,
        });
        return result || null;
    } catch {
        return null;
    }
}
