'use server';

import bcrypt from 'bcryptjs';
import { getMe } from '@/lib/session-server';
import { pg } from '@/lib/postgres';

export async function changePassword(newPassword: string) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const hashedPassword = bcrypt.hashSync(newPassword, 10);

        await pg.update('empresas', user.empresaId, {
            senha: hashedPassword,
        });

        return { success: true };
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to update password');
    }
}
