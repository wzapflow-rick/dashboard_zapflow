'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from './auth';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const CLIENTS_TABLE_ID = 'mkodxks6hpm2bg9'; // clientes

async function nocoFetch(endpoint: string, options: RequestInit = {}) {
    const url = `${NOCODB_URL}/api/v2/tables/${CLIENTS_TABLE_ID}${endpoint}`;
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
        console.error(`NocoDB Error (Bot Status): ${res.status} ${text}`);
        throw new Error(`NocoDB API Error: ${res.status}`);
    }

    return res;
}

/**
 * Altera o status do bot para um cliente específico.
 * @param phone Telefone do cliente
 * @param botActive Se o bot deve estar ativo (true) ou se o atendimento é humano (false)
 */
export async function toggleBotStatus(phone: string, botActive: boolean) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        // 1. Localizar o cliente
        const checkRes = await nocoFetch(`/records?where=(empresa_id,eq,${user.empresaId})~and(telefone,eq,${phone})`);
        const checkData = await checkRes.json();
        const client = checkData.list?.[0];

        if (!client) throw new Error('Cliente não encontrado');

        // 2. Atualizar o campo 'modo_robo' (assumindo que este campo existe ou será criado)
        // Se o campo não existir, o NocoDB ignorará ou retornará erro.
        // O ideal é que o n8n consulte este mesmo campo.
        await nocoFetch('/records', {
            method: 'PATCH',
            body: JSON.stringify({
                id: client.id,
                modo_robo: botActive
            })
        });

        revalidatePath('/dashboard/customers');
        revalidatePath('/dashboard/customers/' + phone);

        return { success: true, botActive };
    } catch (error) {
        console.error('Error toggling bot status:', error);
        return { error: 'Falha ao alterar status do bot' };
    }
}

/**
 * Busca o status do bot para um cliente.
 */
export async function getBotStatus(phone: string) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const checkRes = await nocoFetch(`/records?where=(empresa_id,eq,${user.empresaId})~and(telefone,eq,${phone})`);
        const checkData = await checkRes.json();
        const client = checkData.list?.[0];

        return {
            botActive: client ? !!client.modo_robo : true // Default is true (AI active)
        };
    } catch (error) {
        console.error('Error getting bot status:', error);
        return { botActive: true };
    }
}
