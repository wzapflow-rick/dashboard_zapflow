import { getMe } from '@/lib/session-server';
import { pg } from '@/lib/postgres';

export async function logAction(action: string, details: string) {
    try {
        const user = await getMe();
        const payload = {
            usuario: user?.email || 'sistema',
            empresa_id: user?.empresaId || 0,
            acao: action,
            detalhes: details,
            timestamp: new Date().toISOString()
        };

        await pg.create('audit_logs', payload);
    } catch (error) {
        console.warn('Erro ao registrar log de auditoria:', error);
    }
}
