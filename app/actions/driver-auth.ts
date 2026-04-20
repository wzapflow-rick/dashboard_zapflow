'use server';

import { cookies } from 'next/headers';
import { encrypt, decrypt } from '@/lib/session';
import { noco } from '@/lib/nocodb';
import { ENTREGADORES_TABLE_ID, PEDIDOS_TABLE_ID } from '@/lib/constants';

export async function driverLogin(email: string, password: string) {
    try {
        const data = await noco.list(ENTREGADORES_TABLE_ID, {
            where: `(email,eq,${email})~and(ativo,eq,true)`,
        });
        const driver = data.list?.[0] as any;

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

        await noco.update(ENTREGADORES_TABLE_ID, { id: driver.id, status: 'disponivel' });

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
        await noco.update(ENTREGADORES_TABLE_ID, {
            id: session.driverId,
            status: 'offline'
        }).catch(() => {});
    }

    return { success: true };
}

export async function getDriverOrders(driverId: number) {
    try {
        const session = await getDriverSession();
        if (!session?.driverId || session.driverId !== driverId) {
            throw new Error('Acesso negado: Sessão inválida');
        }

        const data = await noco.list(PEDIDOS_TABLE_ID, {
            where: `(entregador_id,eq,${driverId})~and(status,neq,finalizado)~and(status,neq,cancelado)`,
            sort: '-id',
        });

        return (data.list || []).map((order: any) => ({
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

        const order = await noco.findById(PEDIDOS_TABLE_ID, orderId) as any;

        if (!order || Number(order.entregador_id) !== Number(session.driverId)) {
            throw new Error('Acesso negado: Pedido não pertence a este entregador');
        }

        await noco.update(PEDIDOS_TABLE_ID, { id: orderId, status: newStatus });

        if (newStatus === 'finalizado') {
            const driver = await noco.findById(ENTREGADORES_TABLE_ID, session.driverId) as any;
            await noco.update(ENTREGADORES_TABLE_ID, {
                id: session.driverId,
                entregas_hoje: (driver?.entregas_hoje || 0) + 1
            });
        }

        return { success: true };
    } catch (error: any) {
        console.error('Erro ao atualizar pedido:', error);
        return { success: false, error: error.message || 'Erro ao atualizar' };
    }
}
