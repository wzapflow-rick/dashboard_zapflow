'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from '@/lib/session-server';
import { CustomerUpsertSchema } from '@/lib/validations';
import { logAction } from '@/lib/audit';
import { pg } from '@/lib/postgres';
import { CLIENTES_TABLE, PEDIDOS_TABLE, LOYALTY_POINTS_TABLE } from '@/lib/tables';
import type { ClienteRow, Id, LoyaltyPointsRow, PedidoRow } from '@/lib/types/domain';
import { getErrorMessage } from '@/lib/errors';

export interface CustomerWithStats {
    id: number;
    nome: string;
    telefone: string;
    bairro_entrega: string;
    endereco_completo: string;
    qtd_pedidos: number;
    valor_total_gasto: number;
    pontos_fidelidade: number;
    empresa_id: Id;
    criado_em: string | null;
}

const customerUpsertAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_CUSTOMER_ATTEMPTS = 10;
const CUSTOMER_WINDOW_MS = 60 * 1000;

export async function getCustomers() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const [clientsData, ordersData, pointsData] = await Promise.all([
            pg.list<ClienteRow>(CLIENTES_TABLE, {
                where: { empresa_id: user.empresaId },
                sort: '-id',
                limit: 1000,
            }),
            pg.list<PedidoRow>(PEDIDOS_TABLE, {
                where: { empresa_id: user.empresaId },
                limit: 1000,
            }),
            pg.list<LoyaltyPointsRow>(LOYALTY_POINTS_TABLE, {
                where: { empresa_id: user.empresaId },
                limit: 1000,
            }),
        ]);

        const clients = clientsData.list || [];
        const allOrders = ordersData.list || [];
        const pointsList = pointsData.list || [];

        const ordersByPhone: Record<string, PedidoRow[]> = {};
        allOrders.forEach((order) => {
            const phone = String(order.telefone_cliente || '');
            if (!ordersByPhone[phone]) ordersByPhone[phone] = [];
            ordersByPhone[phone].push(order);
        });

        const pointsByPhone: Record<string, number> = {};
        pointsList.forEach((p) => {
            const pontos = Number(p.pontos_acumulados || 0) - Number(p.pontos_gastos || 0);
            pointsByPhone[String(p.cliente_telefone || '')] = pontos;
        });

        return clients.map((client): CustomerWithStats => {
            const phone = String(client.telefone || '');
            const history = ordersByPhone[phone] || [];
            const totalSpent = history.reduce((sum, o) => sum + Number(o.valor_total || 0), 0);
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
                criado_em: client.criado_em ? new Date(client.criado_em).toISOString() : null,
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

        const data = await pg.list<PedidoRow>(PEDIDOS_TABLE, {
            where: { empresa_id: user.empresaId, telefone_cliente: phone },
            sort: '-id',
            limit: 100,
        });
        return data.list || [];
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to fetch customer history');
    }
}

export async function upsertCustomer(customerData: unknown) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const validated = CustomerUpsertSchema.safeParse(customerData);
        if (!validated.success) {
            const errorMsg = validated.error.issues.map((issue) => issue.message).join(', ');
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

        const existingCustomer = await pg.findOne<ClienteRow>(CLIENTES_TABLE, {
            where: { empresa_id: user.empresaId, telefone },
        });

        if (existingCustomer) {
            await pg.update(CLIENTES_TABLE, {
                id: existingCustomer.id,
                nome: nome || existingCustomer.nome,
                bairro_entrega: bairro_entrega || existingCustomer.bairro_entrega,
                endereco: endereco_completo || existingCustomer.endereco
            });
            await logAction('UPDATE_CUSTOMER', `Cliente atualizado: ${telefone}`);
        } else {
            await pg.create(CLIENTES_TABLE, {
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
    } catch (error) {
        console.error('API Error (upsertCustomer):', error);
        throw new Error(getErrorMessage(error, 'Falha ao processar registro do cliente'));
    }
}
