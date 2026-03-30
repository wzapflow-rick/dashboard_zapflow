'use server';

import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { encrypt, decrypt } from '@/lib/session';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const EMPRESAS_TABLE_ID = process.env.EMPRESAS_TABLE_ID || 'mrlxbm1guwn9iv8';

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

        // Buscamos por Email OU Login na tabela EMPRESAS
        const filter = `(email,eq,${email})~or(login,eq,${email})`;
        const res = await nocoFetch(`/records?where=${filter}`, {}, EMPRESAS_TABLE_ID);

        if (!res) return { error: 'Empresa não encontrada' };

        const resData = await res.json();
        const empresa = resData.list?.[0];

        if (!empresa || (!bcrypt.compareSync(password, empresa.senha) && password !== empresa.password)) {
            // Delay anti-brute force
            await new Promise(resolve => setTimeout(resolve, 1000));
            return { error: 'E-mail ou senha inválidos' };
        }

        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const session = await encrypt({
            userId: empresa.id,
            email: empresa.email,
            empresaId: empresa.id,
            nome: empresa.nome_fantasia || empresa.nome_admin || 'Minha Loja',
            onboarded: !!empresa.nome_fantasia,
            controle_estoque: !!empresa.controle_estoque,
            role: 'admin'
        });

        (await cookies()).set('session', session, { expires, httpOnly: true, path: '/' });
        return { success: true };
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
            instancia_evolution: `zapflow_${Date.now()}`, // Placeholder único
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
    (await cookies()).set('session', session, { expires, httpOnly: true, path: '/' });

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
    (await cookies()).set('session', newSession, { expires, httpOnly: true, path: '/' });

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
