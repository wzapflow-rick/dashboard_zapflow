'use server';

import { getMe } from './auth';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const TABLE_ID = 'mui7bozvx9zb2n9'; // pedidos
const CLIENTS_TABLE_ID = 'mkodxks6hpm2bg9'; // clientes

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
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API Error: ${res.status} - ${text}`);
    }
    return res.json();
}

export async function getSalesReport(startDate: string, endDate: string) {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');

    // Buscar todos os pedidos finalizados no período e filtrar via JavaScript
    const ordersRes = await nocoFetch(TABLE_ID, 
        `/records?where=(empresa_id,eq,${user.empresaId})~and(status,eq,finalizado)&limit=10000`
    );
    
    const allOrders = ordersRes.list || [];
    
    // Filtrar por data no JavaScript (mais simples que lidar com NocoDB date)
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const orders = allOrders.filter((o: any) => {
        if (!o.criado_em) return false;
        const orderDate = new Date(o.criado_em);
        return orderDate >= start && orderDate <= end;
    });
    
    // Calcular métricas
    const totalVendas = orders.reduce((sum: number, o: any) => sum + Number(o.valor_total || 0), 0);
    const totalDescontos = orders.reduce((sum: number, o: any) => sum + Number(o.desconto || 0), 0);
    const totalTaxasEntrega = orders.reduce((sum: number, o: any) => sum + Number(o.taxa_entrega || 0), 0);
    const pedidoMaisCaro = orders.reduce((max: any, o: any) => {
        if (!max || Number(o.valor_total) > Number(max.valor_total)) return o;
        return max;
    }, null);
    
    // Contagem por status
    const statusCounts: Record<string, number> = {};
    const pagamentos: Record<string, number> = {};
    const entregas: Record<string, number> = { delivery: 0, retirada: 0 };
    
    orders.forEach((o: any) => {
        statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
        pagamentos[o.forma_pagamento] = (pagamentos[o.forma_pagamento] || 0) + Number(o.valor_total || 0);
        if (o.tipo_entrega === 'retirada') {
            entregas.retirada++;
        } else {
            entregas.delivery++;
        }
    });

    // Vendas por dia
    const vendasPorDia: Record<string, number> = {};
    orders.forEach((o: any) => {
        const dia = o.criado_em?.split(' ')[0] || 'unknown';
        vendasPorDia[dia] = (vendasPorDia[dia] || 0) + Number(o.valor_total || 0);
    });

    // Top produtos
    const produtosCount: Record<string, number> = {};
    orders.forEach((o: any) => {
        if (Array.isArray(o.itens)) {
            o.itens.forEach((item: any) => {
                const nome = item.produto || item.nome || 'Item';
                const nomeLimpo = nome.split('(')[0].trim();
                produtosCount[nomeLimpo] = (produtosCount[nomeLimpo] || 0) + (item.quantidade || 1);
            });
        }
    });
    
    const topProdutos = Object.entries(produtosCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([nome, qtd]) => ({ nome, qtd }));

    // Média por pedido
    const mediaPorPedido = orders.length > 0 ? totalVendas / orders.length : 0;

    return {
        periodo: { inicio: startDate, fim: endDate },
        totalVendas,
        totalDescontos,
        totalTaxasEntrega,
        quantidadePedidos: orders.length,
        mediaPorPedido,
        pedidoMaisCaro: pedidoMaisCaro ? {
            id: pedidoMaisCaro.id,
            valor: pedidoMaisCaro.valor_total,
            cliente: pedidoMaisCaro.cliente_nome || 'Cliente',
            data: pedidoMaisCaro.criado_em
        } : null,
        statusCounts,
        pagamentos,
        entregas,
        vendasPorDia,
        topProdutos
    };
}

export async function getMonthlyComparison() {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');

    // Buscar todos os pedidos finalizados e filtrar via JavaScript
    const ordersRes = await nocoFetch(TABLE_ID, 
        `/records?where=(empresa_id,eq,${user.empresaId})~and(status,eq,finalizado)&limit=10000`
    );
    
    const allOrders = ordersRes.list || [];
    
    const now = new Date();
    const meses: { inicio: Date; fim: Date; nome: string }[] = [];
    
    for (let i = 5; i >= 0; i--) {
        const inicio = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const fim = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        const nome = inicio.toLocaleDateString('pt-BR', { month: 'short' });
        meses.push({ inicio, fim, nome });
    }

    const results = meses.map((m) => {
        const filtered = allOrders.filter((o: any) => {
            if (!o.criado_em) return false;
            const orderDate = new Date(o.criado_em);
            return orderDate >= m.inicio && orderDate <= m.fim;
        });
        const total = filtered.reduce((sum: number, o: any) => sum + Number(o.valor_total || 0), 0);
        const qtd = filtered.length;
        return { mes: m.nome, total, qtd };
    });

    return results;
}
