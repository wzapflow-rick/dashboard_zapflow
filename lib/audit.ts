import { getMe } from '@/app/actions/auth';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const AUDIT_TABLE_ID = 'm_audit_logs'; // Exemplo, deve ser criada no NocoDB

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

        // Só tenta logar se a URL estiver configurada
        if (!NOCODB_URL || !NOCODB_TOKEN) return;

        await fetch(`${NOCODB_URL}/api/v2/tables/${AUDIT_TABLE_ID}/records`, {
            method: 'POST',
            headers: {
                'xc-token': NOCODB_TOKEN,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        console.warn('Erro ao registrar log de auditoria:', error);
    }
}
