'use client';

import { Activity, BarChart3, Trophy } from 'lucide-react';
import { SectionHeader } from './section-header';
import { SalesChart } from './sales-chart';
import { EmptyState } from './empty-state';

interface TopProduct {
  name: string;
  sales: number;
  price: string;
  image?: string;
}

interface OperationsOverviewProps {
  chartData: number[];
  topProducts: TopProduct[];
  pedidosCount: string;
}

export function OperationsOverview({ chartData, topProducts, pedidosCount }: OperationsOverviewProps) {
  const hasChartData = Array.isArray(chartData) && chartData.some((value) => value > 0);
  const hasProducts = topProducts.length > 0;
  const maxSales = hasProducts ? Math.max(...topProducts.map((product) => product.sales), 1) : 1;

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Operação de hoje"
        description="Acompanhe o movimento da sua loja em tempo real."
        actionLabel="Ver operação"
        actionHref="/dashboard/expedition"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-5 dark:border-white/[0.06] dark:bg-white/[0.02] lg:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Activity className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Vendas por hora</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Distribuição ao longo do dia</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{pedidosCount}</p>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Pedidos
              </p>
            </div>
          </div>

          {hasChartData ? (
            <SalesChart data={chartData} />
          ) : (
            <EmptyState
              compact
              icon={BarChart3}
              title="Sem movimento ainda"
              description="Os pedidos aparecem aqui assim que começarem a chegar."
            />
          )}
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-5 dark:border-white/[0.06] dark:bg-white/[0.02]">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Trophy className="size-4" aria-hidden="true" />
            </span>
            <h3 className="font-semibold text-slate-900 dark:text-white">Mais vendidos</h3>
          </div>

          {hasProducts ? (
            <ul className="flex flex-col gap-3.5">
              {topProducts.slice(0, 5).map((product, index) => (
                <li key={`${product.name}-${index}`} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        index === 0
                          ? 'bg-brand/15 text-brand'
                          : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                      {product.name}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                      {product.sales} un
                    </span>
                  </div>
                  <div className="ml-9 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.05]">
                    <div
                      className={`h-full rounded-full ${index === 0 ? 'bg-brand' : 'bg-primary/50'}`}
                      style={{ width: `${Math.max(6, Math.round((product.sales / maxSales) * 100))}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-sm text-slate-500 dark:text-slate-400">
              Ainda sem vendas suficientes para ranquear seus produtos.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
