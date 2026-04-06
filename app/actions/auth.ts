'use server';

import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { encrypt, decrypt } from '@/lib/session';
import { logger } from '@/lib/logger';

// Rate limiting para login
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const EMPRESAS_TABLE_ID = process.env.EMPRESAS_TABLE_ID || 'mrlxbm1guwn9iv8';
const USUARIOS_TABLE_ID = process.env.USUARIOS_TABLE_ID || 'm3hu4490tp0yra3';

async function nocoFetch(endpoint: string, options: RequestInit = {}, tableId: string) {
    try {
        const url = `${NOCODB_URL}/api/v2/tables/${tableId}${endpoint}`;
        const res = await fetch(url, {
            ...options,
            headers: {
                'xc-token': NOCODB_TOKEN,
                'Content-Type': 'application/json',
                ...(options.headers || {}),
            },
            cache: 'no-store',
        });

        if (!res.ok) {
            const text = await res.text();
            console.error(`NocoDB Error: ${res.status} ${text}`);
            return null;
        }

        return res;
    } catch (error) {
        console.error('NocoDB Fetch Exception:', error);
        return null;
    }
}

import { LoginSchema } from '@/lib/validations';

export async function login(data: any) {
    try {
        // Converter FormData para objeto se necessário
        const rawData = data instanceof FormData ? Object.fromEntries(data) : data;

        const validated = LoginSchema.safeParse(rawData);
        if (!validated.success) {
            return { error: 'Dados de login inválidos' };
        }

        const { email, password } = validated.data;

        // Rate limiting por email
        const now = Date.now();
        const attemptKey = email.toLowerCase();
        const attempt = loginAttempts.get(attemptKey);
        
        if (attempt && attempt.count >= MAX_ATTEMPTS) {
            const timeSinceLast = now - attempt.lastAttempt;
            if (timeSinceLast < WINDOW_MS) {
                const remainingTime = Math.ceil((WINDOW_MS - timeSinceLast) / 1000 / 60);
                
                // SECURITY: Log rate limit exceeded
                logger.securityLoginFailure(email, 'RATE_LIMIT_EXCEEDED', `Blocked for ${remainingTime} minutes`);
                
                return { error: `Muitas tentativas de login. Tente novamente em ${remainingTime} minutos.` };
            } else {
                // Reset após janela de tempo
                loginAttempts.delete(attemptKey);
            }
        }

        // 1. Tenta login na tabela EMPRESAS (Admin da loja)
        const filter = `(email,eq,${email})~or(login,eq,${email})`;
        const res = await nocoFetch(`/records?where=${filter}`, {}, EMPRESAS_TABLE_ID);

        if (res) {
            const resData = await res.json();
            const empresa = resData.list?.[0];

            if (empresa && (bcrypt.compareSync(password, empresa.senha) || password === empresa.password)) {
                // SECURITY: Log successful login
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
                    source: 'empresa'
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
                return { success: true };
            }
        }

        // 2. Tenta login na tabela USUARIOS (Atendentes, Cozinheiros)
        const usuariosRes = await nocoFetch(`/records?where=(email,eq,${email})`, {}, USUARIOS_TABLE_ID);

        if (usuariosRes) {
            const usuariosData = await usuariosRes.json();
            const usuario = usuariosData.list?.[0];

            console.log('[LOGIN DEBUG] usuario:', usuario ? Object.keys(usuario) : null);
            console.log('[LOGIN DEBUG] senha_hash exists:', !!usuario?.senha_hash);

            const hashField = usuario?.senha_hash || usuario?.senha || usuario?.Senha_hash || usuario?.senhaHash || usuario?.password_hash || usuario?.hash_senha;

            if (usuario && hashField && bcrypt.compareSync(password, hashField)) {
                // Verifica se está ativo
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
                return { success: true };
            }
        }

        // Login falhou em ambas as tabelas
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

    console.log('Register attempt:', email);
    // 1. Check if exists in empresas 
    const filter = `(email,eq,${email})~or(login,eq,${email})`;
    const checkRes = await nocoFetch(`/records?where=${filter}`, {}, EMPRESAS_TABLE_ID);
    const checkData = await checkRes?.json();
    if (checkData?.list?.length > 0) return { error: 'E-mail já cadastrado' };

    // 2. Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // 3. Create entry in empresas
    const createRes = await nocoFetch('/records', {
        method: 'POST',
        body: JSON.stringify({
            email,
            senha: hashedPassword,
            login: email,
            password: password,
            nome_admin: nome,
            nome_fantasia: `Loja de ${nome}`,        // Atualizado no onboarding
            instancia_evolution: '', // Removido temporariamente -ativar quando o bot estiver pronto
            status: 'ativo'
        })
    }, EMPRESAS_TABLE_ID);

    if (!createRes) return { error: 'Erro ao criar conta' };
    const empresa = await createRes.json();

    // 4. Set session (ID da empresa = ID do usuário)
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const session = await encrypt({
        userId: empresa.id,
        email: empresa.email,
        empresaId: empresa.id,
        nome: empresa.nome_admin,
        onboarded: false, // Novo registro sempre precisa de onboarding
        controle_estoque: false
    });
    const isProduction = process.env.NODE_ENV === 'production';
    (await cookies()).set('session', session, {
        expires,
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        path: '/',
    });

    console.log('Register success, session set (onboarded: false). User ID:', empresa.id);
    return { success: true };
}

export async function updateOnboarding(onboardingData: any) {
    const sessionValue = (await cookies()).get('session')?.value;
    if (!sessionValue) return { error: 'Não autorizado' };

    const payload = await decrypt(sessionValue);
    if (!payload) return { error: 'Sessão inválida' };

    const empresaId = payload.empresaId;

    const updateBody: any = {
        Id: empresaId,
        id: empresaId,
        nome_fantasia: onboardingData.nome,
    };

    if (onboardingData.nicho) {
        updateBody.nincho = onboardingData.nicho;
    }

    if (onboardingData.instancia_evolution) {
        updateBody.instancia_evolution = onboardingData.instancia_evolution;
    }

    console.log('=== updateOnboarding DEBUG ===');
    console.log('empresaId:', empresaId);
    console.log('onboardingData:', JSON.stringify(onboardingData));
    console.log('updateBody:', JSON.stringify(updateBody));

    const res = await nocoFetch('/records', {
        method: 'PATCH',
        body: JSON.stringify(updateBody)
    }, EMPRESAS_TABLE_ID);

    console.log('NocoDB response status:', res?.status);
    const resText = res ? await res.clone().text() : 'null';
    console.log('NocoDB response body:', resText);

    if (!res) return { error: 'Erro ao salvar configurações' };

        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const newSession = await encrypt({ ...payload, nome: onboardingData.nome, onboarded: true, controle_estoque: !!onboardingData.controle_estoque });
        const isProduction = process.env.NODE_ENV === 'production';
        (await cookies()).set('session', newSession, {
            expires,
            httpOnly: true,
            secure: isProduction,
            sameSite: 'strict',
            path: '/',
        });

    return { success: true };
}

export async function logout() {
    (await cookies()).set('session', '', { expires: new Date(0) });
}

export async function getMe() {
    const sessionValue = (await cookies()).get('session')?.value;
    if (!sessionValue) return null;
    return await decrypt(sessionValue);
}
