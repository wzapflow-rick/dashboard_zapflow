/**
 * Utilitarios compartilhados para envio confiavel via Evolution API.
 *
 * Motivacao: varios caminhos (campanhas, remarketing, cron) marcavam a
 * mensagem como "enviada" apenas verificando response.ok. No Brasil, o
 * WhatsApp aceita o request (HTTP 200) mas descarta a mensagem quando o JID
 * nao corresponde a uma conta real (problema do 9o digito) ou quando o numero
 * nao tem WhatsApp. Estes helpers resolvem o JID correto e validam a resposta.
 */

interface EvolutionCreds {
    baseUrl: string;
    apiKey: string;
}

/**
 * Verifica se um numero realmente tem conta no WhatsApp e retorna o JID
 * correto (resolve o problema do 9o digito no Brasil).
 *
 * Retorna:
 *  - { jid } quando o numero existe (jid reconhecido pelo WhatsApp)
 *  - { jid: null, exists: false } quando o numero NAO tem WhatsApp
 *  - { jid: null } quando nao foi possivel verificar -> segue com o numero original
 */
export async function resolverJidWhatsApp(
    phone: string,
    instanceName: string,
    creds: EvolutionCreds
): Promise<{ jid: string | null; exists?: boolean }> {
    try {
        const cleaned = String(phone).replace(/\D/g, '');
        const numeroBase = cleaned.length === 11 ? '55' + cleaned : cleaned;

        const url = `${creds.baseUrl}/chat/whatsappNumbers/${instanceName}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                apikey: creds.apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ numbers: [numeroBase] }),
            cache: 'no-store',
        });

        if (!response.ok) {
            // Endpoint indisponivel/instancia offline: nao bloqueia o envio.
            return { jid: null };
        }

        const data = await response.json();
        const item = Array.isArray(data) ? data[0] : data?.[0] || data?.response?.[0];

        if (item && item.exists === true && item.jid) {
            return { jid: item.jid };
        }
        if (item && item.exists === false) {
            return { jid: null, exists: false };
        }
        return { jid: null };
    } catch (error: any) {
        console.warn('[WhatsApp] Nao foi possivel validar numero:', error?.message);
        return { jid: null };
    }
}

/**
 * Interpreta a resposta de um POST /message/send* da Evolution e decide se o
 * envio foi realmente aceito. Considera sucesso apenas quando ha key.id.
 */
export function avaliarRespostaEvolution(
    ok: boolean,
    status: number,
    result: any
): { success: boolean; error?: string } {
    if (!ok) {
        const existsCheck = result?.response?.message;
        if (Array.isArray(existsCheck) && existsCheck.some((m: any) => m?.exists === false)) {
            return { success: false, error: 'numero nao tem WhatsApp (verifique o telefone cadastrado)' };
        }
        const errMsg = result?.message || result?.error || result?.response?.message || `HTTP ${status}`;
        return {
            success: false,
            error: (typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg)).substring(0, 300),
        };
    }

    // HTTP 2xx: uma resposta valida da Evolution contem a chave da mensagem.
    if (!result?.key?.id) {
        return { success: false, error: 'Evolution nao confirmou o envio (sem key.id na resposta)' };
    }
    return { success: true };
}
