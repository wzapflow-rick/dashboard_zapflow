'use server';

import bcrypt from 'bcryptjs';
import { getMe } from '@/lib/session-server';
import { noco } from '@/lib/nocodb';
import { EMPRESAS_TABLE_ID } from '@/lib/constants';

export async function changePassword(newPassword: string) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const hashedPassword = bcrypt.hashSync(newPassword, 10);

        await noco.update(EMPRESAS_TABLE_ID, {
            id: user.empresaId,
            senha: hashedPassword,
        });

        return { success: true };
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to update password');
    }
}
