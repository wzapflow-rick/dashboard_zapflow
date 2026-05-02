'use server';

import { getOrderCreatedMessage, getStatusMessage, WhatsAppMessages } from '@/llm/messages';

const EVO_API_URL = process.env.EVOLUTION_API_URL || 'https://evo.wzapflow.com.br';
const EVO_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE || 'zapflow_testes';
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
 * Enviar mensagem via Evolution API
 */
export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
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

        const result = await response.json();
        console.log(`[WhatsApp] Resposta (${response.status}):`, JSON.stringify(result).substring(0, 200));

        return response.ok;
    } catch (error) {
        console.error('[WhatsApp] Erro ao enviar:', error);
        return false;
    }
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
 */
export async function sendOrderCreatedMessage(
    phone: string, 
    orderId: number, 
    total: number, 
    dataAgendamento?: string | null,
    itens?: any[]
): Promise<boolean> {
    const trackUrl = `${BASE_URL}/track/${orderId}`;
    const itensFormatados = itens ? formatItensForWhatsApp(itens) : '';
    const message = getOrderCreatedMessage(orderId, total, trackUrl, !!dataAgendamento, dataAgendamento || undefined, itensFormatados);

    return sendWhatsAppMessage(phone, message);
}

/**
 * Enviar mensagem de atualização de status
 * tipoEntrega: 'delivery' = entrega, 'retirada' = retirada
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

    return sendWhatsAppMessage(phone, message);
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
    
    const message = `Oba, ${nome}! Seu pagamento foi confirmado!

Agora falta pouco para comecar a vender mais!

Complete seu cadastro e acesse o painel:
${activationUrl}

Este link expira em 24 horas.

Qualquer duvida, estamos aqui!
Equipe ZapFlow`;

    return sendWhatsAppMessage(phone, message);
}

/**
 * Enviar mensagem de boas-vindas (apos ativacao da conta)
 */
export async function sendWelcomeMessage(
    phone: string,
    nome: string,
    email: string,
    plano: string
): Promise<boolean> {
    const planNames: Record<string, string> = {
        start: 'Start',
        pro: 'PRO',
        elite: 'ELITE',
    };
    
    const planName = planNames[plano] || plano;
    
    const message = `Bem-vindo ao ZapFlow, ${nome}!

Sua conta foi ativada com sucesso!

Plano: ${planName}
Email: ${email}
Acesso: ${BASE_URL}

Agora e so configurar seu cardapio e comecar a receber pedidos!

Dica: Comece adicionando suas categorias e produtos no menu "Cardapio".

Boas vendas!
Equipe ZapFlow`;

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
