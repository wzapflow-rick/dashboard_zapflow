'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from '@/lib/session-server';
import { CustomerUpsertSchema } from '@/lib/validations';
import { logAction } from '@/lib/audit';
import { query } from '@/lib/db';

const customerUpsertAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_CUSTOMER_ATTEMPTS = 10;
const CUSTOMER_WINDOW_MS = 60 * 1000;

export async function getCustomers() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const [clientsResult, ordersResult, pointsResult] = await Promise.all([
            query(
                `SELECT * FROM clientes WHERE empresa_id = $1 ORDER BY id DESC LIMIT 1000`,
                [user.empresaId]
            ),
            query(
                `SELECT * FROM pedidos WHERE empresa_id = $1 LIMIT 1000`,
                [user.empresaId]
            ),
            query(
                `SELECT * FROM loyalty_points WHERE empresa_id = $1 LIMIT 1000`,
                [user.empresaId]
            ),
        ]);

        const clients = clientsResult.rows || [];
        const allOrders = ordersResult.rows || [];
        const pointsList = pointsResult.rows || [];

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

            return {
                id: client.id,
                nome: client.nome || 'Sem Nome',
                telefone: phone || 'N/A',
                bairro_entrega: client.bairro_entrega || '',
                endereco_completo: client.endereco_completo || '',
                qtd_pedidos: history.length,
                valor_total_gasto: totalSpent,
                pontos_fidelidade: pontos,
                empresa_id: client.empresa_id,
                criado_em: client.criado_em || null,
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

        const result = await query(
            `SELECT * FROM pedidos WHERE empresa_id = $1 AND telefone_cliente = $2 ORDER BY id DESC LIMIT 100`,
            [user.empresaId, phone]
        );
        return result.rows || [];
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

        const existingResult = await query(
            `SELECT * FROM clientes WHERE empresa_id = $1 AND telefone = $2 LIMIT 1`,
            [user.empresaId, telefone]
        );
        const existingCustomer = existingResult.rows[0];

        if (existingCustomer) {
            await query(
                `UPDATE clientes SET nome = $1, bairro_entrega = $2, endereco = $3 WHERE id = $4`,
                [nome || existingCustomer.nome, bairro_entrega || existingCustomer.bairro_entrega, endereco_completo || existingCustomer.endereco, existingCustomer.id]
            );
            await logAction('UPDATE_CUSTOMER', `Cliente atualizado: ${telefone}`);
        } else {
            await query(
                `INSERT INTO clientes (empresa_id, nome, telefone, bairro_entrega, endereco)
                 VALUES ($1, $2, $3, $4, $5)`,
                [user.empresaId, nome || 'Cliente sem nome', telefone, bairro_entrega || '', endereco_completo || '']
            );
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
