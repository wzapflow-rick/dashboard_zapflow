'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from './auth';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const TABLE_ID = 'mfpwzmya0e4ej1k'; // clientes-clientes

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

        // 3. Mapear pedidos por telefone
        const ordersByPhone = new Map();
        allOrders.forEach((order: any) => {
            const phone = order.telefone_cliente;
            if (!ordersByPhone.has(phone)) ordersByPhone.set(phone, []);
            ordersByPhone.get(phone).push(order);
        });

        // 4. Enriquecer clientes com dados reais
        return clients.map((client: any) => {
            const history = ordersByPhone.get(client.telefone) || [];
            const totalSpent = history.reduce((sum: number, o: any) => sum + Number(o.valor_total || 0), 0);

            return {
                ...client,
                qtd_pedidos: history.length,
                valor_total_gasto: totalSpent,
                // Garantir campos para o frontend
                nome: client.nome || 'Sem Nome',
                telefone: client.telefone || 'N/A'
            };
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

        const { telefone, nome, bairro_entrega, endereco_completo } = customerData;

        // 1. Verificar se o cliente já existe para esta empresa
        // Usando 'empresas' conforme visto no print do usuário
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
                    endereco: endereco_completo || existingCustomer.endereco // Mudado para 'endereco'
                })
            });
        } else {
            // 3. Criar se não existir (POST)
            await nocoFetch('/records', {
                method: 'POST',
                body: JSON.stringify({
                    empresas: user.empresaId, // Mudado de 'empresa_id' para 'empresas'
                    nome: nome || 'Cliente sem nome',
                    telefone,
                    bairro_entrega,
                    endereco: endereco_completo || '' // Mudado para 'endereco'
                })
            });
        }

        revalidatePath('/dashboard/customers');
        revalidatePath('/dashboard/expedition');

        return { success: true };
    } catch (error) {
        console.error('API Error (upsertCustomer):', error);
        throw new Error('Falha ao processar registro do cliente');
    }
}
