'use server';

import { getMe } from '@/lib/session-server';
import { pg } from '@/lib/postgres';
import { testWhatsApp as enviarTesteWhatsApp } from '@/lib/whatsapp';

/**
 * Envia a mensagem de teste pela instância vinculada à empresa.
 * Restrito ao admin do restaurante para não virar um disparador aberto.
 */
export async function testWhatsApp(phone: string) {
    const user = await getMe();
    if (!user?.empresaId || user.role !== 'admin') {
        return { success: false, formattedPhone: '', error: 'Não autorizado' };
    }

    try {
        const empresa = await pg.findById<{ instancia_evolution?: string | null }>(
            'empresas',
            user.empresaId,
        );
        const instanceName = empresa?.instancia_evolution || `zapflow_${user.empresaId}`;
        return enviarTesteWhatsApp(phone, instanceName);
    } catch (error: any) {
        console.error('[WhatsApp Test] Não foi possível carregar a instância da empresa:', error);
        return {
            success: false,
            formattedPhone: '',
            error: 'Não foi possível identificar a instância WhatsApp desta loja.',
        };
    }
}
