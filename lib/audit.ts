import { getMe } from '@/lib/session-server';
import { noco } from '@/lib/nocodb';

const AUDIT_TABLE_ID = 'm_audit_logs'; // Tabela de auditoria (criar no NocoDB se necessário)

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

        await noco.create(AUDIT_TABLE_ID, payload);
    } catch (error) {
        console.warn('Erro ao registrar log de auditoria:', error);
    }
}
