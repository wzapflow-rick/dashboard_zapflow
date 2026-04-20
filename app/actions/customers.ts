'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from '@/lib/session-server';
import { CustomerUpsertSchema } from '@/lib/validations';
import { logAction } from '@/lib/audit';
import { noco } from '@/lib/nocodb';
import { CLIENTES_TABLE_ID, PEDIDOS_TABLE_ID, LOYALTY_POINTS_TABLE_ID } from '@/lib/constants';

const customerUpsertAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_CUSTOMER_ATTEMPTS = 10;
const CUSTOMER_WINDOW_MS = 60 * 1000;

export async function getCustomers() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const [clientsData, ordersData, pointsData] = await Promise.all([
            noco.list(CLIENTES_TABLE_ID, {
                where: `(empresa_id,eq,${user.empresaId})`,
                sort: '-id',
                limit: 1000,
            }),
            noco.list(PEDIDOS_TABLE_ID, {
                where: `(empresa_id,eq,${user.empresaId})`,
                limit: 1000,
            }),
            noco.list(LOYALTY_POINTS_TABLE_ID, {
                where: `(empresa_id,eq,${user.empresaId})`,
                limit: 1000,
            }),
        ]);

        const clients = clientsData.list || [];
        const allOrders = ordersData.list || [];
        const pointsList = pointsData.list || [];

        const ordersByPhone: Record<string, any[]> = {};
        allOrders.forEach((order: any) => {
            const phone = String(order.telefone_cliente || '');
            if (!ordersByPhone[phone]) ordersByPhone[phone] = [];
            ordersByPhone[phone].push(order);
        });

        const pointsByPhone: Record<string, number> = {};
        pointsList.forEach((p: any) => {
            const pontos = (p.pontos_acumulados || 0) - (p.pontos_gastos || 0);
            pointsByPhone[String(p.cliente_telefone || '')] = pontos;
        });

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

        const data = await noco.list(PEDIDOS_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})~and(telefone_cliente,eq,${phone})`,
            sort: '-id',
            limit: 100,
        });
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

        const validated = CustomerUpsertSchema.safeParse(customerData);
        if (!validated.success) {
            const errorMsg = validated.error.issues.map((issue: any) => issue.message).join(', ');
            throw new Error(`Dados inválidos: ${errorMsg}`);
        }

        const { telefone, nome, bairro_entrega, endereco_completo } = validated.data;

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

        const existingCustomer = await noco.findOne(CLIENTES_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})~and(telefone,eq,${telefone})`,
        }) as any;

        if (existingCustomer) {
            await noco.update(CLIENTES_TABLE_ID, {
                id: existingCustomer.id,
                nome: nome || existingCustomer.nome,
                bairro_entrega: bairro_entrega || existingCustomer.bairro_entrega,
                endereco: endereco_completo || existingCustomer.endereco
            });
            await logAction('UPDATE_CUSTOMER', `Cliente atualizado: ${telefone}`);
        } else {
            await noco.create(CLIENTES_TABLE_ID, {
                empresa_id: user.empresaId,
                nome: nome || 'Cliente sem nome',
                telefone,
                bairro_entrega,
                endereco: endereco_completo || ''
            });
            await logAction('CREATE_CUSTOMER', `Novo cliente cadastrado: ${telefone}`);
        }

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
