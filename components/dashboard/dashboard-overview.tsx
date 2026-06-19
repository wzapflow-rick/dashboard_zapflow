'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, ShoppingBag, DollarSign, Zap, Clock, Loader2, RefreshCw, Activity } from 'lucide-react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'motion/react';
import { StatCard } from './stat-card';
import { TopProductsList } from './top-products';
import { RecentOrdersTable } from './recent-orders-table';
import { cn } from '@/lib/utils';
import { getMe } from '@/app/actions/auth';
import { getDashboardData } from '@/app/actions/dashboard';
import { getOnboardingStatus, OnboardingStatus } from '@/app/actions/onboarding-status';
import { SetupChecklist } from '@/components/onboarding/setup-checklist';
import { useLowPowerMode } from '@/hooks/use-low-power-mode';

const OrderDetailsModal = dynamic(() => import('@/components/modals/order-details-modal'), {
  ssr: false,
});

const DEFAULT_STATS = [
  { label: 'Faturamento Bruto', value: 'R$ 0,00', change: '...', trend: 'neutral', icon: DollarSign, color: 'blue' },
  { label: 'Total de Pedidos', value: '0', change: '...', trend: 'neutral', icon: ShoppingBag, color: 'indigo' },
  { label: 'Ticket Medio', value: 'R$ 0,00', change: '...', trend: 'neutral', icon: TrendingUp, color: 'slate' },
  { label: 'Pedidos Pendentes', value: '0', change: '...', trend: 'neutral', icon: Zap, color: 'primary' },
];

// Premium skeleton loading component
function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <div>
          <div className="h-8 w-48 bg-slate-200/50 dark:bg-slate-800/50 rounded-lg" />
          <div className="h-4 w-72 bg-slate-200/50 dark:bg-slate-800/50 rounded-lg mt-2" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-32 bg-slate-200/50 dark:bg-slate-800/50 rounded-xl" />
          <div className="h-10 w-10 bg-slate-200/50 dark:bg-slate-800/50 rounded-xl" />
        </div>
      </div>
      
      {/* Stats skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-36 bg-slate-200/30 dark:bg-slate-800/30 rounded-2xl" />
        ))}
      </div>
      
      {/* Chart and products skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-80 bg-slate-200/30 dark:bg-slate-800/30 rounded-2xl" />
        <div className="h-80 bg-slate-200/30 dark:bg-slate-800/30 rounded-2xl" />
      </div>
      
      {/* Table skeleton */}
      <div className="h-96 bg-slate-200/30 dark:bg-slate-800/30 rounded-2xl" />
    </div>
  );
}

