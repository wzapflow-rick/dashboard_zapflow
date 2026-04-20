'use server';

import { getMe } from '@/lib/session-server';
import { noco } from '@/lib/nocodb';
import { PEDIDOS_TABLE_ID } from '@/lib/constants';

export async function getNotifications() {
    try {
        const user = await getMe();
        if (!user?.empresaId) {
            return { notifications: [], newCount: 0 };
        }

        const data = await noco.list(PEDIDOS_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})`,
            sort: '-id',
            limit: 10,
        });
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

            const baseNotif = { id: order.id, time: timeString, status: order.status };
            const customerName = order.cliente_nome ? order.cliente_nome.split(' ')[0] : 'Cliente';

            if (order.status === 'pendente') {
                return { ...baseNotif, title: 'Novo pedido recebido', desc: `Pedido #${order.id} - ${customerName}`, color: 'text-blue-500 bg-blue-50', iconType: 'truck' };
            } else if (order.status === 'pagamento_pendente') {
                return { ...baseNotif, title: 'Aguardando Pagamento', desc: `Pedido #${order.id} - ${customerName}`, color: 'text-orange-500 bg-orange-50', iconType: 'truck' };
            } else if (order.status === 'preparando' || order.status === 'saiu_para_entrega') {
                return { ...baseNotif, title: 'Pedido em andamento', desc: `Pedido #${order.id} - ${customerName}`, color: 'text-amber-500 bg-amber-50', iconType: 'utensils' };
            } else if (order.status === 'finalizado') {
                return { ...baseNotif, title: 'Pedido finalizado', desc: `Pedido #${order.id} - ${customerName}`, color: 'text-emerald-500 bg-emerald-50', iconType: 'creditcard' };
            } else {
                return { ...baseNotif, title: 'Pedido cancelado', desc: `Pedido #${order.id} - ${customerName}`, color: 'text-red-500 bg-red-50', iconType: 'cancel' };
            }
        });

        const newCount = notifications.filter((n: any) => n.status === 'pendente').length;
        return { notifications, newCount };
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return { notifications: [], newCount: 0 };
    }
}
