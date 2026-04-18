'use server';

import { getOrderCreatedMessage, getStatusMessage, WhatsAppMessages } from '@/llm/messages';

const EVO_API_URL = process.env.EVOLUTION_API_URL || 'https://evo.wzapflow.com.br';
const EVO_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE || 'zapflow_testes';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://menu.wzapflow.com.br';

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
        const obs = item.observacoes ? ` (${item.observacoes})` : '';
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