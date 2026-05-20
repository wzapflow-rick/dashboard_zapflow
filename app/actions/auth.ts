'use server';

import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { encrypt, decrypt } from '@/lib/session';
import { logger } from '@/lib/logger';
import { LoginSchema } from '@/lib/validations';
import { pg } from '@/lib/postgres';
import { RATE_LIMIT } from '@/lib/constants';

const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();

export async function login(data: any) {
    try {
        const rawData = data instanceof FormData ? Object.fromEntries(data) : data;

        const validated = LoginSchema.safeParse(rawData);
        if (!validated.success) {
            return { error: 'Dados de login inválidos' };
        }

        const { email, password } = validated.data;

        const now = Date.now();
        const attemptKey = email.toLowerCase();
        const attempt = loginAttempts.get(attemptKey);

        if (attempt && attempt.count >= RATE_LIMIT.LOGIN_MAX_ATTEMPTS) {
            const timeSinceLast = now - attempt.lastAttempt;
            if (timeSinceLast < RATE_LIMIT.LOGIN_WINDOW_MS) {
                const remainingTime = Math.ceil((RATE_LIMIT.LOGIN_WINDOW_MS - timeSinceLast) / 1000 / 60);
                logger.securityLoginFailure(email, 'RATE_LIMIT_EXCEEDED', `Blocked for ${remainingTime} minutes`);
                return { error: `Muitas tentativas de login. Tente novamente em ${remainingTime} minutos.` };
            } else {
                loginAttempts.delete(attemptKey);
            }
        }

        // 1. Tentar login como empresa/admin
        const empresa = await pg.findOne('empresas', {
            where: { $or: [{ email }, { login: email }] },
        }) as any;

        const empresaSenha = empresa?.senha || empresa?.senha_hash || empresa?.password || empresa?.Senha || empresa?.senhaHash;

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
            loginAttempts.delete(attemptKey);
            return { success: true, role: 'admin' };
        }

        // 2. Tentar login como usuário interno (atendente, cozinheiro, etc.)
        const usuario = await pg.findOne('usuarios', {
            where: { email },
        }) as any;

        const usuarioSenha = usuario?.senha_hash || usuario?.senha || usuario?.Senha_hash || usuario?.senhaHash || usuario?.password_hash;

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
            loginAttempts.delete(attemptKey);
            return { success: true, role: usuario.role || 'atendente' };
        }

        const currentAttempt = loginAttempts.get(attemptKey) || { count: 0, lastAttempt: now };
        currentAttempt.count += 1;
        currentAttempt.lastAttempt = now;
        loginAttempts.set(attemptKey, currentAttempt);

        logger.securityLoginFailure(email, 'INVALID_CREDENTIALS');

        await new Promise(resolve => setTimeout(resolve, 1000));
        return { error: 'E-mail ou senha inválidos' };
    } catch (error) {
        console.error('Login Error:', error);
        return { error: 'Erro interno no servidor' };
    }
}

export async function register(formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const nome = formData.get('nome') as string;

    const existing = await pg.findOne('empresas', {
        where: { $or: [{ email }, { login: email }] },
    });

    if (existing) return { error: 'E-mail já cadastrado' };

    const hashedPassword = bcrypt.hashSync(password, 10);

    const empresa = await pg.create('empresas', {
        email,
        senha_hash: hashedPassword,
        login: email,
        senha: hashedPassword,
        password: password,
        nome_admin: nome,
        nome_fantasia: nome,
        status: 'ativo',
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

    await pg.update('empresas', updateBody);

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
