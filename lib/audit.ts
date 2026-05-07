import { getMe } from '@/lib/session-server';
import { noco } from '@/lib/nocodb';

// Tabela de auditoria desativada temporariamente
// Para ativar, criar tabela 'audit_logs' no NocoDB com colunas:
// usuario (text), empresa_id (number), acao (text), detalhes (text), timestamp (datetime)
const AUDIT_TABLE_ID = ''; // Deixar vazio para desativar

export async function logAction(action: string, details: string) {
    // Auditoria desativada - tabela nao existe no NocoDB
    if (!AUDIT_TABLE_ID) {
        return;
    }
    
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
        // Silenciar erros de auditoria para nao impactar o usuario
    }
}
