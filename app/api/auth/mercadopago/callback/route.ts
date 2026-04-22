import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/session';
import { noco } from '@/lib/nocodb';
import { PAGAMENTOS_CONFIG_TABLE_ID } from '@/lib/constants';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // empresaId passado no início do fluxo
    const error = searchParams.get('error');

    // Se houver erro ou não houver código, redireciona de volta com erro
    if (error || !code) {
        console.error('Mercado Pago OAuth Error:', error || 'No code provided');
        return NextResponse.redirect(new URL('/dashboard/settings?section=payments&error=mp_auth_failed', request.url));
    }

    try {
        // 1. Tentar obter empresaId da sessão ou do 'state' do Mercado Pago
        let empresaId: string | number | null = null;
        
        const sessionValue = (await cookies()).get('session')?.value;
        if (sessionValue) {
            const payload = await decrypt(sessionValue);
            if (payload && payload.empresaId) {
                empresaId = payload.empresaId;
            }
        }

        // Se a sessão expirou durante o redirecionamento, usamos o 'state' que enviamos na ida
        if (!empresaId && state) {
            empresaId = state;
            console.log(`[MercadoPago] Sessão não encontrada, usando empresaId do state: ${empresaId}`);
        }

        if (!empresaId) {
            console.error('Mercado Pago OAuth: Empresa não identificada (sessão expirada e sem state)');
            return NextResponse.redirect(new URL('/login?callbackUrl=/dashboard/settings?section=payments', request.url));
        }

        // 2. Trocar o código pelo Access Token
        const response = await fetch('https://api.mercadopago.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: process.env.MP_CLIENT_ID || '',
                client_secret: process.env.MP_CLIENT_SECRET || '',
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: `${new URL(request.url).origin}/api/auth/mercadopago/callback`,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Mercado Pago Token Exchange Error:', data);
            return NextResponse.redirect(new URL('/dashboard/settings?section=payments&error=mp_token_failed', request.url));
        }

        // 3. Salvar as credenciais na tabela pagamentos_config
        const configData = {
            empresa_id: Number(empresaId),
            mp_access_token: data.access_token,
            mp_public_key: data.public_key,
            mp_user_id: String(data.user_id),
            mp_refresh_token: data.refresh_token,
        };

        // Verifica se já existe uma configuração para esta empresa
        const existing = await noco.findOne(PAGAMENTOS_CONFIG_TABLE_ID, {
            where: `(empresa_id,eq,${empresaId})`,
        }) as any;

        if (existing) {
            await noco.update(PAGAMENTOS_CONFIG_TABLE_ID, {
                id: existing.id || existing.Id,
                ...configData
            });
        } else {
            await noco.create(PAGAMENTOS_CONFIG_TABLE_ID, configData);
        }

        console.log(`[MercadoPago] Conta conectada com sucesso para empresa #${empresaId}`);

        // 4. Redireciona de volta para a aba de pagamentos com sucesso
        return NextResponse.redirect(new URL('/dashboard/settings?section=payments&success=mp_connected', request.url));

    } catch (err) {
        console.error('Mercado Pago Callback Internal Error:', err);
        return NextResponse.redirect(new URL('/dashboard/settings?section=payments&error=internal_error', request.url));
    }
}
