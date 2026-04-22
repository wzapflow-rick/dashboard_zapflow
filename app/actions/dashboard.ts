'use server';

import { getMe } from '@/lib/session-server';
import { noco } from '@/lib/nocodb';
import { PEDIDOS_TABLE_ID } from '@/lib/constants';

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
            startDate = new Date(1970, 0, 1);
        }

        console.log(`[Dashboard] Period: ${period}, StartDate: ${startDate.toISOString()}`);

        const data = await noco.list(PEDIDOS_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})`,
            sort: '-id',
            limit: 1000,
        });
        const allOrders = data.list || [];

        // Filtrar por data em memória (evita problemas de parsing de datas no NocoDB)
        const orders = allOrders.filter((o: any) => o.criado_em && new Date(o.criado_em) >= startDate);

        // 1. Calcular faturamento e contagem (Excluindo cancelados)
        const validOrders = orders.filter((o: any) => o.status !== 'cancelado');
        const finalizedOrders = validOrders.filter((o: any) => o.status === 'finalizado');
        
        // Faturamento apenas de pedidos finalizados (que deram certo)
        const totalRevenue = finalizedOrders.reduce((sum: number, o: any) => sum + Number(o.valor_total || 0), 0);
        
        // Total de pedidos válidos (exclui cancelados para o cálculo do ticket médio)
        const totalValidOrdersCount = validOrders.length;
        
        // Ticket médio baseado no faturamento real dividido pelos pedidos que não foram cancelados
        const averageTicket = totalValidOrdersCount > 0 ? totalRevenue / totalValidOrdersCount : 0;

        // 2. Top produtos
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
                // Ignorar erros de parsing
            }

            items.forEach((item: any) => {
                const name = item.produto || 'Item';
                const current = productStats.get(name) || { name, sales: 0, price: Number(item.preco || 0) };
                current.sales += Number(item.quantidade || 1);
                productStats.set(name, current);
            });
        });

        // Buscar imagens reais dos produtos para o Top 5
        const { PRODUTOS_TABLE_ID } = await import('@/lib/constants');
        const productsData = await noco.list(PRODUTOS_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})`,
            limit: 100,
        });
        const realProducts = productsData.list || [];

        const topProducts = Array.from(productStats.values())
            .sort((a, b) => b.sales - a.sales)
            .slice(0, 5)
            .map(p => {
                // Tenta encontrar o produto real pelo nome (removendo o sufixo de tamanho se houver)
                const baseName = p.name.split(' (')[0].split(' - ')[0];
                const realProduct = realProducts.find((rp: any) => 
                    rp.nome === p.name || rp.nome === baseName
                );
                
                return {
                    name: p.name,
                    sales: p.sales,
                    price: `R$ ${p.price.toFixed(2).replace('.', ',')}`,
                    image: realProduct?.imagem || realProduct?.imagem_url || `https://picsum.photos/seed/${encodeURIComponent(p.name)}/100/100`
                };
            });

        // 3. Vendas por hora (UTC-3 Brasília)
        const salesByHour = new Array(24).fill(0);
        orders.forEach((order: any) => {
            const date = new Date(order.criado_em);
            const brasiliaHour = (date.getUTCHours() - 3 + 24) % 24;
            salesByHour[brasiliaHour]++;
        });

        return {
            stats: [
                { label: 'Faturamento Bruto', value: `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, change: 'Real-time', trend: 'up', color: 'blue' },
                { label: 'Total de Pedidos', value: totalValidOrdersCount.toString(), change: 'Real-time', trend: 'up', color: 'indigo' },
                { label: 'Ticket Médio', value: `R$ ${averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, change: 'Real-time', trend: 'neutral', color: 'slate' },
                { label: 'Pedidos Pendentes', value: orders.filter((o: any) => o.status === 'pendente').length.toString(), change: 'Ação necessária', trend: 'special', color: 'primary' },
            ],
            topProducts,
            chartData: salesByHour,
            rawOrders: orders.slice(0, 5)
        };
    } catch (error: any) {
        console.error('API Error (getDashboardData):', error.message);
        throw error;
    }
}
