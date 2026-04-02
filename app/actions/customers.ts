'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from './auth';
import { CustomerUpsertSchema } from '@/lib/validations';
import { logAction } from '@/lib/audit';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const TABLE_ID = 'mfpwzmya0e4ej1k'; // clientes-clientes
const LOYALTY_TABLE_ID = 'm7fg9pyp2odct7m'; // loyalty_points

// Rate limiting para upsert de clientes
const customerUpsertAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_CUSTOMER_ATTEMPTS = 10;
const CUSTOMER_WINDOW_MS = 60 * 1000; // 1 minuto

async function nocoFetch(endpoint: string, options: RequestInit = {}) {
    const url = `${NOCODB_URL}/api/v2/tables/${TABLE_ID}${endpoint}`;
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
        console.error(`NocoDB Error (Customers): ${res.status} ${text}`);
        throw new Error(`NocoDB API Error: ${res.status}`);
    }

    return res;
}

const ORDERS_TABLE_ID = 'm2ic8zof3feve3l'; // pedidos

export async function getCustomers() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        // 1. Buscar Clientes
        const clientsRes = await nocoFetch(`/records?limit=1000&where=(empresa_id,eq,${user.empresaId})&sort=-id`);
        const clientsData = await clientsRes.json();
        const clients = clientsData.list || [];

        // 2. Buscar Todos os Pedidos para calcular estatísticas reais
        const ordersRes = await fetch(`${NOCODB_URL}/api/v2/tables/${ORDERS_TABLE_ID}/records?limit=1000&where=(empresa_id,eq,${user.empresaId})`, {
            headers: { 'xc-token': NOCODB_TOKEN }
        });
        const ordersData = await ordersRes.json();
        const allOrders = ordersData.list || [];

        // 3. Buscar Pontos de Fidelidade
        const pointsRes = await fetch(`${NOCODB_URL}/api/v2/tables/${LOYALTY_TABLE_ID}/records?limit=1000&where=(empresa_id,eq,${user.empresaId})`, {
            headers: { 'xc-token': NOCODB_TOKEN }
        });
        const pointsData = await pointsRes.json();
        const pointsList = pointsData.list || [];

        // 4. Mapear pedidos por telefone (usando plain object em vez de Map)
        const ordersByPhone: Record<string, any[]> = {};
        allOrders.forEach((order: any) => {
            const phone = String(order.telefone_cliente || '');
            if (!ordersByPhone[phone]) ordersByPhone[phone] = [];
            ordersByPhone[phone].push(order);
        });

        // 5. Mapear pontos por telefone (usando plain object em vez de Map)
        const pointsByPhone: Record<string, number> = {};
        pointsList.forEach((p: any) => {
            const pontos = (p.pontos_acumulados || 0) - (p.pontos_gastos || 0);
            pointsByPhone[String(p.cliente_telefone || '')] = pontos;
        });

        // 6. Enriquecer clientes com dados reais e garantir serialização
        return clients.map((client: any) => {
            const phone = String(client.telefone || '');
            const history = ordersByPhone[phone] || [];
            const totalSpent = history.reduce((sum: number, o: any) => sum + Number(o.valor_total || 0), 0);
            const pontos = pointsByPhone[phone] || 0;

            return JSON.parse(JSON.stringify({
                id: client.id || client.Id,
                nome: client.nome || 'Sem Nome',
                telefone: phone || 'N/A',
                bairro_entrega: client.bairro_entrega || '',
                endereco_completo: client.endereco_completo || '',
                qtd_pedidos: history.length,
                valor_total_gasto: totalSpent,
                pontos_fidelidade: pontos,
                empresa_id: client.empresa_id,
                criado_em: client.criado_em || null,
            }));
        });
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to fetch customers with stats');
    }
}

export async function getCustomerHistory(phone: string) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const res = await fetch(`${NOCODB_URL}/api/v2/tables/${ORDERS_TABLE_ID}/records?limit=100&where=(empresa_id,eq,${user.empresaId})~and(telefone_cliente,eq,${phone})&sort=-id`, {
            headers: { 'xc-token': NOCODB_TOKEN }
        });
        const data = await res.json();
        return data.list || [];
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to fetch customer history');
    }
}

export async function upsertCustomer(customerData: any) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        // Validação com Zod
        const validated = CustomerUpsertSchema.safeParse(customerData);
        if (!validated.success) {
            const errorMsg = validated.error.issues.map((issue: any) => issue.message).join(', ');
            throw new Error(`Dados inválidos: ${errorMsg}`);
        }

        const { telefone, nome, bairro_entrega, endereco_completo } = validated.data;

        // Rate limiting por empresa
        const now = Date.now();
        const attemptKey = `${user.empresaId}:${telefone}`;
        const attempt = customerUpsertAttempts.get(attemptKey);
        
        if (attempt && attempt.count >= MAX_CUSTOMER_ATTEMPTS) {
            const timeSinceLast = now - attempt.lastAttempt;
            if (timeSinceLast < CUSTOMER_WINDOW_MS) {
                throw new Error('Muitas tentativas. Aguarde um momento.');
            } else {
                customerUpsertAttempts.delete(attemptKey);
            }
        }

        // 1. Verificar se o cliente já existe para esta empresa
        const checkRes = await nocoFetch(`/records?where=(empresas,eq,${user.empresaId})~and(telefone,eq,${telefone})`);
        const checkData = await checkRes.json();
        const existingCustomer = checkData.list?.[0];

        if (existingCustomer) {
            // 2. Atualizar se existir (PATCH)
            await nocoFetch('/records', {
                method: 'PATCH',
                body: JSON.stringify({
                    id: existingCustomer.id,
                    nome: nome || existingCustomer.nome,
                    bairro_entrega: bairro_entrega || existingCustomer.bairro_entrega,
                    endereco: endereco_completo || existingCustomer.endereco
                })
            });
            await logAction('UPDATE_CUSTOMER', `Cliente atualizado: ${telefone}`);
        } else {
            // 3. Criar se não existir (POST)
            await nocoFetch('/records', {
                method: 'POST',
                body: JSON.stringify({
                    empresas: user.empresaId,
                    nome: nome || 'Cliente sem nome',
                    telefone,
                    bairro_entrega,
                    endereco: endereco_completo || ''
                })
            });
            await logAction('CREATE_CUSTOMER', `Novo cliente cadastrado: ${telefone}`);
        }

        // Incrementar tentativas
        const currentAttempt = customerUpsertAttempts.get(attemptKey) || { count: 0, lastAttempt: now };
        currentAttempt.count += 1;
        currentAttempt.lastAttempt = now;
        customerUpsertAttempts.set(attemptKey, currentAttempt);

        revalidatePath('/dashboard/customers');
        revalidatePath('/dashboard/expedition');

        return { success: true };
    } catch (error: any) {
        console.error('API Error (upsertCustomer):', error);
        throw new Error(error.message || 'Falha ao processar registro do cliente');
    }
}
