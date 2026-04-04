'use server';

const EVO_API_URL = process.env.EVOLUTION_API_URL || 'https://evo.wzapflow.com.br';
const EVO_API_KEY = process.env.EVOLUTION_API_KEY || 'RiquelmoBarbosaSantos147258369RiquelmoBarbosaSantos147258369RiquelmoBarbosaSantos147258369';
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE || 'zapflow_testes';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

/**
 * Formatar número de telefone para Evolution API
 * Formato: 5511999999999@s.whatsapp.net
 */
function formatPhoneForEvolution(phone: string): string {
    // Remover tudo que não é número
    let cleaned = phone.replace(/\D/g, '');

    // Se não tem código do país (11 dígitos), adicionar 55
    if (cleaned.length === 11) {
        cleaned = '55' + cleaned;
    }

    // Se já tem 12+ dígitos, manter como está
    // Formato final: 5511999999999@s.whatsapp.net
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
 * Enviar mensagem de confirmação de pedido criado
 */
export async function sendOrderCreatedMessage(phone: string, orderId: number, total: number): Promise<boolean> {
    const trackUrl = `${BASE_URL}/track/${orderId}`;

    const message = `🎉 *Pedido #${orderId} Recebido!*

Obrigado pelo seu pedido! Seu pedido de *R$ ${Number(total).toFixed(2).replace('.', ',')}* foi recebido com sucesso.

📱 *Acompanhe seu pedido em tempo real:*
${trackUrl}

Em breve enviaremos atualizações sobre seu pedido!

_Agradecemos a preferência!_`;

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

    // Multiple message variations to avoid banimento
    const messageVariations = {
        pagamento_pendente: [
            'Aguardando confirmação do pagamento.',
            'Seu pagamento está sendo processado.',
            'Precisamos confirmar seu pagamento.'
        ],
        pendente: isDelivery ? [
            'Seu pagamento foi confirmado e seu pedido já está sendo preparado!',
            'Pagamento confirmado! Em breve starts preparing your order!',
            'We confirmed your payment! Your order is being prepared!'
        ] : [
            'Pagamento confirmado! Seu pedido já está sendo preparado!',
            'Pedido confirmado e em produção!',
            'Seu pedido está na cozinha agora!'
        ],
        preparing: isDelivery ? [
            'Seu pedido está sendo preparado com todo carinho. Em breve sairá para entrega!',
            'Our kitchen is preparing your order. It will be delivered soon!',
            'Preparando seu pedido com todo carinho!'
        ] : [
            'Seu pedido está sendo preparado! Quando estiver pronto, avisaremos.',
            'Estamos preparando seu pedido!',
            'Na cozinha agora! Logo estará pronto.'
        ],
        delivery: [
            'Seu pedido está a caminho. Fique de olho, o entregador já está no caminho!',
            'Your order is on the way! Track it in real time.',
            '🛵 O entregador já saiu com seu pedido!'
        ],
        finished: isDelivery ? [
            'Espero que goste! Bom apetite! 🍕',
            'Delivery delivered! Enjoy your meal!',
            'Pedido entregue! Bom apetite!'
        ] : [
            'Seu pedido está pronto! Pode retirar no local.',
            'Your order is ready for pickup!',
            'Pedido pronto! Venha buscar.'
        ],
        canceled: [
            'Seu pedido foi cancelado. Se tiver dúvidas, entre em contato conosco.',
            'Order canceled. Contact us if you have questions.',
            'Pedido cancelado. Estamos à disposição.'
        ]
    };

    const getVariation = (statusKey: string, index: number): string => {
        const variations = messageVariations[statusKey as keyof typeof messageVariations];
        if (!variations) return '';
        return variations[index % variations.length];
    };

    // Rotate message index based on orderId to vary messages
    const messageIndex = orderId % 3;

    const statusMessages: Record<string, { emoji: string; title: string }> = {
        'pagamento_pendente': { emoji: '⏳', title: 'Pagamento Pendente' },
        'pendente': { emoji: '✅', title: 'Pedido Confirmado!' },
        'preparando': { emoji: '👨‍🍳', title: 'Preparando seu Pedido' },
        'entrega': { emoji: '🛵', title: 'Saiu para Entrega!' },
        'finalizado': { emoji: '🎉', title: isDelivery ? 'Pedido Entregue!' : 'Pedido Pronto!' },
        'cancelado': { emoji: '❌', title: 'Pedido Cancelado' }
    };

    const statusInfo = statusMessages[status] || { emoji: '📢', title: 'Atualização do Pedido' };
    const description = getVariation(status, messageIndex);

    const deliveryNote = isDelivery ? '\n📍 *Entrega em andamento*' : '\n🏪 *Retirada no local*';

    let message = `${statusInfo.emoji} *Pedido #${orderId} - ${statusInfo.title}*

${description}${deliveryNote}

📱 *Acompanhe seu pedido:*
${trackUrl}`;

    // Add rating link when order is finalized
    if (status === 'finalizado' && empresaId) {
        const ratingUrl = `${BASE_URL}/rating/${empresaId}/${orderId}`;
        message += `

⭐ *Nos avalie!* Sua opinião é muito importante:
${ratingUrl}`;
    }

    return sendWhatsAppMessage(phone, message);
}

/**
 * Testar envio de WhatsApp (para debug)
 */
export async function testWhatsApp(phone: string): Promise<{ success: boolean; formattedPhone: string; error?: string }> {
    try {
        const formattedPhone = formatPhoneForEvolution(phone);
        
        const testMessage = `🧪 *Mensagem de Teste - ZapFlow*

Se você recebeu esta mensagem, o sistema está funcionando corretamente!

📱 Número: ${formattedPhone}
⏰ ${new Date().toLocaleString('pt-BR')}

✅ Tudo certo!`;

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
