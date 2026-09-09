'use client';

import React, { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  BarChart3,
  BrainCircuit,
  DollarSign,
  FileBarChart,
  LayoutDashboard,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { StatCard } from './stat-card';
import { TopProductsList } from './top-products';
import { RecentOrdersTable } from './recent-orders-table';
import { ZapflowInsightsClient } from '@/components/insights/zapflow-insights-client';
import { cn } from '@/lib/utils';
import { getDashboardBundle } from '@/app/actions/dashboard';
import { type OnboardingStatus } from '@/app/actions/onboarding-status';
import { SetupChecklist } from '@/components/onboarding/setup-checklist';
import { useLowPowerMode } from '@/hooks/use-low-power-mode';

const OrderDetailsModal = dynamic(() => import('@/components/modals/order-details-modal'), {
  ssr: false,
});

const DEFAULT_STATS = [
  { label: 'Faturamento Bruto', value: 'R$ 0,00', change: '...', trend: 'neutral', icon: DollarSign, color: 'blue' },
  { label: 'Total de Pedidos', value: '0', change: '...', trend: 'neutral', icon: ShoppingBag, color: 'indigo' },
  { label: 'Ticket Médio', value: 'R$ 0,00', change: '...', trend: 'neutral', icon: TrendingUp, color: 'slate' },
  { label: 'Pedidos Pendentes', value: '0', change: '...', trend: 'neutral', icon: Zap, color: 'primary' },
];

const SECTION_LINKS = [
  { label: 'Resumo', href: '#resumo', icon: LayoutDashboard },
  { label: 'Inteligência IA', href: '#inteligencia', icon: Sparkles },
  { label: 'Operação', href: '#operacao', icon: Activity },
  { label: 'Desempenho', href: '#desempenho', icon: BarChart3 },
];

function DashboardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-8" aria-busy="true" aria-label="Carregando visão geral">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-48 rounded-lg bg-slate-200/60 dark:bg-slate-800/60" />
          <div className="h-4 w-72 max-w-full rounded-lg bg-slate-200/60 dark:bg-slate-800/60" />
        </div>
        <div className="h-10 w-full rounded-xl bg-slate-200/60 dark:bg-slate-800/60 sm:w-80" />
      </div>
      <div className="h-14 rounded-2xl bg-slate-200/40 dark:bg-slate-800/40" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-36 rounded-2xl bg-slate-200/40 dark:bg-slate-800/40" />
        ))}
      </div>
      <div className="h-72 rounded-3xl bg-slate-200/40 dark:bg-slate-800/40" />
    </div>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  icon: Icon,
  aside,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ElementType;
  aside?: ReactNode;
}) {
  return (
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">{eyebrow}</p>
          <h2 id={id} className="mt-1 text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      {aside}
    </header>
  );
}

