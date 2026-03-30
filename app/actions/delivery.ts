'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from './auth';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const TABLE_ID = 'm0f4c9g15bbd257'; // taxas_entrega-taxas_entrega

async function nocoFetch(endpoint: string, options: RequestInit = {}) {
    const url = `${NOCODB_URL}/api/v2/tables/${TABLE_ID}${endpoint}`;
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
        console.error(`NocoDB Error (Delivery): ${res.status} ${text}`);
        throw new Error(`NocoDB API Error: ${res.status}`);
    }

    return res;
}

export async function getDeliveryRates() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const res = await nocoFetch(`/records?limit=1000&where=(empresa_id,eq,${user.empresaId})`);
        const data = await res.json();
        return data.list || [];
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to fetch delivery rates');
    }
}

export async function upsertDeliveryRate(data: any) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        if (data.id) {
            // Em atualizações (PATCH), evitamos campos que o NocoDB pode considerar colunas de sistema (como IDs de relação)
            // ou que já estejam definidos.
            const { id, empresa_id, empresas, ...updatePayload } = data;
            const res = await nocoFetch('/records', {
                method: 'PATCH',
                body: JSON.stringify({ ...updatePayload, Id: id })
            });
            revalidatePath('/dashboard/settings');
            return await res.json();
        } else {
            // Na criação, usamos apenas o campo de relação 'empresas' que o NocoDB aceita para linkar registros
            const { empresa_id, id, ...insertData } = data;
            const payload = {
                ...insertData,
                empresas: user.empresaId
            };
            const res = await nocoFetch('/records', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            revalidatePath('/dashboard/settings');
            return await res.json();
        }
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to save delivery rate');
    }
}

export async function deleteDeliveryRate(id: number) {
    try {
        await nocoFetch('/records', {
            method: 'DELETE',
            body: JSON.stringify([{ id, Id: id }])
        });
        revalidatePath('/dashboard/settings');
        return { success: true };
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to delete delivery rate');
    }
}

