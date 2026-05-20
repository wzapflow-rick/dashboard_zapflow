'use server';

import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { encrypt, decrypt } from '@/lib/session';
import { logger } from '@/lib/logger';
import { LoginSchema } from '@/lib/validations';
import { query } from '@/lib/db';
import { checkRateLimit, clearRateLimitAttempts } from '@/lib/rate-limit';

export async function login(data: any) {
    try {
        const rawData = data instanceof FormData ? Object.fromEntries(data) : data;

        const validated = LoginSchema.safeParse(rawData);
        if (!validated.success) {
            return { error: 'Dados de login inválidos' };
        }

        const { email, password } = validated.data;

        // Rate limiting distribuido usando PostgreSQL
        const rateLimitResult = await checkRateLimit(email.toLowerCase(), 'login', {
            maxAttempts: 5,
            windowMs: 15 * 60 * 1000,      // 15 minutos
            blockDurationMs: 30 * 60 * 1000, // 30 minutos de bloqueio
        });

        if (!rateLimitResult.allowed) {
            const remainingTime = Math.ceil((rateLimitResult.retryAfterMs || 0) / 1000 / 60);
            logger.securityLoginFailure(email, 'RATE_LIMIT_EXCEEDED', `Blocked for ${remainingTime} minutes`);
            return { error: `Muitas tentativas de login. Tente novamente em ${remainingTime} minutos.` };
        }

        // 1. Tentar login como empresa/admin
        const empresaResult = await query(
            `SELECT * FROM empresas WHERE email = $1 OR login = $1 LIMIT 1`,
            [email]
        );
        const empresa = empresaResult.rows[0];

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
            // Limpar tentativas apos login bem-sucedido
            await clearRateLimitAttempts(email.toLowerCase(), 'login');
            return { success: true, role: 'admin' };
        }

        // 2. Tentar login como usuario interno (atendente, cozinheiro, etc.)
        const usuarioResult = await query(
            `SELECT * FROM usuarios WHERE email = $1 LIMIT 1`,
            [email]
        );
        const usuario = usuarioResult.rows[0];

        const usuarioSenha = usuario?.senha_hash || usuario?.senha;

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
            // Limpar tentativas apos login bem-sucedido
            await clearRateLimitAttempts(email.toLowerCase(), 'login');
            return { success: true, role: usuario.role || 'atendente' };
        }

        // Login falhou - o rate limit ja foi registrado em checkRateLimit
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

    const existingResult = await query(
        `SELECT id FROM empresas WHERE email = $1 OR login = $1 LIMIT 1`,
        [email]
    );

    if (existingResult.rows.length > 0) return { error: 'E-mail já cadastrado' };

    const hashedPassword = bcrypt.hashSync(password, 10);

    const insertResult = await query(
        `INSERT INTO empresas (email, senha_hash, login, senha, nome_admin, nome_fantasia, status, nincho, instancia_evolution, planos)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [email, hashedPassword, email, hashedPassword, nome, nome, 'ativo', 'Outros', '', 'iniciante']
    );
    const empresa = insertResult.rows[0];

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

    const updateFields: string[] = ['nome_fantasia = $1'];
    const params: any[] = [onboardingData.nome];
    let paramIndex = 2;

    if (onboardingData.nicho) {
        updateFields.push(`nincho = $${paramIndex}`);
        params.push(onboardingData.nicho);
        paramIndex++;
    }

    if (onboardingData.instancia_evolution) {
        updateFields.push(`instancia_evolution = $${paramIndex}`);
        params.push(onboardingData.instancia_evolution);
        paramIndex++;
    }

    params.push(empresaId);

    await query(
        `UPDATE empresas SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
        params
    );

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
