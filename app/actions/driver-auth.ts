'use server';

import { cookies } from 'next/headers';
import { encrypt, decrypt } from '@/lib/session';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const DRIVERS_TABLE_ID = 'mhevb5nu9nczggv';

async function nocoFetch(tableId: string, endpoint: string, options: RequestInit = {}) {
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
    return res;
}

// Login do entregador (email + senha simples)
export async function driverLogin(email: string, password: string) {
    try {
        // Buscar entregador por email (senha é o telefone por segurança)
        const res = await nocoFetch(DRIVERS_TABLE_ID, 
            `/records?where=(email,eq,${email})~and(ativo,eq,true)`);
        const data = await res.json();
        const driver = data.list?.[0];

        if (!driver) {
            return { success: false, error: 'Entregador não encontrado' };
        }

        // Verificar senha (por enquanto usa telefone como senha)
        // TODO: Implementar senha própria no futuro
        const cleanPassword = password.replace(/\D/g, '');
        const cleanPhone = (driver.telefone || '').replace(/\D/g, '');
        
        if (cleanPassword !== cleanPhone) {
            return { success: false, error: 'Senha incorreta' };
        }

        // Criar sessão
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
            maxAge: 60 * 60 * 8, // 8 horas
        });

        // Marcar como disponível
        await nocoFetch(DRIVERS_TABLE_ID, '/records', {
            method: 'PATCH',
            body: JSON.stringify({ id: driver.id, Id: driver.id, status: 'disponivel' }),
        });

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

// Verificar sessão do entregador
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

// Logout do entregador
export async function driverLogout() {
    (await cookies()).delete('driver_session');
    
    // Marcar como offline
    const session = await getDriverSession();
    if (session?.driverId) {
        await nocoFetch(DRIVERS_TABLE_ID, '/records', {
            method: 'PATCH',
            body: JSON.stringify({ 
                id: session.driverId, 
                Id: session.driverId, 
                status: 'offline' 
            }),
        }).catch(() => {});
    }
    
    return { success: true };
}

// Buscar pedidos do entregador
export async function getDriverOrders(driverId: number) {
    try {
        const session = await getDriverSession();
        if (!session?.driverId || session.driverId !== driverId) {
            throw new Error('Acesso negado: Sessão inválida');
        }
        
        const ORDERS_TABLE_ID = 'm2ic8zof3feve3l';
        
        // Buscar pedidos atribuídos ao entregador
        const res = await nocoFetch(ORDERS_TABLE_ID, 
            `/records?where=(entregador_id,eq,${driverId})~and(status,neq,finalizado)~and(status,neq,cancelado)&sort=-id`);
        const data = await res.json();
        
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

// Atualizar status do pedido pelo entregador
export async function updateOrderStatusByDriver(orderId: number, newStatus: string) {
    try {
        const session = await getDriverSession();
        if (!session?.driverId) {
            throw new Error('Não autorizado');
        }
        
        const ORDERS_TABLE_ID = 'm2ic8zof3feve3l';
        
        // SECURE: Verify order belongs to this driver before updating
        const checkRes = await nocoFetch(ORDERS_TABLE_ID, `/records/${orderId}`);
        const order = await checkRes.json();
        
        if (!order || Number(order.entregador_id) !== Number(session.driverId)) {
            throw new Error('Acesso negado: Pedido não pertence a este entregador');
        }
        
        const res = await nocoFetch(ORDERS_TABLE_ID, '/records', {
            method: 'PATCH',
            body: JSON.stringify({ id: orderId, Id: orderId, status: newStatus }),
        });

        // Se finalizou, incrementar entregas do dia
        if (newStatus === 'finalizado') {
            // Buscar entregador atual
            const driverRes = await nocoFetch(DRIVERS_TABLE_ID, `/records/${session.driverId}`);
            const driver = await driverRes.json();
            
            await nocoFetch(DRIVERS_TABLE_ID, '/records', {
                method: 'PATCH',
                body: JSON.stringify({ 
                    id: session.driverId, 
                    Id: session.driverId, 
                    entregas_hoje: (driver.entregas_hoje || 0) + 1 
                }),
            });
        }

        return { success: true };
    } catch (error: any) {
        console.error('Erro ao atualizar pedido:', error);
        return { success: false, error: error.message || 'Erro ao atualizar' };
    }
}
