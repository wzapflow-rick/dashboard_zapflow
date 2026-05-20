'use server';

import { getMe } from '@/lib/session-server';
import { query } from '@/lib/db';

// Helper para timeout em queries
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout: ${label} demorou mais de ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]);
}

export async function getDashboardData(period: string = 'Hoje') {
    const startTime = Date.now();
    try {
        console.log(`[Dashboard] Iniciando carregamento...`);
        
        const user = await withTimeout(getMe(), 5000, 'getMe');
        console.log(`[Dashboard] Usuario carregado em ${Date.now() - startTime}ms`);
        
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

        console.log(`[Dashboard] Period: ${period}, EmpresaId: ${user.empresaId}`);

        // Buscar pedidos do PostgreSQL
        const ordersResult = await withTimeout(
            query(
                `SELECT id, status, valor_total, criado_em, itens 
                 FROM pedidos 
                 WHERE empresa_id = $1 AND criado_em >= $2
                 ORDER BY id DESC 
                 LIMIT 200`,
                [user.empresaId, startDate.toISOString()]
            ),
            10000,
            'listar pedidos'
        );
        console.log(`[Dashboard] Pedidos carregados em ${Date.now() - startTime}ms`);
        
        const orders = ordersResult.rows || [];
        console.log(`[Dashboard] Total de pedidos encontrados: ${orders.length}`);

        // 1. Calcular faturamento e contagem (Excluindo cancelados)
        const validOrders = orders.filter((o: any) => o.status !== 'cancelado');
        const finalizedOrders = validOrders.filter((o: any) => o.status === 'finalizado');
        
        // Faturamento apenas de pedidos finalizados (que deram certo)
        const totalRevenue = finalizedOrders.reduce((sum: number, o: any) => sum + Number(o.valor_total || 0), 0);
        
        // Total de pedidos válidos (exclui cancelados para o cálculo do ticket médio)
        const totalValidOrdersCount = validOrders.length;
        
        // Ticket médio baseado no faturamento real dividido pelos pedidos que não foram cancelados
        const averageTicket = totalValidOrdersCount > 0 ? totalRevenue / totalValidOrdersCount : 0;

        // 2. Top produtos (Apenas de pedidos válidos/não cancelados)
        const productStats = new Map();
        validOrders.forEach((order: any) => {
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
                const name = item.produto || item.nome || 'Item';
                // Limpar o nome para agrupar (ex: "Pizza (Grande)" -> "Pizza")
                const cleanName = name.split(' (')[0].trim();
                
                const current = productStats.get(cleanName) || { 
                    name: cleanName, 
                    sales: 0, 
                    price: Number(item.preco || 0) 
                };
                current.sales += Number(item.quantidade || 1);
                productStats.set(cleanName, current);
            });
        });

        console.log(`[Dashboard] Stats calculadas em ${Date.now() - startTime}ms`);

        // Buscar imagens reais dos produtos
        let realProducts: any[] = [];
        try {
            const productsResult = await withTimeout(
                query(
                    `SELECT id, nome, imagem, imagem_url 
                     FROM produtos 
                     WHERE empresa_id = $1 
                     LIMIT 50`,
                    [user.empresaId]
                ),
                5000,
                'listar produtos'
            );
            realProducts = productsResult.rows || [];
            console.log(`[Dashboard] Produtos carregados em ${Date.now() - startTime}ms`);
        } catch (prodErr) {
            console.warn(`[Dashboard] Falha ao carregar produtos: ${prodErr}`);
            // Continua sem imagens dos produtos
        }

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

        const data = {
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
        
        console.log(`[Dashboard] Carregamento completo em ${Date.now() - startTime}ms`);
        return data;
    } catch (error: any) {
        console.error(`[Dashboard] ERRO apos ${Date.now() - startTime}ms:`, error.message);
        throw error;
    }
}
