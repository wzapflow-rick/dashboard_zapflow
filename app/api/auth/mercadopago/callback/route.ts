import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/session';
import { pg } from '@/lib/postgres';

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
        // 1. Identificar a empresa SEM depender do cookie de sessao principal.
        //    Ordem: (a) 'state' devolvido pelo Mercado Pago; (b) cookie dedicado
        //    'mp_oauth_empresa' (SameSite=Lax, gravado antes de ir ao MP); (c) sessao.
        //    O cookie de sessao pode nao ser enviado no retorno de um site externo
        //    (cookies antigos ficaram SameSite=Strict), por isso ele e o ultimo recurso.
        const cookieStore = await cookies();
        let empresaId: string | number | null = null;

        if (state) {
            empresaId = state;
            console.log(`[v0] [MP callback] empresaId via state: ${empresaId}`);
        }

        if (!empresaId) {
            const oauthCookie = cookieStore.get('mp_oauth_empresa')?.value;
            if (oauthCookie) {
                empresaId = oauthCookie;
                console.log(`[v0] [MP callback] empresaId via cookie dedicado: ${empresaId}`);
            }
        }

        if (!empresaId) {
            const sessionValue = cookieStore.get('session')?.value;
            if (sessionValue) {
                const payload = await decrypt(sessionValue);
                if (payload && payload.empresaId) {
                    empresaId = payload.empresaId;
                    console.log(`[v0] [MP callback] empresaId via sessao: ${empresaId}`);
                }
            }
        }

        if (!empresaId) {
            // Nunca manda para /login (confunde o lojista e perde o fluxo).
            // Volta para a aba de pagamentos com um erro claro.
            console.error('[v0] [MP callback] Empresa nao identificada (sem state, cookie ou sessao)');
            return NextResponse.redirect(new URL('/dashboard/settings?section=payments&error=mp_no_empresa', request.url));
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
                // Precisa ser IDENTICO ao redirect_uri usado na URL de autorizacao
                // (getMPAuthorizationUrl), senao o Mercado Pago recusa a troca do token.
                redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'https://cardapio.wzapflow.com.br'}/api/auth/mercadopago/callback`,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[v0] [MP callback] Falha na troca de token:', JSON.stringify(data));
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
        const existing = await pg.findOne('pagamentos_config', {
            where: { empresa_id: Number(empresaId) },
        }) as any;

        if (existing) {
            await pg.update('pagamentos_config', {
                id: existing.id,
                ...configData
            });
        } else {
            await pg.create('pagamentos_config', configData);
        }

        console.log(`[v0] [MP callback] Conta conectada com sucesso para empresa #${empresaId}`);

        // 4. Redireciona de volta para a aba de pagamentos com sucesso e limpa o
        //    cookie dedicado do fluxo OAuth (ja cumpriu seu papel).
        const successResponse = NextResponse.redirect(new URL('/dashboard/settings?section=payments&success=mp_connected', request.url));
        successResponse.cookies.delete('mp_oauth_empresa');
        return successResponse;

    } catch (err) {
        console.error('Mercado Pago Callback Internal Error:', err);
        return NextResponse.redirect(new URL('/dashboard/settings?section=payments&error=internal_error', request.url));
    }
}
