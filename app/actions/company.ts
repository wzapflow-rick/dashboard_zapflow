'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { encrypt } from '@/lib/session';
import { getMe, requireAdmin } from '@/lib/session-server';
import { CompanyUpdateSchema } from '@/lib/validations';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const EMPRESAS_TABLE_ID = process.env.EMPRESAS_TABLE_ID || 'mp08yd7oaxn5xo2';

async function nocoFetch(endpoint: string, options: RequestInit = {}) {
    const url = `${NOCODB_URL}/api/v2/tables/${EMPRESAS_TABLE_ID}${endpoint}`;
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
        console.error(`NocoDB Error (Empresa): ${res.status} ${text}`);
        throw new Error(`NocoDB API Error: ${res.status}`);
    }

    return res;
}

export async function getCompanyDetails() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const res = await nocoFetch(`/records/${user.empresaId}`);
        return await res.json();
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

export async function updateCompany(data: any) {
    try {
        const user = await requireAdmin();

        // Validate input
        const validated = CompanyUpdateSchema.safeParse(data);
        if (!validated.success) {
            const errors = validated.error.issues.map((issue: any) => issue.message).join(', ');
            throw new Error('Dados inválidos: ' + errors);
        }

        // Mapeamento de campos da UI para o NocoDB (conforme identificamos ou supomos)
        const payload = {
            Id: user.empresaId,
            id: user.empresaId,
            ...validated.data
        };

        const res = await nocoFetch(`/records`, {
            method: 'PATCH',
            body: JSON.stringify(payload)
        });

        let updatedData = null;
        if (res && res.ok) {
            updatedData = await res.json();

            // NocoDB PATCH /records pode retornar um array ou um objeto dependendo da versão/endpoint
            const record = Array.isArray(updatedData) ? updatedData[0] : updatedData;

            // Atualizamos a sessão com os dados mais recentes
            const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
            const newSession = await encrypt({
                ...user,
                nome: record?.nome_fantasia || user.nome,
                onboarded: user.onboarded || !!record?.nome_fantasia,
                // Usamos o dado de retorno se disponível, senão mantemos o que foi enviado ou o atual
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
        }

        revalidatePath('/dashboard/settings');
        return updatedData;
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to update company');
    }
}
