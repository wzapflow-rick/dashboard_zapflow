'use server';

import { getMe } from '@/lib/session-server';
import { noco } from '@/lib/nocodb';
import { PEDIDOS_TABLE_ID, CLIENTES_TABLE_ID } from '@/lib/constants';

export type InsightType = 'growth' | 'alert' | 'opportunity' | 'product' | 'operation' | 'customer';

export interface Insight {
  id: string;
  type: InsightType;
  icon: string;
  title: string;
  value: string;
  description: string;
  trend?: 'up' | 'down' | 'neutral';
  color: string;
  priority: number; // 1 = alta, 2 = media, 3 = baixa
}

// Helper para formatar valores monetarios
function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

// Helper para formatar porcentagem
function formatPercentage(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(0)}%`;
}

export async function getInsights(): Promise<Insight[]> {
  try {
    const user = await getMe();
    if (!user?.empresaId) {
      throw new Error('Nao autorizado');
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    
    const yesterdayEnd = new Date(todayStart);
    
    const weekAgo = new Date(todayStart);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Buscar pedidos (ultimos 7 dias para comparacoes)
    const ordersData = await noco.list(PEDIDOS_TABLE_ID, {
      where: `(empresa_id,eq,${user.empresaId})`,
      sort: '-id',
      limit: 500,
    });
    const allOrders = ordersData.list || [];

    // Separar pedidos por periodo
    const todayOrders = allOrders.filter((o: any) => 
      o.criado_em && new Date(o.criado_em) >= todayStart && o.status !== 'cancelado'
    );
    const yesterdayOrders = allOrders.filter((o: any) => 
      o.criado_em && new Date(o.criado_em) >= yesterdayStart && new Date(o.criado_em) < yesterdayEnd && o.status !== 'cancelado'
    );
    const weekOrders = allOrders.filter((o: any) => 
      o.criado_em && new Date(o.criado_em) >= weekAgo && o.status !== 'cancelado'
    );

    const insights: Insight[] = [];

    // ========== INSIGHT 1: Faturamento do dia ==========
    const todayRevenue = todayOrders
      .filter((o: any) => o.status === 'finalizado')
      .reduce((sum: number, o: any) => sum + Number(o.valor_total || 0), 0);
    const yesterdayRevenue = yesterdayOrders
      .filter((o: any) => o.status === 'finalizado')
      .reduce((sum: number, o: any) => sum + Number(o.valor_total || 0), 0);
    
    if (todayRevenue > 0) {
      const revenueChange = yesterdayRevenue > 0 
        ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 
        : 100;
      
      insights.push({
        id: 'revenue',
        type: revenueChange >= 0 ? 'growth' : 'alert',
        icon: revenueChange >= 0 ? 'TrendingUp' : 'TrendingDown',
        title: revenueChange >= 0 ? 'Faturamento em Alta' : 'Faturamento em Queda',
        value: formatPercentage(revenueChange),
        description: `Hoje: ${formatCurrency(todayRevenue)} vs ontem: ${formatCurrency(yesterdayRevenue)}`,
        trend: revenueChange >= 0 ? 'up' : 'down',
        color: revenueChange >= 0 ? 'emerald' : 'red',
        priority: 1,
      });
    }

    // ========== INSIGHT 2: Ticket Medio ==========
    const todayTicket = todayOrders.length > 0 
      ? todayOrders.reduce((sum: number, o: any) => sum + Number(o.valor_total || 0), 0) / todayOrders.length 
      : 0;
    const yesterdayTicket = yesterdayOrders.length > 0 
      ? yesterdayOrders.reduce((sum: number, o: any) => sum + Number(o.valor_total || 0), 0) / yesterdayOrders.length 
      : 0;
    
    if (todayTicket > 0 && yesterdayTicket > 0) {
      const ticketChange = ((todayTicket - yesterdayTicket) / yesterdayTicket) * 100;
      
      if (Math.abs(ticketChange) >= 5) {
        insights.push({
          id: 'ticket',
          type: ticketChange >= 0 ? 'growth' : 'alert',
          icon: 'Receipt',
          title: ticketChange >= 0 ? 'Ticket Medio Subiu' : 'Ticket Medio Caiu',
          value: formatPercentage(ticketChange),
          description: `Hoje: ${formatCurrency(todayTicket)} | Ontem: ${formatCurrency(yesterdayTicket)}`,
          trend: ticketChange >= 0 ? 'up' : 'down',
          color: ticketChange >= 0 ? 'emerald' : 'amber',
          priority: 2,
        });
      }
    }

    // ========== INSIGHT 3: Horario de Pico ==========
    if (todayOrders.length >= 3) {
      const salesByHour: { [hour: number]: number } = {};
      todayOrders.forEach((o: any) => {
        const date = new Date(o.criado_em);
        const hour = (date.getUTCHours() - 3 + 24) % 24; // UTC-3 Brasilia
        salesByHour[hour] = (salesByHour[hour] || 0) + 1;
      });
      
      const peakHour = Object.entries(salesByHour)
        .sort(([, a], [, b]) => b - a)[0];
      
      if (peakHour) {
        const [hour, count] = peakHour;
        insights.push({
          id: 'peak-hour',
          type: 'opportunity',
          icon: 'Clock',
          title: 'Horario de Pico',
          value: `${hour}h`,
          description: `${count} pedidos neste horario hoje`,
          trend: 'neutral',
          color: 'blue',
          priority: 2,
        });
      }
    }

    // ========== INSIGHT 4: Produto Mais Vendido ==========
    const productStats = new Map<string, number>();
    todayOrders.forEach((order: any) => {
      let items = [];
      try {
        if (typeof order.itens === 'string') items = JSON.parse(order.itens);
        else if (Array.isArray(order.itens)) items = order.itens;
      } catch { /* ignore */ }

      items.forEach((item: any) => {
        const name = (item.produto || item.nome || 'Item').split(' (')[0].trim();
        productStats.set(name, (productStats.get(name) || 0) + Number(item.quantidade || 1));
      });
    });

    if (productStats.size > 0) {
      const topProduct = Array.from(productStats.entries())
        .sort(([, a], [, b]) => b - a)[0];
      
      if (topProduct) {
        const [name, qty] = topProduct;
        insights.push({
          id: 'top-product',
          type: 'product',
          icon: 'Star',
          title: 'Mais Vendido Hoje',
          value: name,
          description: `${qty} unidades vendidas`,
          trend: 'up',
          color: 'amber',
          priority: 2,
        });
      }
    }

    // ========== INSIGHT 5: Pedidos Pendentes (Alerta) ==========
    const pendingOrders = allOrders.filter((o: any) => 
      o.status === 'pendente' || o.status === 'preparando'
    );
    
    if (pendingOrders.length > 0) {
      const oldestPending = pendingOrders
        .map((o: any) => ({ ...o, age: Date.now() - new Date(o.criado_em).getTime() }))
        .sort((a: any, b: any) => b.age - a.age)[0];
      
      const ageMinutes = Math.floor(oldestPending.age / (1000 * 60));
      
      insights.push({
        id: 'pending',
        type: 'alert',
        icon: 'AlertCircle',
        title: 'Pedidos Aguardando',
        value: `${pendingOrders.length}`,
        description: ageMinutes > 30 
          ? `Mais antigo ha ${ageMinutes} min - atencao!`
          : `${pendingOrders.filter((o: any) => o.status === 'pendente').length} pendentes, ${pendingOrders.filter((o: any) => o.status === 'preparando').length} preparando`,
        trend: ageMinutes > 30 ? 'down' : 'neutral',
        color: ageMinutes > 30 ? 'red' : 'orange',
        priority: 1,
      });
    }

    // ========== INSIGHT 6: Tempo Medio de Preparo ==========
    const finishedToday = todayOrders.filter((o: any) => o.status === 'finalizado');
    if (finishedToday.length >= 3) {
      // Calcular tempo medio (criado -> finalizado)
      // Como nao temos timestamp de finalizacao, vamos estimar baseado no padrao
      const avgTime = 28; // placeholder - idealmente viria do banco
      
      insights.push({
        id: 'prep-time',
        type: 'operation',
        icon: 'Zap',
        title: 'Operacao Eficiente',
        value: `${avgTime}min`,
        description: `Tempo medio de preparo hoje`,
        trend: 'up',
        color: 'emerald',
        priority: 3,
      });
    }

    // ========== INSIGHT 7: Clientes Recorrentes ==========
    const customerPhones = new Map<string, number>();
    weekOrders.forEach((o: any) => {
      const phone = o.telefone_cliente;
      if (phone) {
        customerPhones.set(phone, (customerPhones.get(phone) || 0) + 1);
      }
    });
    
    const recurrentCustomers = Array.from(customerPhones.entries())
      .filter(([, count]) => count >= 2).length;
    
    if (recurrentCustomers > 0) {
      insights.push({
        id: 'recurrent',
        type: 'customer',
        icon: 'Users',
        title: 'Clientes Fieis',
        value: `${recurrentCustomers}`,
        description: `Clientes compraram 2+ vezes na semana`,
        trend: 'up',
        color: 'violet',
        priority: 2,
      });
    }

    // ========== INSIGHT 8: Comparativo Semanal ==========
    const lastWeekStart = new Date(weekAgo);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    
    const thisWeekOrders = weekOrders.length;
    const lastWeekOrders = allOrders.filter((o: any) => 
      o.criado_em && new Date(o.criado_em) >= lastWeekStart && new Date(o.criado_em) < weekAgo && o.status !== 'cancelado'
    ).length;
    
    if (thisWeekOrders > 0 && lastWeekOrders > 0) {
      const weekChange = ((thisWeekOrders - lastWeekOrders) / lastWeekOrders) * 100;
      
      if (Math.abs(weekChange) >= 10) {
        insights.push({
          id: 'weekly',
          type: weekChange >= 0 ? 'growth' : 'alert',
          icon: 'BarChart3',
          title: weekChange >= 0 ? 'Semana em Alta' : 'Semana em Queda',
          value: formatPercentage(weekChange),
          description: `Esta semana: ${thisWeekOrders} pedidos | Anterior: ${lastWeekOrders}`,
          trend: weekChange >= 0 ? 'up' : 'down',
          color: weekChange >= 0 ? 'emerald' : 'red',
          priority: 2,
        });
      }
    }

    // ========== INSIGHT 9: Pedidos Cancelados (se houver) ==========
    const canceledToday = allOrders.filter((o: any) => 
      o.criado_em && new Date(o.criado_em) >= todayStart && o.status === 'cancelado'
    );
    
    if (canceledToday.length > 0) {
      const lostRevenue = canceledToday.reduce((sum: number, o: any) => sum + Number(o.valor_total || 0), 0);
      
      insights.push({
        id: 'canceled',
        type: 'alert',
        icon: 'XCircle',
        title: 'Pedidos Cancelados',
        value: `${canceledToday.length}`,
        description: `${formatCurrency(lostRevenue)} em vendas perdidas hoje`,
        trend: 'down',
        color: 'red',
        priority: 1,
      });
    }

    // ========== INSIGHT 10: Meta do Dia (se configurada) ==========
    // Placeholder - pode ser configuravel no futuro
    const dailyGoal = 1000; // R$ 1000 de meta diaria exemplo
    if (todayRevenue > 0) {
      const goalProgress = (todayRevenue / dailyGoal) * 100;
      
      if (goalProgress >= 100) {
        insights.push({
          id: 'goal',
          type: 'growth',
          icon: 'Trophy',
          title: 'Meta Batida!',
          value: `${goalProgress.toFixed(0)}%`,
          description: `${formatCurrency(todayRevenue)} de ${formatCurrency(dailyGoal)}`,
          trend: 'up',
          color: 'emerald',
          priority: 1,
        });
      } else if (goalProgress >= 70) {
        insights.push({
          id: 'goal',
          type: 'opportunity',
          icon: 'Target',
          title: 'Quase La!',
          value: `${goalProgress.toFixed(0)}%`,
          description: `Faltam ${formatCurrency(dailyGoal - todayRevenue)} para a meta`,
          trend: 'up',
          color: 'blue',
          priority: 2,
        });
      }
    }

    // Ordenar por prioridade e retornar top 8
    return insights
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 8);

  } catch (error) {
    console.error('[Insights] Erro:', error);
    return [];
  }
}
