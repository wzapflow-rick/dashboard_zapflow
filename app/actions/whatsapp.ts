'use server';

import { getOrderCreatedMessage, getOwnerNewOrderMessage, getStatusMessage, WhatsAppMessages } from '@/llm/messages';

const EVO_API_URL = process.env.EVOLUTION_API_URL || 'https://evo.wzapflow.com.br';
const EVO_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE || 'zapflow_ativacao';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://cardapio.wzapflow.com.br';

// Verificar se a API key está configurada
function checkApiKey() {
    if (!EVO_API_KEY) {
        throw new Error('EVOLUTION_API_KEY não configurada no ambiente');
    }
}

/**
 * Formatar número de telefone para Evolution API
 * Formato: 5511999999999@s.whatsapp.net
 */
function formatPhoneForEvolution(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
        cleaned = '55' + cleaned;
    }
    return `${cleaned}@s.whatsapp.net`;
}

/**
 * Enviar mensagem via Evolution API (instancia central da ZapFlow).
 * Retorna detalhes do resultado para que o chamador possa registrar o motivo da falha.
 */
export async function sendWhatsAppMessageDetailed(
    phone: string,
    message: string
): Promise<{ success: boolean; status: number; error: string | null }> {
    if (!EVO_API_KEY) {
        const error = 'EVOLUTION_API_KEY nao configurada';
        console.error(`[WhatsApp] ${error}`);
        return { success: false, status: 0, error };
    }

    try {
        const formattedPhone = formatPhoneForEvolution(phone);

        console.log(`[WhatsApp] Enviando para: ${formattedPhone}`);
        console.log(`[WhatsApp] Mensagem: ${message.substring(0, 50)}...`);

        const url = `${EVO_API_URL}/message/sendText/${EVO_INSTANCE}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': EVO_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                number: formattedPhone,
                text: message
            })
        });

        const rawText = await response.text();
        let result: any = rawText;
        try {
            result = JSON.parse(rawText);
        } catch {
            // resposta nao-JSON; mantem texto cru
        }
        console.log(`[WhatsApp] Resposta (${response.status}):`, JSON.stringify(result).substring(0, 200));

        if (response.ok) {
            return { success: true, status: response.status, error: null };
        }

        // Caso especifico: Evolution confirma que o numero NAO tem conta no WhatsApp.
        // Resposta: { response: { message: [{ jid, exists: false, number }] } }
        const existsCheck = result?.response?.message;
        if (Array.isArray(existsCheck) && existsCheck.some((m: any) => m?.exists === false)) {
            return {
                success: false,
                status: response.status,
                error: 'numero nao tem WhatsApp (verifique o telefone cadastrado)',
            };
        }

        // Extrai a mensagem de erro mais util da resposta da Evolution
        const errMsg =
            (result && (result.message || result.error || result.response?.message)) ||
            rawText ||
            `HTTP ${response.status}`;
        const error = `HTTP ${response.status}: ${typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg)}`.substring(0, 300);
        return { success: false, status: response.status, error };
    } catch (error: any) {
        const msg = error?.message ?? 'erro de rede';
        console.error('[WhatsApp] Erro ao enviar:', error);
        return { success: false, status: 0, error: msg };
    }
}

/**
 * Enviar mensagem via Evolution API
 */
export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
    const { success } = await sendWhatsAppMessageDetailed(phone, message);
    return success;
}

/**
 * Formatar itens do pedido para mensagem WhatsApp
 */
function formatItensForWhatsApp(itens: any[]): string {
    return itens.map(item => {
        const nome = item.nome || item.produto || 'Produto';
        const qtd = item.quantidade || 1;
        const preco = Number(item.preco || 0);
        const obs = (item.observacao || item.observacoes) ? ` (${item.observacao || item.observacoes})` : '';
        return `• ${nome} x${qtd}${obs} - R$ ${preco.toFixed(2).replace('.', ',')}`;
    }).join('\n');
}

/**
 * Enviar mensagem de confirmação de pedido criado
 * Usa a instancia da empresa para enviar (zapflow_{empresaId})
 */
export async function sendOrderCreatedMessage(
    phone: string, 
    orderId: number, 
    total: number, 
    dataAgendamento?: string | null,
    itens?: any[],
    empresaId?: number
): Promise<boolean> {
    const trackUrl = `${BASE_URL}/track/${orderId}`;
    const itensFormatados = itens ? formatItensForWhatsApp(itens) : '';
    const message = getOrderCreatedMessage(orderId, total, trackUrl, !!dataAgendamento, dataAgendamento || undefined, itensFormatados);

    // Se tiver empresaId, usa a instancia da empresa
    if (empresaId) {
        const result = await sendWhatsAppMessageWithInstance(phone, message, empresaId);
        return result.success;
    }
    
    // Fallback para instancia padrao (nao recomendado)
    return sendWhatsAppMessage(phone, message);
}

/**
 * Avisar o DONO da loja sobre um novo pedido do cardapio online.
 * Envia SEMPRE pelo numero central (zapflow_ativacao) para o telefone da loja,
 * independentemente de a empresa ter conectado o proprio WhatsApp.
 */
export async function sendOwnerNewOrderMessage(params: {
    ownerPhone: string;
    orderId: number;
    total: number;
    clienteNome: string;
    clienteTelefone?: string;
    isDelivery: boolean;
    endereco?: string;
    itens?: any[];
    pagamento?: string;
    observacoes?: string;
}): Promise<boolean> {
    const itensFormatados = params.itens ? formatItensForWhatsApp(params.itens) : '';
    const message = getOwnerNewOrderMessage({
        orderId: params.orderId,
        total: params.total,
        clienteNome: params.clienteNome,
        clienteTelefone: params.clienteTelefone,
        isDelivery: params.isDelivery,
        endereco: params.endereco,
        itens: itensFormatados,
        pagamento: params.pagamento,
        observacoes: params.observacoes,
    });

    // Sempre pela instancia central (numero da ZapFlow)
    return sendWhatsAppMessage(params.ownerPhone, message);
}

/**
 * Enviar mensagem de atualização de status
 * tipoEntrega: 'delivery' = entrega, 'retirada' = retirada
 * Usa a instancia da empresa para enviar (zapflow_{empresaId})
 */
export async function sendOrderStatusMessage(
    phone: string,
    orderId: number,
    status: string,
    empresaId?: number,
    tipoEntrega?: string
): Promise<boolean> {
    const isDelivery = tipoEntrega === 'delivery';
    const trackUrl = `${BASE_URL}/track/${orderId}`;
    
    const message = getStatusMessage(status, orderId, isDelivery, trackUrl, empresaId);

    // Se tiver empresaId, usa a instancia da empresa
    if (empresaId) {
        const result = await sendWhatsAppMessageWithInstance(phone, message, empresaId);
        return result.success;
    }
    
    // Fallback para instancia padrao (nao recomendado)
    return sendWhatsAppMessage(phone, message);
}

/**
 * Enviar mensagem via Evolution API usando instancia especifica da empresa
 * Cada empresa tem sua propria instancia: zapflow_{empresaId}
 */
export async function sendWhatsAppMessageWithInstance(
    phone: string, 
    message: string, 
    empresaId: number | string
): Promise<{ success: boolean; error?: string }> {
    try {
        const formattedPhone = formatPhoneForEvolution(phone);
        const instanceName = `zapflow_${empresaId}`;

        const url = `${EVO_API_URL}/message/sendText/${instanceName}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': EVO_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                number: formattedPhone,
                text: message
            })
        });

        const result = await response.json();

        if (!response.ok) {
            console.error(`[WhatsApp] Erro ao enviar para ${instanceName}:`, result);
            return { 
                success: false, 
                error: result.message || result.error || `HTTP ${response.status}` 
            };
        }

        return { success: true };
    } catch (error: any) {
        console.error('[WhatsApp] Erro ao enviar:', error);
        return { success: false, error: error.message || 'Erro desconhecido' };
    }
}

