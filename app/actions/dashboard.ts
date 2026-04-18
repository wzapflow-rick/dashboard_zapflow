'use server';

import { getMe } from './auth';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const TABLE_ID = 'mui7bozvx9zb2n9'; // pedidos

async function nocoFetch(endpoint: string, options: RequestInit = {}) {
    const url = `${NOCODB_URL}/api/v2/tables/${TABLE_ID}${endpoint}`;
    console.log(`[Dashboard] Fetching: ${url}`);

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
        console.error(`NocoDB Error (Dashboard): ${res.status} ${text}`);
        throw new Error(`NocoDB API Error: ${res.status} ${text}`);
    }

    return res;
}

export async function getDashboardData(period: string = 'Hoje') {
    try {
        const user = await getMe();
        if (!user?.empresaId) {
            console.error('[Dashboard] User not found or no empresaId');
            throw new Error('Não autorizado');
        }

        const now = new Date();
        let startDate = new Date();

        if (period === 'Hoje') {
            startDate.setHours(0, 0, 0, 0);
        } else if (period === 'Últimos 7 dias') {
            startDate.setDate(now.getDate() - 7);
            startDate.setHours(0, 0, 0, 0);
        } else if (period === 'Este Mês') {
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);
        } else {
            startDate = new Date(1970, 0, 1); // Start of time
        }

        const isoStartDate = startDate.toISOString();
        console.log(`[Dashboard] Period: ${period}, StartDate: ${isoStartDate}`);

        // Build the where clause (only by empresa_id to avoid NocoDB date parsing issues)
        const whereClause = `(empresa_id,eq,${user.empresaId})`;

        // Fetch orders for the company (up to 1000)
        const res = await nocoFetch(`/records?limit=1000&where=${encodeURIComponent(whereClause)}&sort=-id`);
        const data = await res.json();
        const allOrders = data.list || [];

        // Filter orders by date in memory
        const orders = allOrders.filter((o: any) => o.criado_em && new Date(o.criado_em) >= startDate);

        // 1. Calculate Revenue and Order Count
        const finalizedOrders = orders.filter((o: any) => o.status === 'finalizado');
        const totalRevenue = finalizedOrders.reduce((sum: number, o: any) => sum + Number(o.valor_total || 0), 0);
        const totalOrders = orders.length;
        const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        // 2. Aggregate Top Products
        const productStats = new Map();
        orders.forEach((order: any) => {
            let items = [];
            try {
                if (typeof order.itens === 'string') {
                    items = JSON.parse(order.itens);
                } else if (Array.isArray(order.itens)) {
                    items = order.itens;
                }
            } catch (e) {
                // Ignore parsing errors for individual orders
            }

            items.forEach((item: any) => {
                const name = item.produto || 'Item';
                const current = productStats.get(name) || { name, sales: 0, price: Number(item.preco || 0) };
                current.sales += Number(item.quantidade || 1);
                productStats.set(name, current);
            });
        });

        const topProducts = Array.from(productStats.values())
            .sort((a, b) => b.sales - a.sales)
            .slice(0, 5)
            .map(p => ({
                name: p.name,
                sales: p.sales,
                price: `R$ ${p.price.toFixed(2).replace('.', ',')}`,
                image: `https://picsum.photos/seed/${encodeURIComponent(p.name)}/100/100`
            }));

        // 3. Sales By Hour — all 24h, converting UTC to Brasília (UTC-3)
        const salesByHour = new Array(24).fill(0);
        orders.forEach((order: any) => {
            const date = new Date(order.criado_em);
            // Convert UTC to Brasília (UTC-3)
            const brasiliaHour = (date.getUTCHours() - 3 + 24) % 24;
            salesByHour[brasiliaHour]++;
        });

        return {
            stats: [
                { label: 'Faturamento Bruto', value: `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, change: 'Real-time', trend: 'up', color: 'blue' },
                { label: 'Total de Pedidos', value: totalOrders.toString(), change: 'Real-time', trend: 'up', color: 'indigo' },
                { label: 'Ticket Médio', value: `R$ ${averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, change: 'Real-time', trend: 'neutral', color: 'slate' },
                { label: 'Pedidos Pendentes', value: orders.filter((o: any) => o.status === 'pendente').length.toString(), change: 'Ação necessária', trend: 'special', color: 'primary' },
            ],
            topProducts,
            chartData: salesByHour,
            rawOrders: orders.slice(0, 5) // Recent orders
        };
    } catch (error: any) {
        console.error('API Error (getDashboardData):', error.message);
        throw error;
    }
}
