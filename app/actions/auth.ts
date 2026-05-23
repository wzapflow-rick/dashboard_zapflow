'use server';

import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { encrypt, decrypt } from '@/lib/session';
import { logger } from '@/lib/logger';
import { LoginSchema } from '@/lib/validations';
import { pg } from '@/lib/postgres';
import { EMPRESAS_TABLE, USUARIOS_TABLE } from '@/lib/tables';
import { checkRateLimit, clearRateLimitAttempts, checkLoginRateLimit, clearLoginRateLimits, getClientIp } from '@/lib/rate-limit';
import { notifySecurityRateLimitBlocked } from '@/lib/discord';

export async function login(data: any) {
    try {
        const rawData = data instanceof FormData ? Object.fromEntries(data) : data;

        const validated = LoginSchema.safeParse(rawData);
        if (!validated.success) {
            return { error: 'Dados de login inválidos' };
        }

        const { email, password } = validated.data;

        // Rate limiting combinado (email + IP)
        const clientIp = await getClientIp();
        const rateLimitResult = await checkLoginRateLimit(email, clientIp);

        if (!rateLimitResult.allowed) {
            logger.securityLoginFailure(email, 'RATE_LIMIT_EXCEEDED', `Blocked by ${rateLimitResult.blockedBy}, IP: ${clientIp}`);
            
            // Notificar no Discord sobre bloqueio
            notifySecurityRateLimitBlocked({
                email,
                ip: clientIp,
                blockedBy: rateLimitResult.blockedBy || 'email',
                tentativas: 5, // maxAttempts
            }).catch(() => {}); // Nao bloqueia se falhar
            
            return { error: rateLimitResult.error };
        }

        // 1. Tentar login como empresa/admin - busca por email ou login
        const empresas = await pg.raw(`
            SELECT * FROM empresas WHERE email = $1 OR login = $1 LIMIT 1
        `, [email]);
        const empresa = empresas[0] as any;

        const empresaSenha = empresa?.senha || empresa?.senha_hash || empresa?.password;

        if (empresa && empresaSenha && (bcrypt.compareSync(password, empresaSenha) || password === empresa.password || password === empresa.senha)) {
            logger.securityLoginSuccess(email, empresa.id);

            const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
            const session = await encrypt({
                userId: empresa.id,
                email: empresa.email,
                empresaId: empresa.id,
                nome: empresa.nome_fantasia || empresa.nome_admin || 'Minha Loja',
                onboarded: !!empresa.nome_fantasia,
                controle_estoque: !!empresa.controle_estoque,
                role: 'admin',
                source: 'empresa',
                bloqueado: !!empresa.bloqueado,
            });

            const isProduction = process.env.NODE_ENV === 'production';
            (await cookies()).set('session', session, {
                expires,
                httpOnly: true,
                secure: isProduction,
                sameSite: 'strict',
                path: '/',
            });
            await clearLoginRateLimits(email.toLowerCase(), clientIp);
            return { success: true, role: 'admin' };
        }

        // 2. Tentar login como usuário interno (atendente, cozinheiro, etc.)
        const usuario = await pg.findOne(USUARIOS_TABLE, {
            where: { email },
        }) as any;

        const usuarioSenha = usuario?.senha_hash || usuario?.senha || usuario?.password_hash;

        if (usuario && usuarioSenha && bcrypt.compareSync(password, usuarioSenha)) {
            if (usuario.ativo === false || usuario.ativo === 0 || String(usuario.ativo).toLowerCase() === 'false') {
                logger.securityLoginFailure(email, 'ACCOUNT_DISABLED', 'Usuário desativado');
                await new Promise(resolve => setTimeout(resolve, 1000));
                return { error: 'Sua conta foi desativada. Contate o administrador.' };
            }

            logger.securityLoginSuccess(email, usuario.id);

            const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
            const session = await encrypt({
                userId: usuario.id,
                email: usuario.email,
                empresaId: usuario.empresa_id,
                nome: usuario.nome,
                onboarded: true,
                controle_estoque: false,
                role: usuario.role || 'atendente',
                source: 'usuario'
            });

            const isProduction = process.env.NODE_ENV === 'production';
            (await cookies()).set('session', session, {
                expires,
                httpOnly: true,
                secure: isProduction,
                sameSite: 'strict',
                path: '/',
            });
            await clearLoginRateLimits(email.toLowerCase(), clientIp);
            return { success: true, role: usuario.role || 'atendente' };
        }

        logger.securityLoginFailure(email, 'INVALID_CREDENTIALS');

        await new Promise(resolve => setTimeout(resolve, 1000));
        return { error: 'E-mail ou senha inválidos' };
    } catch (error) {
        console.error('[AUTH] Login Error:', error);
        
        // Mostrar detalhes do erro em desenvolvimento
        if (process.env.NODE_ENV !== 'production' && error instanceof Error) {
            return { error: `Erro: ${error.message}` };
        }
        
        return { error: 'Erro interno no servidor' };
    }
}