export default function DashboardOverview() {
  const lowPower = useLowPowerMode();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('Hoje');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);

  const loadData = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      // Dispara as 3 chamadas em paralelo (sao independentes) para acelerar o carregamento.
      const dashboardPromise = getDashboardData(selectedPeriod);
      const [me, obStatus] = await Promise.all([getMe(), getOnboardingStatus()]);
      setUser(me);
      setOnboardingStatus(obStatus);

      try {
        const data = await dashboardPromise;
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
      } catch (dashError: any) {
        console.error('Erro ao carregar dados da dashboard:', dashError);
        setError(dashError.message || 'Erro ao carregar dados');
      }
    } catch (err) {
      console.error('Erro critico no dashboard:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedPeriod]);

  const handleOpenModal = (order: any) => {
    setSelectedOrder(order.raw || order);
    setIsModalOpen(true);
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  const statsWithIcons = (dashboardData?.stats || DEFAULT_STATS).map((s: any, i: number) => ({
    ...s,
    icon: i === 0 ? DollarSign : i === 1 ? ShoppingBag : i === 2 ? TrendingUp : Zap
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Ola, {user?.nome || 'Usuario'}
          </h1>
          <p className="text-slate-500 text-sm mt-1 dark:text-slate-400">
            Aqui esta o que esta acontecendo com sua loja {selectedPeriod.toLowerCase()}.
          </p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <motion.select
            whileHover={{ scale: 1.02 }}
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="flex-1 sm:flex-none sm:w-auto bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-primary/30 transition-all cursor-pointer shadow-lg shadow-slate-200/50 dark:shadow-black/20"
          >
            <option value="Hoje">Hoje</option>
            <option value="Ultimos 7 dias">Ultimos 7 dias</option>
            <option value="Este Mes">Este Mes</option>
            <option value="Tudo">Tudo</option>
          </motion.select>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className={cn(
              "size-10 flex items-center justify-center bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-xl text-slate-600 dark:text-slate-400 transition-all shadow-lg shadow-slate-200/50 dark:shadow-black/20",
              isRefreshing ? "opacity-50" : "hover:text-primary hover:border-primary/30"
            )}
            title="Atualizar dados"
          >
            <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
          </motion.button>
        </div>
      </motion.header>

      {/* Setup Checklist */}
      {onboardingStatus && onboardingStatus.completedSteps < onboardingStatus.totalSteps && (
        <SetupChecklist initialStatus={onboardingStatus} />
      )}

      {/* Error alert */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-50/80 dark:bg-red-900/20 backdrop-blur-xl border border-red-200/50 dark:border-red-800/50 rounded-2xl text-red-700 dark:text-red-400 text-sm"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsWithIcons.map((stat: any, i: number) => (
          <StatCard key={stat.label} stat={stat} index={i} />
        ))}
      </div>

      {/* Chart and Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="lg:col-span-2 relative bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-lg shadow-slate-200/50 dark:shadow-black/20 overflow-hidden"
        >
          {/* Background decoration */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
          
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-100/80 dark:bg-blue-900/30">
                <Activity className="size-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h4 className="font-bold text-slate-800 dark:text-white">Vendas por Hora</h4>
            </div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/80 dark:bg-slate-800/50 rounded-full">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
              </span>
              Tempo real
            </span>
          </div>
          
          {/* Chart */}
          <div className="overflow-x-auto custom-scrollbar -mx-2 px-2">
            <div className="h-[240px] flex items-end justify-between gap-1 bg-gradient-to-b from-slate-50/50 to-slate-100/30 dark:from-slate-800/30 dark:to-slate-900/30 rounded-xl p-4 border border-slate-200/30 dark:border-slate-700/30 min-w-[600px] sm:min-w-0">
              {dashboardData?.chartData && dashboardData.chartData.length > 0 ? (
                dashboardData.chartData.map((val: number, i: number) => {
                  const maxVal = Math.max(...dashboardData.chartData);
                  const height = val === 0 ? 4 : Math.max(8, Math.round((val / Math.max(maxVal, 1)) * 180));

                  return (
                    <div key={i} className="flex-1 flex flex-col items-center relative group h-full justify-end">
                      <motion.div
                        initial={lowPower ? false : { height: 0, opacity: 0 }}
                        animate={{ height: `${height}px`, opacity: 1 }}
                        transition={lowPower ? { duration: 0 } : { delay: i * 0.03, type: 'spring', stiffness: 100 }}
                        className="w-full bg-gradient-to-t from-primary to-primary/70 rounded-t-md transition-all duration-300 group-hover:from-primary/90 group-hover:to-primary/60 shadow-lg shadow-primary/20 group-hover:shadow-primary/40"
                        title={`${val} pedidos`}
                      />
                      <span className="text-[10px] font-bold mt-2 text-slate-400 dark:text-slate-500">
                        {i}h
                      </span>
                      {/* Tooltip */}
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-700 text-white text-xs px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-10 shadow-xl border border-white/10 whitespace-nowrap">
                        <span className="font-bold text-primary">{val}</span> pedidos as {i}h
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 dark:bg-slate-700 rotate-45" />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="w-full flex items-center justify-center text-slate-400">
                  Nenhum dado disponivel
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Top Products */}
        <TopProductsList products={dashboardData?.topProducts || []} />
      </div>

      {/* Recent Orders */}
      <RecentOrdersTable orders={orders} onOpenModal={handleOpenModal} />

      {/* Order Details Modal */}
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
