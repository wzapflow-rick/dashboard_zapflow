'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { encrypt } from '@/lib/session';
import { getMe, requireAdmin } from '@/lib/session-server';
import { CompanyUpdateSchema } from '@/lib/validations';
import { noco } from '@/lib/nocodb';
import { EMPRESAS_TABLE_ID } from '@/lib/constants';

export async function getCompanyDetails() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        return await noco.findById(EMPRESAS_TABLE_ID, user.empresaId);
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

export async function updateCompany(data: any) {
    try {
        const user = await requireAdmin();

        const validated = CompanyUpdateSchema.safeParse(data);
        if (!validated.success) {
            const errors = validated.error.issues.map((issue: any) => issue.message).join(', ');
            throw new Error('Dados inválidos: ' + errors);
        }

        const payload = {
            id: user.empresaId,
            ...validated.data
        };

        const updatedData = await noco.update(EMPRESAS_TABLE_ID, payload) as any;

        const record = Array.isArray(updatedData) ? updatedData[0] : updatedData;

        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const newSession = await encrypt({
            ...user,
            nome: record?.nome_fantasia || user.nome,
            onboarded: user.onboarded || !!record?.nome_fantasia,
            controle_estoque: record && Object.prototype.hasOwnProperty.call(record, 'controle_estoque')
                ? (record.controle_estoque === true || record.controle_estoque === 1 || record.controle_estoque === '1')
                : (data.controle_estoque !== undefined ? !!data.controle_estoque : !!user.controle_estoque)
        });
        const isProduction = process.env.NODE_ENV === 'production';
        (await cookies()).set('session', newSession, {
            expires,
            httpOnly: true,
            secure: isProduction,
            sameSite: 'strict',
            path: '/',
        });

        revalidatePath('/', 'layout');
        revalidatePath('/dashboard/settings');
        return updatedData;
    } catch (error: any) {
        console.error('API Error (updateCompany):', error);
        throw new Error(error.message || 'Erro ao atualizar dados da empresa');
    }
}
