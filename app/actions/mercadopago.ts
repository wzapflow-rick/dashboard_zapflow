'use server';

import { pg } from '@/lib/postgres';

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
        const config = await pg.findOne('pagamentos_config', {
            where: { empresa_id: empresaId }
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

/**
 * Verifica, em tempo real, se a conta do Mercado Pago do lojista logado
 * consegue gerar cobrancas PIX (QR Code).
 *
 * Faz isso criando um pagamento PIX de teste de valor minimo e cancelando-o
 * em seguida. Se o MP retornar o erro 13253 / "Collector user without key
 * enabled for QR render", significa que a conta nao tem uma chave PIX
 * habilitada e o PIX nao funcionara no cardapio.
 */
export async function checkPixAvailability(): Promise<{ available: boolean; reason?: string }> {
    const { getMe } = await import('./auth');
    const me = await getMe();

    if (!me || !me.empresaId) {
        return { available: false, reason: 'Nao autorizado' };
    }

    const { accessToken } = await getCompanyMPCredentials(me.empresaId);
    if (!accessToken) {
        return { available: false, reason: 'Conta do Mercado Pago nao conectada' };
    }

    try {
        const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'X-Idempotency-Key': `pix-check-${me.empresaId}-${Date.now()}`
            },
            body: JSON.stringify({
                transaction_amount: 1,
                description: 'Verificacao de chave PIX (ZapFlow)',
                payment_method_id: 'pix',
                payer: { email: 'verificacao-pix@zapflow.com.br' }
            })
        });

        const data = await mpResponse.json();

        if (mpResponse.ok) {
            // Cancela imediatamente o pagamento de teste para nao deixar pendencia.
            if (data?.id) {
                try {
                    await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`
                        },
                        body: JSON.stringify({ status: 'cancelled' })
                    });
                } catch (cancelErr) {
                    console.error('[MercadoPago] Falha ao cancelar pagamento de teste PIX:', cancelErr);
                }
            }
            return { available: true };
        }

        const rawMessage = `${data.message || ''} ${data.error || ''}`.toLowerCase();
        const causes = Array.isArray(data.cause) ? data.cause : [];
        const isPixKeyError =
            causes.some((c: any) => Number(c?.code) === 13253) ||
            rawMessage.includes('key enabled for qr') ||
            rawMessage.includes('financial identity');

        if (isPixKeyError) {
            return {
                available: false,
                reason: 'A conta do Mercado Pago nao tem uma chave PIX habilitada para gerar QR Code.'
            };
        }

        console.error('[MercadoPago] checkPixAvailability erro inesperado:', JSON.stringify(data));
        return {
            available: false,
            reason: data.message || 'Nao foi possivel verificar o PIX agora. Tente novamente.'
        };
    } catch (error: any) {
        console.error('[MercadoPago] checkPixAvailability falhou:', error);
        return { available: false, reason: 'Erro de conexao ao verificar o PIX.' };
    }
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
        const order = await pg.findById('pedidos', orderId) as any;
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

        const pedido = await pg.findById('pedidos', pedidoId) as PedidoData;

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

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cardapio.wzapflow.com.br';
        const notificationUrl = `${baseUrl}/api/webhooks/mercadopago`;
        console.log(`[MercadoPago] Notification URL configurada: ${notificationUrl}`);

        const paymentPayload: Record<string, unknown> = {
            transaction_amount: validAmount,
            description: `Pedido #${pedidoId} - ${pedido.cliente_nome || 'Cliente'}`,
            external_reference: String(pedidoId),
            notification_url: notificationUrl,
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

            // Mensagem amigavel quando a conta do recebedor (lojista) nao tem
            // chave PIX habilitada para gerar o QR Code. O Mercado Pago retorna
            // o codigo 13253 / "Collector user without key enabled for QR render".
            const rawMessage = `${errorData.message || ''} ${errorData.error || ''}`.toLowerCase();
            const causes = Array.isArray(errorData.cause) ? errorData.cause : [];
            const isPixKeyError =
                causes.some((c: any) => Number(c?.code) === 13253) ||
                rawMessage.includes('key enabled for qr') ||
                rawMessage.includes('financial identity');

            const isPix = paymentMethodId === 'pix';

            if (isPixKeyError || (isPix && mpResponse.status === 400)) {
                return {
                    success: false,
                    error: 'PIX indisponível no momento, escolha outra forma de pagamento.'
                };
            }

            return {
                success: false,
                error: errorData.message || errorData.error || 'Erro ao processar pagamento'
            };
        }

        const mpPayment = await mpResponse.json() as MPPaymentResponse;

        await pg.update('pedidos', pedidoId, {
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
        const order = await pg.findOne('pedidos', {
            where: { payment_id: String(paymentId) }
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
    const { cookies } = await import('next/headers');
    const me = await getMe();
    
    if (!me || !me.empresaId) {
        throw new Error('Não autorizado');
    }

    const clientId = process.env.MP_CLIENT_ID;
    if (!clientId) {
        throw new Error('MP_CLIENT_ID não configurado no servidor');
    }

    // Em produção, a Vercel fornece a URL base
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cardapio.wzapflow.com.br';
    const redirectUri = encodeURIComponent(`${baseUrl}/api/auth/mercadopago/callback`);
    
    // O 'state' pode ser usado para passar o empresaId e validar no retorno
    const state = me.empresaId;

    // Cookie dedicado ao fluxo OAuth: guarda o empresaId de forma INDEPENDENTE do
    // cookie de sessao principal. Motivo: no retorno do Mercado Pago (site externo),
    // o cookie de sessao pode nao ser enviado (cookies antigos ficaram SameSite=Strict),
    // deixando o callback sem saber a empresa e jogando o lojista para o /login.
    // Este cookie e SameSite=Lax (enviado no retorno via GET de nivel superior) e
    // de curta duracao (10 min), usado so para concluir a conexao.
    const isProduction = process.env.NODE_ENV === 'production';
    (await cookies()).set('mp_oauth_empresa', String(me.empresaId), {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: 600,
    });

    return `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${redirectUri}`;
}

/**
 * Verifica se a empresa atual tem o Mercado Pago conectado
 */
export async function getMPConnectionStatus(): Promise<{ connected: boolean; userId: string | null; publicKey: string | null }> {
    const { getMe } = await import('./auth');
    const me = await getMe();
    
    if (!me || !me.empresaId) return { connected: false, userId: null, publicKey: null };

    try {
        const config = await pg.findOne('pagamentos_config', {
            where: { empresa_id: me.empresaId },
        }) as any;

        return { 
            connected: !!config,
            userId: config?.mp_user_id ? String(config.mp_user_id) : null,
            publicKey: config?.mp_public_key ? String(config.mp_public_key) : null
        };
    } catch (error) {
        return { connected: false, userId: null, publicKey: null };
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
        const config = await pg.findOne('pagamentos_config', {
            where: { empresa_id: me.empresaId },
        }) as any;

        if (config) {
            await pg.delete('pagamentos_config', config.id);
        }

        return { success: true };
    } catch (error) {
        throw new Error('Erro ao desconectar Mercado Pago');
    }
}
