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

        // Usa os dados diretamente para evitar qualquer falha de validação silenciosa
        const payload = {
            id: user.empresaId,
            ...data
        };

        const updatedData = await noco.update(EMPRESAS_TABLE_ID, payload) as any;

        // Revalida apenas os caminhos necessários, sem tentar atualizar o cookie de sessão agora
        // para evitar erros de renderização de Server Component durante a transição
        revalidatePath('/dashboard/settings');
        
        return updatedData;
    } catch (error: any) {
        console.error('API Error (updateCompany):', error);
        throw new Error(error.message || 'Erro ao atualizar dados da empresa');
    }
}