function OperationSection({
  dashboardData,
  orders,
  selectedPeriod,
  lowPower,
  onOpenModal,
}: {
  dashboardData: any;
  orders: any[];
  selectedPeriod: string;
  lowPower: boolean;
  onOpenModal: (order: any) => void;
}) {
  const chartData: number[] = dashboardData?.chartData || [];
  const maxValue = Math.max(...chartData, 1);

  return (
    <section id="operacao" className="scroll-mt-32 flex flex-col gap-6" aria-labelledby="operacao-title">
      <SectionHeading
        id="operacao-title"
        eyebrow="Operação"
        title="Ritmo da loja"
        description="Acompanhe o movimento por hora, os produtos mais vendidos e os pedidos mais recentes."
        icon={Activity}
        aside={(
          <span className="w-fit rounded-full border border-slate-200/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/50 dark:text-slate-300">
            Período: {selectedPeriod}
          </span>
        )}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.div
          initial={lowPower ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={lowPower ? { duration: 0 } : { delay: 0.1 }}
          className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/75 p-5 shadow-lg shadow-slate-200/40 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/50 dark:shadow-black/20 sm:p-6 lg:col-span-2"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/30 via-primary to-primary/30" />
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Activity className="size-4" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white">Vendas por hora</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Distribuição dos pedidos ao longo do dia</p>
              </div>
            </div>
            <span className="flex items-center gap-2 rounded-full bg-slate-100/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
              <span className="relative flex size-2" aria-hidden="true">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              Tempo real
            </span>
          </div>

          <div className="custom-scrollbar -mx-2 overflow-x-auto px-2">
            <div className="flex h-60 min-w-[600px] items-end justify-between gap-1 rounded-xl border border-slate-200/50 bg-gradient-to-b from-slate-50/60 to-slate-100/40 p-4 dark:border-slate-700/40 dark:from-slate-800/40 dark:to-slate-900/30 sm:min-w-0">
              {chartData.length > 0 ? (
                chartData.map((value, index) => {
                  const height = value === 0 ? 4 : Math.max(8, Math.round((value / maxValue) * 180));

                  return (
                    <div key={index} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                      <motion.div
                        initial={lowPower ? false : { height: 0, opacity: 0 }}
                        animate={{ height: `${height}px`, opacity: 1 }}
                        transition={lowPower ? { duration: 0 } : { delay: index * 0.03, type: 'spring', stiffness: 100 }}
                        className="w-full rounded-t-md bg-gradient-to-t from-primary to-primary/70 shadow-lg shadow-primary/20 transition-all duration-300 group-hover:from-primary/90 group-hover:to-primary/60 group-hover:shadow-primary/40"
                        title={`${value} pedidos às ${index}h`}
                      />
                      <span className="mt-2 text-[10px] font-bold text-slate-400 dark:text-slate-500">{index}h</span>
                      <div className="pointer-events-none absolute -top-12 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 dark:bg-slate-700">
                        <span className="font-bold text-primary">{value}</span> pedidos às {index}h
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex w-full items-center justify-center text-sm text-slate-400">Nenhum dado disponível</div>
              )}
            </div>
          </div>
        </motion.div>

        <TopProductsList products={dashboardData?.topProducts || []} />
      </div>

      <RecentOrdersTable orders={orders} onOpenModal={onOpenModal} />
    </section>
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

  const statsWithIcons = (dashboardData?.stats || DEFAULT_STATS).map((stat: any, index: number) => ({
    ...stat,
    icon: index === 0 ? DollarSign : index === 1 ? ShoppingBag : index === 2 ? TrendingUp : Zap,
  }));

  const operationContent = (
    <OperationSection
      dashboardData={dashboardData}
      orders={orders}
      selectedPeriod={selectedPeriod}
      lowPower={lowPower}
      onOpenModal={handleOpenModal}
    />
  );

  return (
    <div className="flex flex-col gap-10 pb-8">
      <motion.header
        initial={lowPower ? false : { opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end"
      >
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
            <BrainCircuit className="size-4" aria-hidden="true" />
            Painel operacional + IA
          </div>
          <h1 className="text-balance text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            Olá, {user?.nome || 'Usuário'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Uma visão completa da sua loja: resultados, operação e recomendações inteligentes no mesmo lugar.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:justify-end">
          <select
            value={selectedPeriod}
            onChange={(event) => setSelectedPeriod(event.target.value)}
            aria-label="Período da visão geral"
            className="min-w-40 flex-1 cursor-pointer rounded-xl border border-slate-200/70 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-lg shadow-slate-200/40 outline-none transition-all focus:ring-2 focus:ring-primary/30 dark:border-slate-700/50 dark:bg-slate-900/60 dark:text-slate-300 dark:shadow-black/20 sm:flex-none"
          >
            <option value="Hoje">Hoje</option>
            <option value="Ultimos 7 dias">Últimos 7 dias</option>
            <option value="Este Mes">Este mês</option>
            <option value="Tudo">Tudo</option>
          </select>

          <Link
            href="/dashboard/reports"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200/70 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-lg shadow-slate-200/40 transition-colors hover:border-primary/30 hover:text-primary dark:border-slate-700/50 dark:bg-slate-900/60 dark:text-slate-300 dark:shadow-black/20 dark:hover:text-primary"
          >
            <FileBarChart className="size-4" aria-hidden="true" />
            Abrir relatórios
          </Link>

          <motion.button
            type="button"
            whileHover={lowPower ? undefined : { scale: 1.05 }}
            whileTap={lowPower ? undefined : { scale: 0.95 }}
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className={cn(
              'flex size-10 items-center justify-center rounded-xl border border-slate-200/70 bg-white/80 text-slate-600 shadow-lg shadow-slate-200/40 transition-all dark:border-slate-700/50 dark:bg-slate-900/60 dark:text-slate-400 dark:shadow-black/20',
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
            className="rounded-2xl border border-red-200/60 bg-red-50/80 p-4 text-sm text-red-700 backdrop-blur-xl dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <nav
        aria-label="Atalhos da visão geral"
        className="custom-scrollbar sticky top-20 z-30 -mx-1 overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/85 p-1.5 shadow-lg shadow-slate-200/30 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/85 dark:shadow-black/20"
      >
        <div className="flex min-w-max items-center gap-1">
          {SECTION_LINKS.map(({ label, href, icon: Icon }) => (
            <a
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:text-slate-300"
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </a>
          ))}
        </div>
      </nav>

      <section id="resumo" className="scroll-mt-32 flex flex-col gap-6" aria-labelledby="resumo-title">
        <SectionHeading
          id="resumo-title"
          eyebrow="Resumo"
          title="Números do período"
          description="Indicadores consolidados conforme o período selecionado no topo da página."
          icon={LayoutDashboard}
          aside={(
            <span className="w-fit rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              {selectedPeriod}
            </span>
          )}
        />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {statsWithIcons.map((stat: any, index: number) => (
            <StatCard key={stat.label} stat={stat} index={index} />
          ))}
        </div>
      </section>

      <ZapflowInsightsClient operationContent={operationContent} />

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
