import { getMe } from '@/lib/session-server';
import { pg } from '@/lib/postgres';

export async function logAction(action: string, details: string) {
    // Desabilitado temporariamente - tabela audit_logs nao existe ainda
    // Para habilitar, criar tabela:
    // CREATE TABLE audit_logs (
    //   id SERIAL PRIMARY KEY,
    //   usuario TEXT,
    //   empresa_id INTEGER,
    //   acao TEXT,
    //   detalhes TEXT,
    //   timestamp TIMESTAMPTZ DEFAULT NOW()
    // );
    return;
    
    /* 
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
        // Silencioso - nao quebra a aplicacao se tabela nao existir
    }
    */
}
