'use server';

import { getMe } from '@/lib/session-server';
import { testWhatsApp as enviarTesteWhatsApp } from '@/lib/whatsapp';

/**
 * Envia a mensagem de teste pela instância da plataforma.
 * Restrito ao admin do restaurante para não virar um disparador aberto.
 */
export async function testWhatsApp(phone: string) {
    const user = await getMe();
    if (!user?.empresaId || user.role !== 'admin') {
        return { success: false, formattedPhone: '', error: 'Não autorizado' };
    }
    return enviarTesteWhatsApp(phone);
}
