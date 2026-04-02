'use server';

import { getMe } from './auth';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const TABLE_ID = 'm2ic8zof3feve3l'; // pedidos

async function nocoFetch(endpoint: string, options: RequestInit = {}) {
    const url = `${NOCODB_URL}/api/v2/tables/${TABLE_ID}${endpoint}`;

    const res = await fetch(url, {
        ...options,
        headers: {
            'xc-token': NOCODB_TOKEN,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
        cache: 'no-store', // ensures we get real-time latest data
    });

    if (!res.ok) {
        throw new Error(`NocoDB API Error: ${res.status}`);
    }

    return res;
}

export async function getNotifications() {
    try {
        const user = await getMe();
        if (!user?.empresaId) {
            return { notifications: [], newCount: 0 };
        }

        // Fetch the 10 most recent orders for the company
        const whereClause = `(empresa_id,eq,${user.empresaId})`;
        const res = await nocoFetch(`/records?limit=10&where=${encodeURIComponent(whereClause)}&sort=-id`);
        const data = await res.json();
        const orders = data.list || [];

        const notifications = orders.map((order: any) => {
            const date = new Date(order.criado_em || Date.now());
            const diffMs = Date.now() - date.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            let timeString = '';
            if (diffDays > 0) timeString = `Há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
            else if (diffHours > 0) timeString = `Há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
            else if (diffMins > 0) timeString = `Há ${diffMins} min`;
            else timeString = 'Agora mesmo';

            const baseNotif = {
                id: order.id,
                time: timeString,
                status: order.status
            };

            const customerName = order.cliente_nome ? order.cliente_nome.split(' ')[0] : 'Cliente';

            if (order.status === 'pendente') {
                return {
                    ...baseNotif,
                    title: 'Novo pedido recebido',
                    desc: `Pedido #${order.id} - ${customerName}`,
                    color: 'text-blue-500 bg-blue-50',
                    iconType: 'truck'
                };
            } else if (order.status === 'pagamento_pendente') {
                return {
                    ...baseNotif,
                    title: 'Aguardando Pagamento',
                    desc: `Pedido #${order.id} - ${customerName}`,
                    color: 'text-orange-500 bg-orange-50',
                    iconType: 'truck'
                };
            } else if (order.status === 'preparando' || order.status === 'saiu_para_entrega') {
                return {
                    ...baseNotif,
                    title: 'Pedido em andamento',
                    desc: `Pedido #${order.id} - ${customerName}`,
                    color: 'text-amber-500 bg-amber-50',
                    iconType: 'utensils'
                };
            } else if (order.status === 'finalizado') {
                return {
                    ...baseNotif,
                    title: 'Pedido finalizado',
                    desc: `Pedido #${order.id} - ${customerName}`,
                    color: 'text-emerald-500 bg-emerald-50',
                    iconType: 'creditcard'
                };
            } else {
                return {
                    ...baseNotif,
                    title: 'Pedido cancelado',
                    desc: `Pedido #${order.id} - ${customerName}`,
                    color: 'text-red-500 bg-red-50',
                    iconType: 'cancel'
                };
            }
        });

        // "Novas" count will be the number of recent pending orders
        const newCount = notifications.filter((n: any) => n.status === 'pendente').length;

        return { notifications, newCount };
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return { notifications: [], newCount: 0 };
    }
}
