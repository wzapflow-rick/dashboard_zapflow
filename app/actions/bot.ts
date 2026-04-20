'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from '@/lib/session-server';
import { noco } from '@/lib/nocodb';
import { CLIENTES_TABLE_ID } from '@/lib/constants';

export async function toggleBotStatus(phone: string, botActive: boolean) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const client = await noco.findOne(CLIENTES_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})~and(telefone,eq,${phone})`,
        }) as any;

        if (!client) throw new Error('Cliente não encontrado');

        await noco.update(CLIENTES_TABLE_ID, {
            id: client.id,
            modo_robo: botActive
        });

        revalidatePath('/dashboard/customers');
        revalidatePath('/dashboard/customers/' + phone);

        return { success: true, botActive };
    } catch (error) {
        console.error('Error toggling bot status:', error);
        return { error: 'Falha ao alterar status do bot' };
    }
}

export async function getBotStatus(phone: string) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const client = await noco.findOne(CLIENTES_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})~and(telefone,eq,${phone})`,
        }) as any;

        return {
            botActive: client ? !!client.modo_robo : true
        };
    } catch (error) {
        console.error('Error getting bot status:', error);
        return { botActive: true };
    }
}