export async function register(formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const nome = formData.get('nome') as string;

    const existing = await pg.raw(`
        SELECT * FROM empresas WHERE email = $1 OR login = $1 LIMIT 1
    `, [email]);

    if (existing.length > 0) return { error: 'E-mail já cadastrado' };

    const hashedPassword = bcrypt.hashSync(password, 10);

    const empresa = await pg.create(EMPRESAS_TABLE, {
        email,
        senha_hash: hashedPassword,
        login: email,
        nome_admin: nome,
        nome_fantasia: nome,
        nincho: 'Outros',
        instancia_evolution: '',
        planos: 'iniciante'
    }) as any;

    if (!empresa) return { error: 'Erro ao criar conta' };

    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const session = await encrypt({
        userId: empresa.id,
        email: empresa.email,
        empresaId: empresa.id,
        nome: empresa.nome_admin,
        onboarded: false,
        controle_estoque: false,
        role: 'admin'
    });
    const isProduction = process.env.NODE_ENV === 'production';
    (await cookies()).set('session', session, {
        expires,
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        path: '/',
    });

    return { success: true };
}

export async function updateOnboarding(onboardingData: any) {
    const sessionValue = (await cookies()).get('session')?.value;
    if (!sessionValue) return { error: 'Não autorizado' };

    const payload = await decrypt(sessionValue);
    if (!payload) return { error: 'Sessão inválida' };

    const empresaId = payload.empresaId;

    const updateBody: any = {
        id: empresaId,
        nome_fantasia: onboardingData.nome,
    };

    if (onboardingData.nicho) {
        updateBody.nincho = onboardingData.nicho;
    }

    if (onboardingData.instancia_evolution) {
        updateBody.instancia_evolution = onboardingData.instancia_evolution;
    }

    await pg.update(EMPRESAS_TABLE, updateBody);

    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const newSession = await encrypt({
        ...payload,
        nome: onboardingData.nome,
        onboarded: true,
        controle_estoque: !!onboardingData.controle_estoque
    });
    const isProduction = process.env.NODE_ENV === 'production';
    (await cookies()).set('session', newSession, {
        expires,
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        path: '/',
    });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/growth');

    return { success: true };
}

export async function logout() {
    const { logout: logoutServer } = await import('@/lib/session-server');
    return await logoutServer();
}

export async function getMe() {
    const { getMe: getMeServer } = await import('@/lib/session-server');
    return await getMeServer();
}

/**
 * Busca dados completos da empresa incluindo logo da configuracoes_loja
 */
export async function getEmpresaData() {
    const user = await getMe();
    if (!user?.empresaId) return null;
    
    try {
        const result = await pg.raw<any>(
            `SELECT e.id, e.nome_fantasia, e.email, e.telefone_loja, 
                    c.logo as logo_url, c.banner as banner_url
             FROM empresas e
             LEFT JOIN configuracoes_loja c ON c.empresa_id = e.id
             WHERE e.id = $1 LIMIT 1`,
            [user.empresaId]
        );
        return result[0] || null;
    } catch (error) {
        console.error('Erro ao buscar dados da empresa:', error);
        return null;
    }
}
