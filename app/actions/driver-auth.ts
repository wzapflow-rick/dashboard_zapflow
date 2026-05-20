'use server';

import { cookies } from 'next/headers';
import { encrypt, decrypt } from '@/lib/session';
import { query } from '@/lib/db';

export async function driverLogin(email: string, password: string) {
    try {
        const result = await query(
            `SELECT * FROM entregadores WHERE email = $1 AND ativo = true LIMIT 1`,
            [email]
        );
        const driver = result.rows[0];

        if (!driver) {
            return { success: false, error: 'Entregador não encontrado' };
        }

        const cleanPassword = password.replace(/\D/g, '');
        const cleanPhone = (driver.telefone || '').replace(/\D/g, '');

        if (cleanPassword !== cleanPhone) {
            return { success: false, error: 'Senha incorreta' };
        }

        const session = await encrypt({
            driverId: driver.id,
            driverName: driver.nome,
            driverEmail: driver.email,
            type: 'driver'
        });

        const isProduction = process.env.NODE_ENV === 'production';
        (await cookies()).set('driver_session', session, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60 * 8,
        });

        await query(
            `UPDATE entregadores SET status = 'disponivel' WHERE id = $1`,
            [driver.id]
        );

        return {
            success: true,
            driver: {
                id: driver.id,
                nome: driver.nome,
                email: driver.email,
                veiculo: driver.veiculo
            }
        };
    } catch (error) {
        console.error('Erro no login do entregador:', error);
        return { success: false, error: 'Erro interno' };
    }
}

export async function getDriverSession() {
    try {
        const cookie = (await cookies()).get('driver_session');
        if (!cookie?.value) return null;

        const session = await decrypt(cookie.value);
        if (!session || session.type !== 'driver') return null;

        return {
            driverId: session.driverId,
            driverName: session.driverName,
            driverEmail: session.driverEmail
        };
    } catch (error) {
        return null;
    }
}

export async function driverLogout() {
    const session = await getDriverSession();

    (await cookies()).delete('driver_session');

    if (session?.driverId) {
        await query(
            `UPDATE entregadores SET status = 'offline' WHERE id = $1`,
            [session.driverId]
        ).catch(() => {});
    }

    return { success: true };
}

export async function getDriverOrders(driverId: number) {
    try {
        const session = await getDriverSession();
        if (!session?.driverId || session.driverId !== driverId) {
            throw new Error('Acesso negado: Sessão inválida');
        }

        const result = await query(
            `SELECT * FROM pedidos WHERE entregador_id = $1 AND status NOT IN ('finalizado', 'cancelado') ORDER BY id DESC`,
            [driverId]
        );

        return (result.rows || []).map((order: any) => ({
            id: order.id,
            cliente_nome: order.cliente_nome,
            telefone_cliente: order.telefone_cliente,
            endereco_entrega: order.endereco_entrega,
            bairro_entrega: order.bairro_entrega,
            valor_total: order.valor_total,
            taxa_entrega: order.taxa_entrega,
            status: order.status,
            tipo_entrega: order.tipo_entrega,
            criado_em: order.criado_em,
            itens: order.itens,
            observacoes: order.observacoes
        }));
    } catch (error) {
        console.error('Erro ao buscar pedidos do entregador:', error);
        return [];
    }
}

export async function updateOrderStatusByDriver(orderId: number, newStatus: string) {
    try {
        const session = await getDriverSession();
        if (!session?.driverId) {
            throw new Error('Não autorizado');
        }

        const orderResult = await query(
            `SELECT * FROM pedidos WHERE id = $1`,
            [orderId]
        );
        const order = orderResult.rows[0];

        if (!order || Number(order.entregador_id) !== Number(session.driverId)) {
            throw new Error('Acesso negado: Pedido não pertence a este entregador');
        }

        await query(
            `UPDATE pedidos SET status = $1 WHERE id = $2`,
            [newStatus, orderId]
        );

        if (newStatus === 'finalizado') {
            const driverResult = await query(
                `SELECT * FROM entregadores WHERE id = $1`,
                [session.driverId]
            );
            const driver = driverResult.rows[0];
            
            await query(
                `UPDATE entregadores SET entregas_hoje = $1 WHERE id = $2`,
                [(driver?.entregas_hoje || 0) + 1, session.driverId]
            );
        }

        return { success: true };
    } catch (error: any) {
        console.error('Erro ao atualizar pedido:', error);
        return { success: false, error: error.message || 'Erro ao atualizar' };
    }
}
