'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { encrypt } from '@/lib/session';
import { getMe, requireAdmin } from '@/lib/session-server';
import { CompanyUpdateSchema } from '@/lib/validations';
import { noco } from '@/lib/nocodb';
import { EMPRESAS_TABLE_ID, CONFIGURACOES_LOJA_TABLE_ID } from '@/lib/constants';

export async function getCompanyDetails() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const [company, extraConfig] = await Promise.all([
            noco.findById(EMPRESAS_TABLE_ID, user.empresaId) as Promise<any>,
            noco.findOne(CONFIGURACOES_LOJA_TABLE_ID, {
                where: `(empresa_id,eq,${user.empresaId})`
            }) as Promise<any>
        ]);

        if (company) {
            // Prioriza a logo da nova tabela de configurações
            company.logo = extraConfig?.logo || company.logo || null;
        }

        return company;
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

export async function updateCompany(data: any) {
    try {
        const user = await requireAdmin();

        // 1. Separar dados da logo para a nova tabela
        const { logo, ...companyData } = data;

        // 2. Atualizar dados principais da empresa
        const payload = {
            id: user.empresaId,
            ...companyData
        };

        const updatedData = await noco.update(EMPRESAS_TABLE_ID, payload) as any;

        // 3. Persistir a logo na tabela dedicada
        if (logo !== undefined) {
            const extraConfig = await noco.findOne(CONFIGURACOES_LOJA_TABLE_ID, {
                where: `(empresa_id,eq,${user.empresaId})`
            }) as any;

            if (extraConfig) {
                await noco.update(CONFIGURACOES_LOJA_TABLE_ID, {
                    id: extraConfig.id,
                    logo: logo
                });
            } else {
                await noco.create(CONFIGURACOES_LOJA_TABLE_ID, {
                    empresa_id: user.empresaId,
                    logo: logo
                });
            }
            
            // Garante que o retorno tenha a logo atualizada
            updatedData.logo = logo;
        }

        revalidatePath('/dashboard/settings');
        
        return updatedData;
    } catch (error: any) {
        console.error('API Error (updateCompany):', error);
        throw new Error(error.message || 'Erro ao atualizar dados da empresa');
    }
}
