'use server';

import { noco } from '@/lib/nocodb';
import { PEDIDOS_TABLE_ID, PAGAMENTOS_CONFIG_TABLE_ID } from '@/lib/constants';

const MP_ACCESS_TOKEN_FALLBACK = process.env.MP_ACCESS_TOKEN || '';
const MP_PUBLIC_KEY_FALLBACK = process.env.MP_PUBLIC_KEY || '';

interface PedidoData {
    id: number;
    valor_total: number;
    cliente_nome: string;
    telefone_cliente: string;
    itens: string;
    empresa_id: number;
}

interface MPPaymentResponse {
    id: number;
    status: string;
    status_detail: string;
    transaction_details?: {
        total_paid_amount: number;
    };
    point_of_interaction?: {
        transaction_data?: {
            qr_code?: string;
            qr_code_base64?: string;
            ticket_url?: string;
        };
    };
}

/**
 * Busca as credenciais do Mercado Pago para uma empresa específica.
 * Se não encontrar, retorna as credenciais de fallback do ZapFlow.
 */
async function getCompanyMPCredentials(empresaId: number) {
    try {
        const config = await noco.findOne(PAGAMENTOS_CONFIG_TABLE_ID, {
            where: `(empresa_id,eq,${empresaId})`
        }) as any;

        if (config && config.mp_access_token) {
            console.log(`[MercadoPago] Usando credenciais próprias da empresa #${empresaId}`);
            return {
                accessToken: config.mp_access_token,
                publicKey: config.mp_public_key || MP_PUBLIC_KEY_FALLBACK
            };
        }
    } catch (error) {
        console.error(`[MercadoPago] Erro ao buscar config para empresa #${empresaId}:`, error);
    }

    console.log(`[MercadoPago] Usando credenciais de fallback para empresa #${empresaId}`);
    return {
        accessToken: MP_ACCESS_TOKEN_FALLBACK,
        publicKey: MP_PUBLIC_KEY_FALLBACK
    };
}

export async function getMPPublicKey(empresaId?: number): Promise<string> {
    if (empresaId) {
        const creds = await getCompanyMPCredentials(empresaId);
        return creds.publicKey;
    }
    return MP_PUBLIC_KEY_FALLBACK;
}

export async function getOrderPaymentId(orderId: number): Promise<string | null> {
    try {
        const order = await noco.findById(PEDIDOS_TABLE_ID, orderId) as any;
        return order?.payment_id ? String(order.payment_id) : null;
    } catch (error) {
        console.error('[MercadoPago] Erro ao buscar payment_id do pedido:', error);
        return null;
    }
}

export interface CreatePaymentInput {
    pedidoId: number;
    paymentMethodId: string;
    token?: string;
    issuerId?: string;
    installationTerms?: number;
}

export interface CreatePaymentResult {
    success: boolean;
    paymentId?: number;
    status?: string;
    statusDetail?: string;
    qrCode?: string;
    qrCodeBase64?: string;
    ticketUrl?: string;
    error?: string;
}

