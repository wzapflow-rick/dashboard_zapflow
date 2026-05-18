'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { encrypt, decrypt } from '@/lib/session';
import { getMe, requireAdmin } from '@/lib/session-server';
import { CompanyUpdateSchema } from '@/lib/validations';
import { pg } from '@/lib/postgres';
import { EMPRESAS_TABLE, CONFIGURACOES_LOJA_TABLE } from '@/lib/tables';

/**
 * Busca detalhes da empresa, incluindo a logo da tabela de configurações extras.
 */
export async function getCompanyDetails() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const [company, extraConfig] = await Promise.all([
            pg.findById(EMPRESAS_TABLE, user.empresaId) as Promise<any>,
            pg.findOne(CONFIGURACOES_LOJA_TABLE, {
                where: { empresa_id: user.empresaId }
            }) as Promise<any>
        ]);

        if (company) {
            company.logo = extraConfig?.logo || company.logo || null;
            company.banner = extraConfig?.banner || company.banner || null;
        }

        return company;
    } catch (error) {
        console.error('API Error (getCompanyDetails):', error);
        return null;
    }
}

/**
 * Atualiza os dados da empresa e a logo.
 * Também atualiza a sessão JWT para refletir mudanças no nome da unidade.
 */
export async function updateCompany(data: any) {
    try {
        const user = await requireAdmin();

        // 1. Separar dados da logo e banner para a nova tabela
        const { logo, banner, ...companyData } = data;

        // 2. Atualizar dados principais da empresa
        const payload = {
            id: user.empresaId,
            ...companyData
        };

        const updatedData = await pg.update(EMPRESAS_TABLE, payload) as any;

        // 3. Persistir a logo e banner na tabela dedicada
        if (logo !== undefined || banner !== undefined) {
            const extraConfig = await pg.findOne(CONFIGURACOES_LOJA_TABLE, {
                where: { empresa_id: user.empresaId }
            }) as any;

            const updatePayload: any = {};
            if (logo !== undefined) updatePayload.logo = logo;
            if (banner !== undefined) updatePayload.banner = banner;

            if (extraConfig) {
                await pg.update(CONFIGURACOES_LOJA_TABLE, {
                    id: extraConfig.id,
                    ...updatePayload
                });
            } else {
                await pg.create(CONFIGURACOES_LOJA_TABLE, {
                    empresa_id: user.empresaId,
                    ...updatePayload
                });
            }
            
            // Garante que o retorno tenha os dados atualizados
            if (logo !== undefined) updatedData.logo = logo;
            if (banner !== undefined) updatedData.banner = banner;
        }

        // 4. Atualizar a sessão se o nome fantasia mudou
        if (companyData.nome_fantasia) {
            const sessionCookie = (await cookies()).get('session')?.value;
            if (sessionCookie) {
                const payloadSession = await decrypt(sessionCookie);
                if (payloadSession) {
                    const newSession = await encrypt({
                        ...payloadSession,
                        nome: companyData.nome_fantasia
                    });
                    
                    const isProduction = process.env.NODE_ENV === 'production';
                    (await cookies()).set('session', newSession, {
                        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
                        httpOnly: true,
                        secure: isProduction,
                        sameSite: 'strict',
                        path: '/',
                    });
                }
            }
        }

        revalidatePath('/dashboard/settings');
        revalidatePath('/dashboard/growth');
        
        return updatedData;
    } catch (error: any) {
        console.error('API Error (updateCompany):', error);
        throw new Error(error.message || 'Erro ao atualizar dados da empresa');
    }
}
