'use server';

import bcrypt from 'bcryptjs';
import { getMe, requireAdmin } from '@/lib/session-server';
import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';

export async function getUsers() {
    try {
        const user = await getMe();
        if (!user?.empresaId) return [];

        const result = await query(
            `SELECT * FROM usuarios WHERE empresa_id = $1 ORDER BY id DESC`,
            [user.empresaId]
        );

        return (result.rows || []).map((u: any) => ({
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

        const result = await query(
            `INSERT INTO usuarios (empresa_id, nome, email, senha_hash, role, ativo)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [me.empresaId, data.nome, data.email, hashedPassword, data.role || 'atendente', true]
        );

        revalidatePath('/dashboard/users');
        return result.rows[0];
    } catch (error: any) {
        throw new Error(error.message || 'Erro ao criar usuário');
    }
}

export async function updateUser(id: number, data: { nome?: string; email?: string; senha?: string; role?: string; ativo?: boolean }) {
    try {
        await requireAdmin();

        const updates: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (data.nome !== undefined) {
            updates.push(`nome = $${paramIndex}`);
            params.push(data.nome);
            paramIndex++;
        }
        if (data.email !== undefined) {
            updates.push(`email = $${paramIndex}`);
            params.push(data.email);
            paramIndex++;
        }
        if (data.role !== undefined) {
            updates.push(`role = $${paramIndex}`);
            params.push(data.role);
            paramIndex++;
        }
        if (data.ativo !== undefined) {
            updates.push(`ativo = $${paramIndex}`);
            params.push(data.ativo);
            paramIndex++;
        }
        if (data.senha) {
            updates.push(`senha_hash = $${paramIndex}`);
            params.push(bcrypt.hashSync(data.senha, 10));
            paramIndex++;
        }

        params.push(id);

        const result = await query(
            `UPDATE usuarios SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            params
        );

        revalidatePath('/dashboard/users');
        return result.rows[0];
    } catch (error: any) {
        throw new Error(error.message || 'Erro ao atualizar usuário');
    }
}

export async function deleteUser(id: number | string) {
    try {
        await requireAdmin();

        const numericId = Number(id);
        if (isNaN(numericId)) throw new Error('ID inválido');

        await query(`DELETE FROM usuarios WHERE id = $1`, [numericId]);

        revalidatePath('/dashboard/users');
        return { success: true };
    } catch (error: any) {
        console.error('deleteUser Error:', error);
        throw new Error(error.message || 'Erro ao deletar usuário');
    }
}

export async function findUserByEmail(email: string) {
    try {
        const result = await query(
            `SELECT * FROM usuarios WHERE email = $1 LIMIT 1`,
            [email]
        );
        return result.rows[0] || null;
    } catch {
        return null;
    }
}