export async function createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    try {
        const { pedidoId, paymentMethodId, token, issuerId, installationTerms } = input;

        const pedido = await noco.findById(PEDIDOS_TABLE_ID, pedidoId) as PedidoData;

        if (!pedido) {
            return { success: false, error: 'Pedido não encontrado' };
        }

        // Busca credenciais dinâmicas da empresa
        const { accessToken } = await getCompanyMPCredentials(pedido.empresa_id);

        const amount = Number(pedido.valor_total);

        if (!amount || amount <= 0 || isNaN(amount)) {
            return { success: false, error: 'Valor do pedido inválido' };
        }

        const validAmount = Math.round(amount * 100) / 100;

        const nomePartes = (pedido.cliente_nome || 'Cliente Desconhecido').trim().split(' ');
        const firstName = nomePartes[0] || 'Cliente';
        const lastName = nomePartes.slice(1).join(' ') || 'Cardapio';

        const paymentPayload: Record<string, unknown> = {
            transaction_amount: validAmount,
            description: `Pedido #${pedidoId} - ${pedido.cliente_nome || 'Cliente'}`,
            external_reference: String(pedidoId),
            notification_url: `${process.env.NEXT_PUBLIC_API_URL || ''}/api/webhooks/mercadopago`,
            payer: {
                email: pedido.telefone_cliente
                    ? `${pedido.telefone_cliente.replace(/\D/g, '')}@cliente.zapflow.com`
                    : 'cliente@zapflow.com',
                first_name: firstName,
                last_name: lastName,
            },
        };

        if (paymentMethodId === 'pix') {
            paymentPayload.payment_method_id = 'pix';
            paymentPayload.installments = 1;
        } else if (token) {
            paymentPayload.payment_method_id = paymentMethodId === 'credit_card' ? 'master' : paymentMethodId;
            paymentPayload.token = token;
            paymentPayload.installments = installationTerms || 1;
            if (issuerId) {
                paymentPayload.issuer_id = issuerId;
            }
        } else {
            paymentPayload.payment_method_id = paymentMethodId;
            paymentPayload.installments = 1;
        }

        const idempotencyKey = `${pedidoId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'X-Idempotency-Key': idempotencyKey,
            },
            body: JSON.stringify(paymentPayload),
        });

        if (!mpResponse.ok) {
            const errorData = await mpResponse.json();
            console.error('[MercadoPago] Erro ao criar payment:', JSON.stringify({
                status: mpResponse.status,
                error: errorData,
                amount: amount,
                empresaId: pedido.empresa_id
            }, null, 2));
            return {
                success: false,
                error: errorData.message || errorData.error || 'Erro ao processar pagamento'
            };
        }

        const mpPayment = await mpResponse.json() as MPPaymentResponse;

        await noco.update(PEDIDOS_TABLE_ID, {
            id: pedidoId,
            payment_id: String(mpPayment.id),
            status_pagamento: mpPayment.status === 'approved' ? 'aprovado' : 'pendente',
        });

        return {
            success: true,
            paymentId: mpPayment.id,
            status: mpPayment.status,
            statusDetail: mpPayment.status_detail,
            qrCode: mpPayment.point_of_interaction?.transaction_data?.qr_code,
            qrCodeBase64: mpPayment.point_of_interaction?.transaction_data?.qr_code_base64,
            ticketUrl: mpPayment.point_of_interaction?.transaction_data?.ticket_url,
        };
    } catch (error: any) {
        console.error('[MercadoPago] Erro:', error);
        return { success: false, error: error.message || 'Erro interno' };
    }
}

export async function getPaymentStatus(paymentId: number): Promise<{
    success: boolean;
    status?: string;
    statusDetail?: string;
    error?: string;
}> {
    try {
        // Para o status, precisamos saber de qual empresa é o pagamento para usar o token correto
        // Buscamos o pedido pelo payment_id
        const order = await noco.findOne(PEDIDOS_TABLE_ID, {
            where: `(payment_id,eq,${paymentId})`
        }) as any;

        let accessToken = MP_ACCESS_TOKEN_FALLBACK;
        if (order?.empresa_id) {
            const creds = await getCompanyMPCredentials(order.empresa_id);
            accessToken = creds.accessToken;
        }

        const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!mpResponse.ok) {
            return { success: false, error: 'Erro ao buscar pagamento' };
        }

        const payment = await mpResponse.json() as MPPaymentResponse;

        return {
            success: true,
            status: payment.status,
            statusDetail: payment.status_detail,
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Gera a URL de autorização do Mercado Pago para o lojista
 */
export async function getMPAuthorizationUrl() {
    const { getMe } = await import('./auth');
    const me = await getMe();
    
    if (!me || !me.empresaId) {
        throw new Error('Não autorizado');
    }

    const clientId = process.env.MP_CLIENT_ID;
    if (!clientId) {
        throw new Error('MP_CLIENT_ID não configurado no servidor');
    }

    // Em produção, a Vercel fornece a URL base
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zap-order-sooty.vercel.app';
    const redirectUri = encodeURIComponent(`${baseUrl}/api/auth/mercadopago/callback`);
    
    // O 'state' pode ser usado para passar o empresaId e validar no retorno
    const state = me.empresaId;

    return `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${redirectUri}`;
}

/**
 * Verifica se a empresa atual tem o Mercado Pago conectado
 */
export async function getMPConnectionStatus() {
    const { getMe } = await import('./auth');
    const me = await getMe();
    
    if (!me || !me.empresaId) return { connected: false };

    try {
        const config = await noco.findOne(PAGAMENTOS_CONFIG_TABLE_ID, {
            where: `(empresa_id,eq,${me.empresaId})`,
        }) as any;

        return { 
            connected: !!config,
            userId: config?.mp_user_id || null,
            publicKey: config?.mp_public_key || null
        };
    } catch (error) {
        return { connected: false };
    }
}

/**
 * Remove a conexão do Mercado Pago da empresa
 */
export async function disconnectMP() {
    const { getMe } = await import('./auth');
    const me = await getMe();
    
    if (!me || !me.empresaId) throw new Error('Não autorizado');

    try {
        const config = await noco.findOne(PAGAMENTOS_CONFIG_TABLE_ID, {
            where: `(empresa_id,eq,${me.empresaId})`,
        }) as any;

        if (config) {
            await noco.delete(PAGAMENTOS_CONFIG_TABLE_ID, config.id || config.Id);
        }

        return { success: true };
    } catch (error) {
        throw new Error('Erro ao desconectar Mercado Pago');
    }
}
