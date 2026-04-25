'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, ShoppingBag, DollarSign, Zap, Clock, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { motion } from 'motion/react';
import { StatCard } from './stat-card';
import { TopProductsList } from './top-products';
import { RecentOrdersTable } from './recent-orders-table';
import { cn } from '@/lib/utils';
import { getMe } from '@/app/actions/auth';
import { getDashboardData } from '@/app/actions/dashboard';

const OrderDetailsModal = dynamic(() => import('@/components/modals/order-details-modal'), {
  ssr: false,
});

const DEFAULT_STATS = [
  { label: 'Faturamento Bruto', value: 'R$ 0,00', change: '...', trend: 'neutral', icon: DollarSign, color: 'blue' },
  { label: 'Total de Pedidos', value: '0', change: '...', trend: 'neutral', icon: ShoppingBag, color: 'indigo' },
  { label: 'Ticket Médio', value: 'R$ 0,00', change: '...', trend: 'neutral', icon: TrendingUp, color: 'slate' },
  { label: 'Pedidos Pendentes', value: '0', change: '...', trend: 'neutral', icon: Zap, color: 'primary' },
];

export default function DashboardOverview() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('Hoje');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // First get user info to ensure Header works
        const me = await getMe();
        setUser(me);

        // Then attempt to get dashboard data
        try {
          const data = await getDashboardData(selectedPeriod);
          setDashboardData(data);
          setError(null);

          if (data.rawOrders) {
            const formattedOrders = data.rawOrders.map((o: any) => ({
              id: `#${o.id}`,
              customer: o.cliente_nome || o.nome_cliente || 'Cliente',
              phone: o.telefone_cliente || '',
              time: o.criado_em ? new Date(o.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '...',
              value: `R$ ${Number(o.valor_total || 0).toFixed(2).replace('.', ',')}`,
              status: o.status === 'pendente' ? 'Pendente' : o.status === 'preparando' ? 'Preparando' : o.status === 'cancelado' ? 'Cancelado' : 'Finalizado',
              statusColor: o.status === 'pendente' ? 'amber' : o.status === 'preparando' ? 'blue' : o.status === 'cancelado' ? 'red' : 'emerald',
              raw: o
            }));
            setOrders(formattedOrders);
          }
          // Debug: console.log('Dashboard data loaded:', data);
        } catch (dashError: any) {
          console.error('Erro ao carregar dados da dashboard:', dashError);
          setError(dashError.message || 'Erro ao carregar dados');
        }
      } catch (err) {
        console.error('Erro crítico no dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedPeriod]);

  const handleOpenModal = (order: any) => {
    setSelectedOrder(order.raw || order);
    setIsModalOpen(true);
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 text-primary animate-spin" />
          <p className="text-sm font-medium text-slate-500">Calculando resultados...</p>
        </div>
      </div>
    );
  }

  // Fallback map icons because server action returns simple objects
  const statsWithIcons = (dashboardData?.stats || DEFAULT_STATS).map((s: any, i: number) => ({
    ...s,
    icon: i === 0 ? DollarSign : i === 1 ? ShoppingBag : i === 2 ? TrendingUp : Zap
  }));

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Olá, {user?.nome || 'Usuário'} 👋</h1>
          <p className="text-slate-500 text-sm mt-1 dark:text-slate-400">Aqui está o que está acontecendo com sua loja {selectedPeriod.toLowerCase()}.</p>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="w-full sm:w-auto bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
          >
            <option value="Hoje">Hoje</option>
            <option value="Últimos 7 dias">Últimos 7 dias</option>
            <option value="Este Mês">Este Mês</option>
            <option value="Tudo">Tudo</option>
          </select>
        </div>
      </header>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          ⚠️ {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsWithIcons.map((stat: any, i: number) => (
          <StatCard key={stat.label} stat={stat} index={i} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md dark:bg-slate-800 dark:border-slate-700">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-bold text-slate-800 dark:text-white">Vendas por Hora</h4>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1.5">
              <Clock className="size-3" /> Atualizado agora
            </span>
          </div>
          {/* Chart de vendas por hora */}
          <div className="overflow-x-auto custom-scrollbar -mx-2 px-2">
            <div className="h-[240px] flex items-end justify-between gap-1 bg-slate-50 rounded-xl p-4 border border-slate-100 dark:bg-slate-900/50 dark:border-slate-700/50 min-w-[600px] sm:min-w-0">
              {dashboardData?.chartData && dashboardData.chartData.length > 0 ? (
                dashboardData.chartData.map((val: number, i: number) => {
                  const maxVal = Math.max(...dashboardData.chartData);
                  const height = val === 0 ? 4 : Math.max(8, Math.round((val / Math.max(maxVal, 1)) * 180));

                  return (
                    <div key={i} className="flex-1 flex flex-col items-center relative group h-full justify-end">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${height}px` }}
                        className="w-full bg-gradient-to-t from-blue-600 to-blue-400 dark:from-blue-500 dark:to-blue-300 rounded-t-sm transition-all duration-300 group-hover:from-blue-500 group-hover:to-blue-300 shadow-sm"
                        title={`${val} pedidos`}
                      />
                      <span className="text-[10px] font-bold mt-2 text-slate-400 dark:text-slate-500">
                        {i}h
                      </span>
                      {/* Tooltip on hover */}
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-700 text-white text-[10px] px-2 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-10 shadow-xl border border-white/10 whitespace-nowrap">
                        <span className="font-bold">{val}</span> pedidos às {i}h
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="w-full flex items-center justify-center text-slate-400">
                  Nenhum dado disponível
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Top Products */}
        <TopProductsList products={dashboardData?.topProducts || []} />
      </div>

      {/* Recent Orders */}
      <RecentOrdersTable orders={orders} onOpenModal={handleOpenModal} />

      {isModalOpen && (
        <OrderDetailsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          order={selectedOrder}
        />
      )}
    </div>
  );
}
