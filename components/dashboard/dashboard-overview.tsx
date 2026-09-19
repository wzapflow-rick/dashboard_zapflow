'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getDashboardBundle } from '@/app/actions/dashboard';
import { type OnboardingStatus } from '@/app/actions/onboarding-status';
import { SetupChecklist } from '@/components/onboarding/setup-checklist';
import { useLowPowerMode } from '@/hooks/use-low-power-mode';
import { MetricStrip } from './home/metric-strip';
import { AIConsultant } from './home/ai-consultant';
import { QuickActions } from './home/quick-actions';
import { SectionHeader } from './home/section-header';
import { OperationsOverview } from './home/operations-overview';
import { RecentOrders } from './home/recent-orders';

const OrderDetailsModal = dynamic(() => import('@/components/modals/order-details-modal'), {
  ssr: false,
});

const DEFAULT_STATS = [
  { label: 'Faturamento Bruto', value: 'R$ 0,00', change: '...', trend: 'neutral', color: 'blue' },
  { label: 'Total de Pedidos', value: '0', change: '...', trend: 'neutral', color: 'indigo' },
  { label: 'Ticket Médio', value: 'R$ 0,00', change: '...', trend: 'neutral', color: 'slate' },
  { label: 'Pedidos Pendentes', value: '0', change: '...', trend: 'neutral', color: 'primary' },
];

const PERIOD_LABELS: Record<string, string> = {
  Hoje: 'Hoje',
  'Ultimos 7 dias': 'Últimos 7 dias',
  'Este Mes': 'Este mês',
  Tudo: 'Todo o período',
};

function todayLabel() {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] animate-pulse flex-col gap-8" aria-busy="true" aria-label="Carregando início">
      <div className="flex flex-col gap-3">
        <div className="h-8 w-56 rounded-lg bg-slate-200/60 dark:bg-white/[0.06]" />
        <div className="h-4 w-72 max-w-full rounded-lg bg-slate-200/60 dark:bg-white/[0.06]" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-28 rounded-2xl bg-slate-200/40 dark:bg-white/[0.03]" />
        ))}
      </div>
      <div className="h-56 rounded-3xl bg-slate-200/40 dark:bg-white/[0.03]" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-20 rounded-2xl bg-slate-200/40 dark:bg-white/[0.03]" />
        ))}
      </div>
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
    if (showRefreshIndicator) setIsRefreshing(true);
    else setLoading(true);

    try {
      const bundle = await getDashboardBundle(selectedPeriod);
      setUser(bundle.user);
      setOnboardingStatus(bundle.onboarding);

      const data = bundle.dashboard;
      setDashboardData(data);
      setError(null);

      if (data.rawOrders) {
        const formattedOrders = data.rawOrders.map((order: any) => ({
          id: `#${order.id}`,
          customer: order.cliente_nome || order.nome_cliente || 'Cliente',
          phone: order.telefone_cliente || '',
          time: order.criado_em
            ? new Date(order.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            : '...',
          value: `R$ ${Number(order.valor_total || 0).toFixed(2).replace('.', ',')}`,
          status:
            order.status === 'pendente'
              ? 'Pendente'
              : order.status === 'preparando'
                ? 'Preparando'
                : order.status === 'cancelado'
                  ? 'Cancelado'
                  : 'Finalizado',
          statusColor:
            order.status === 'pendente'
              ? 'amber'
              : order.status === 'preparando'
                ? 'blue'
                : order.status === 'cancelado'
                  ? 'red'
                  : 'emerald',
          raw: order,
        }));
        setOrders(formattedOrders);
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados da dashboard:', err);
      setError(err?.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    queueMicrotask(loadData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod]);

  const handleOpenModal = (order: any) => {
    setSelectedOrder(order.raw || order);
    setIsModalOpen(true);
  };

  if (loading) return <DashboardSkeleton />;

  const stats = dashboardData?.stats || DEFAULT_STATS;
  const pedidosCount = stats[1]?.value ?? '0';
  const firstName = (user?.nome || 'Usuário').split(' ')[0];

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 pb-8">
      <motion.header
        initial={lowPower ? false : { opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"
      >
        <div className="min-w-0">
          <h1 className="text-balance text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Olá, {firstName}
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Aqui está o resumo da sua loja &middot; {todayLabel()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="dashboard-period" className="sr-only">
            Período do resumo
          </label>
          <select
            id="dashboard-period"
            value={selectedPeriod}
            onChange={(event) => setSelectedPeriod(event.target.value)}
            className="cursor-pointer rounded-xl border border-slate-200/70 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none transition-all focus:ring-2 focus:ring-primary/30 dark:border-white/[0.07] dark:bg-white/[0.03] dark:text-slate-200"
          >
            {Object.keys(PERIOD_LABELS).map((value) => (
              <option key={value} value={value}>
                {PERIOD_LABELS[value]}
              </option>
            ))}
          </select>

          <motion.button
            type="button"
            whileHover={lowPower ? undefined : { scale: 1.05 }}
            whileTap={lowPower ? undefined : { scale: 0.95 }}
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/70 bg-white/80 text-slate-600 transition-all dark:border-white/[0.07] dark:bg-white/[0.03] dark:text-slate-400',
              isRefreshing ? 'opacity-50' : 'hover:border-primary/30 hover:text-primary',
            )}
            aria-label="Atualizar dados do período"
            title="Atualizar dados"
          >
            <RefreshCw className={cn('size-4', isRefreshing && 'animate-spin')} aria-hidden="true" />
          </motion.button>
        </div>
      </motion.header>

      {onboardingStatus && onboardingStatus.completedSteps < onboardingStatus.totalSteps && (
        <SetupChecklist initialStatus={onboardingStatus} />
      )}

      <AnimatePresence>
        {error && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl border border-red-200/60 bg-red-50/80 p-4 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <MetricStrip stats={stats} lowPower={lowPower} />

      <AIConsultant />

      <section className="flex flex-col gap-4" aria-label="Ações rápidas">
        <SectionHeader
          title="O que você pode fazer agora"
          description="Ações rápidas para crescer o seu negócio."
        />
        <QuickActions lowPower={lowPower} />
      </section>

      <OperationsOverview
        chartData={dashboardData?.chartData || []}
        topProducts={dashboardData?.topProducts || []}
        pedidosCount={pedidosCount}
      />

      <RecentOrders orders={orders} onOpenModal={handleOpenModal} />

      {isModalOpen && (
        <OrderDetailsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} order={selectedOrder} />
      )}
    </div>
  );
}