/**
 * Testar envio de WhatsApp (para debug)
 */
export async function testWhatsApp(phone: string): Promise<{ success: boolean; formattedPhone: string; error?: string }> {
    try {
        const formattedPhone = formatPhoneForEvolution(phone);
        
        const testMessage = WhatsAppMessages.testMessage
            .replace('{phone}', formattedPhone)
            .replace('{datetime}', new Date().toLocaleString('pt-BR'));

        console.log(`[WhatsApp Test] Enviando para: ${formattedPhone}`);
        console.log(`[WhatsApp Test] API: ${EVO_API_URL}`);
        console.log(`[WhatsApp Test] Instance: ${EVO_INSTANCE}`);

        const url = `${EVO_API_URL}/message/sendText/${EVO_INSTANCE}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': EVO_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                number: formattedPhone,
                text: testMessage
            })
        });

        const result = await response.json();
        console.log(`[WhatsApp Test] Resposta (${response.status}):`, result);
        
        if (!response.ok) {
            return {
                success: false,
                formattedPhone,
                error: result.message || result.error || `HTTP ${response.status}`
            };
        }

        return { success: true, formattedPhone };
    } catch (error: any) {
        console.error('[WhatsApp Test] Erro:', error);
        return {
            success: false,
            formattedPhone: formatPhoneForEvolution(phone),
            error: error.message || 'Erro desconhecido'
        };
    }
}

// ============================================================
// MENSAGENS DE CADASTRO / SIGNUP
// ============================================================

/**
 * Enviar mensagem de ativacao de conta (apos pagamento confirmado)
 */
export async function sendWelcomeSignupMessage(
    phone: string, 
    nome: string, 
    token: string
): Promise<boolean> {
    const activationUrl = `${BASE_URL}/ativar/${token}`;
    
    const message = `🎉 Pagamento confirmado, ${nome}!

Agora sua jornada para vender mais com o ZapFlow começou 🚀
Para liberar seu acesso, finalize seu cadastro clicando no link abaixo:
👉 ${activationUrl}

⏳ Importante: esse link é válido por 24 horas.

Assim que concluir, você já poderá acessar seu painel e começar a receber pedidos automaticamente no WhatsApp.

Se precisar de ajuda em qualquer etapa, é só chamar — estamos aqui com você 🤝
— Equipe ZapFlow`;

    return sendWhatsAppMessage(phone, message);
}

/**
 * Enviar mensagem de boas-vindas (apos ativacao da conta)
 */
export async function sendWelcomeMessage(
    phone: string,
    nome: string,
    email: string,
    plano: string,
    senha?: string
): Promise<boolean> {
    const planNames: Record<string, string> = {
        start: 'Start',
        pro: 'PRO',
        elite: 'ELITE',
        parceria: 'Parceria (Trial)',
    };
    
    const planName = planNames[plano] || plano;
    
    const senhaInfo = senha ? `\n🔑 Senha: ${senha}` : '';
    
    const message = `🎉 Bem-vindo ao ZapFlow, ${nome}!

Sua conta foi ativada com sucesso — agora é hora de começar a vender mais 🚀

📦 Plano: ${planName}
📧 E-mail: ${email}${senhaInfo}

🔗 Acesse seu painel:
${BASE_URL}

Agora é só configurar seu cardápio e começar a receber pedidos direto no WhatsApp.

💡 Dica rápida: comece criando suas categorias e adicionando seus produtos no menu "Cardápio" — isso já deixa sua loja pronta para vender.

Qualquer dúvida, estamos por aqui para te ajudar 🤝
Boas vendas!
— Equipe ZapFlow`;

    return sendWhatsAppMessage(phone, message);
}

/**
 * Enviar mensagem de boas-vindas para conta trial (Plano Parceria)
 */
export async function sendTrialWelcomeMessage(
    phone: string,
    nome: string,
    email: string,
    senha?: string
): Promise<boolean> {
    const senhaInfo = senha ? `\n🔑 Senha: ${senha}` : '';
    
    const message = `🎉 Bem-vindo ao ZapFlow, ${nome}!

Sua conta TRIAL foi criada com sucesso — você tem 7 dias GRÁTIS para testar tudo! 🚀

📦 Plano: Parceria (Trial)
📧 E-mail: ${email}${senhaInfo}
⏰ Período: 7 dias grátis

🔗 Acesse seu painel:
${BASE_URL}

Agora é só configurar seu cardápio e começar a receber pedidos direto no WhatsApp.

💡 Dica rápida: comece criando suas categorias e adicionando seus produtos no menu "Cardápio" — isso já deixa sua loja pronta para vender.

Após os 7 dias, você pode assinar o plano Start por apenas R$ 29,90/mês para continuar usando.

Qualquer dúvida, estamos por aqui para te ajudar 🤝
Boas vendas!
— Equipe ZapFlow`;

    return sendWhatsAppMessage(phone, message);
}

// ============================================================
// MENSAGENS DE COBRANCA / INADIMPLENCIA
// ============================================================

const PAYMENT_MESSAGES: Record<number, (nome: string, link: string) => string> = {
    1: (nome, link) => `Ola ${nome}! Sua assinatura ZapFlow vence hoje.

Pague via PIX para continuar usando o sistema sem interrupcoes:
${link}

Qualquer duvida, estamos aqui!
Equipe ZapFlow`,

    2: (nome, link) => `Ola ${nome}, sua assinatura ZapFlow esta 1 dia atrasada.

Regularize o pagamento para evitar o bloqueio do seu sistema:
${link}

Equipe ZapFlow`,

    3: (nome, link) => `Atencao ${nome}!

Sua assinatura esta 2 dias atrasada. Faltam apenas 2 dias para o bloqueio do seu sistema.

Pague agora e evite a interrupcao:
${link}

Equipe ZapFlow`,

    4: (nome, link) => `URGENTE ${nome}!

Amanha seu sistema ZapFlow sera bloqueado por inadimplencia.

Regularize AGORA para continuar recebendo pedidos:
${link}

Equipe ZapFlow`,

    5: (nome, link) => `${nome}, seu sistema ZapFlow foi BLOQUEADO.

Sua assinatura esta 5 dias atrasada e seu cardapio foi desativado.

Para reativar imediatamente, pague aqui:
${link}

Equipe ZapFlow`,
};

/**
 * Enviar lembrete de pagamento (cobranca)
 */
export async function sendPaymentReminder(
    phone: string,
    nome: string,
    dia: number,
    empresaId: number
): Promise<boolean> {
    const paymentLink = `${BASE_URL}/dashboard/subscription?pay=true&empresa=${empresaId}`;
    
    const getMessage = PAYMENT_MESSAGES[dia];
    if (!getMessage) {
        console.error('[WhatsApp] Dia de cobranca invalido:', dia);
        return false;
    }
    
    const message = getMessage(nome, paymentLink);
    return sendWhatsAppMessage(phone, message);
}

// ============================================================
// LEMBRETE DE RENOVACAO (antes da cobranca - cartao/assinatura)
// ============================================================

/**
 * Enviar lembrete de renovacao da assinatura ANTES da cobranca.
 * Disparado pelo cron billing-reminder a 3 e 1 dia(s) do vencimento.
 *
 * @param phone Telefone da loja
 * @param nome Nome da loja/responsavel
 * @param diasRestantes Quantos dias faltam para a cobranca (3 ou 1)
 * @param valor Valor da assinatura (numero)
 * @param finalCartao Ultimos 4 digitos do cartao (opcional)
 */
export async function sendRenewalReminder(
    phone: string,
    nome: string,
    diasRestantes: number,
    valor?: number | null,
    finalCartao?: string | null
): Promise<{ success: boolean; status: number; error: string | null }> {
    const valorFmt = valor != null && valor > 0
        ? `R$ ${valor.toFixed(2).replace('.', ',')}`
        : null;
    const cartaoInfo = finalCartao ? ` no cartão final ${finalCartao}` : '';
    const linkAssinatura = `${BASE_URL}/dashboard/subscription`;

    let message: string;

    if (diasRestantes <= 1) {
        // Reforço: 1 dia antes
        message = `Olá ${nome}! Passando para avisar: ${valorFmt ? `a renovação da sua assinatura ZapFlow (${valorFmt})` : 'a renovação da sua assinatura ZapFlow'} será cobrada amanhã${cartaoInfo}. ✅

Para não perder o acesso ao seu sistema, garanta que o cartão tenha saldo disponível.

Veja os detalhes da sua assinatura:
${linkAssinatura}

Equipe ZapFlow`;
    } else {
        // Aviso: 3 dias antes
        message = `Olá ${nome}! 👋

${valorFmt ? `Faltam ${diasRestantes} dias para a renovação da sua assinatura ZapFlow (${valorFmt})` : `Faltam ${diasRestantes} dias para a renovação da sua assinatura ZapFlow`}${cartaoInfo}.

Não precisa fazer nada: a cobrança é automática. Só garanta que o cartão tenha saldo para manter seu sistema funcionando sem interrupções.

Detalhes da assinatura:
${linkAssinatura}

Equipe ZapFlow`;
    }

    return sendWhatsAppMessageDetailed(phone, message);
}
