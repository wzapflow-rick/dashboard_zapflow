import { getMe } from '@/lib/session-server';
import { pg } from '@/lib/postgres';

export async function logAction(action: string, details: string) {
    try {
        const user = await getMe();
        const payload = {
            usuario: user?.email || 'sistema',
            empresa_id: user?.empresaId || null,
            acao: action,
            detalhes: details,
            created_at: new Date().toISOString()
        };

        await pg.create('audit_logs', payload);
    } catch (error) {
        // Silencioso - nao quebra a aplicacao se der erro
        console.warn('[Audit] Erro ao registrar log:', error);
    }
}
