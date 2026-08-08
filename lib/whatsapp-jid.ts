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
 * Verifica se a instancia esta REALMENTE conectada ao WhatsApp (state "open").
 *
 * Sintoma classico: a Evolution aceita o POST /message/sendText (HTTP 201 com
 * key e status PENDING), mas se o socket do WhatsApp nao estiver aberto a
 * mensagem fica enfileirada e nunca e entregue. Checar o connectionState antes
 * de disparar evita marcar dezenas de mensagens como "enviado" a toa.
 */
export async function verificarConexaoInstancia(
    instanceName: string,
    creds: EvolutionCreds
): Promise<{ conectado: boolean; state: string }> {
    try {
        const url = `${creds.baseUrl}/instance/connectionState/${instanceName}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { apikey: creds.apiKey },
            cache: 'no-store',
        });

        if (!response.ok) {
            // Nao conseguimos confirmar: assumimos conectado para nao bloquear
            // indevidamente (o envio ainda valida a resposta individualmente).
            return { conectado: true, state: `desconhecido (HTTP ${response.status})` };
        }

        const data = await response.json();
        const state = data?.instance?.state || data?.state || 'desconhecido';
        return { conectado: state === 'open', state };
    } catch (error: any) {
        console.warn('[WhatsApp] Falha ao verificar conexao da instancia:', error?.message);
        return { conectado: true, state: 'erro-na-verificacao' };
    }
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

        console.log(`[WhatsApp] whatsappNumbers ${numeroBase} ->`, JSON.stringify(item ?? data).substring(0, 200));

        if (item && item.exists === true && item.jid) {
            // O JID retornado pelo whatsappNumbers e a fonte da verdade: ele ja
            // reflete a conta real no WhatsApp (com ou sem o 9o digito). Confiamos
            // nele diretamente, pois foi confirmado que muitas contas BR existem
            // apenas no formato legado (sem o 9o digito).
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
