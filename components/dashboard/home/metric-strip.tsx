'use client';

import { motion } from 'motion/react';
import { DollarSign, ShoppingBag, TrendingUp, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stat {
  label: string;
  value: string;
  change?: string;
  trend?: string;
  color?: string;
}

const ICONS = [DollarSign, ShoppingBag, TrendingUp, Clock];
const LABELS = ['Faturamento', 'Pedidos', 'Ticket médio', 'Pendentes'];

// Considera "vazio" quando não há nenhum dígito significativo (ex.: "R$ 0,00", "0").
function isZeroValue(value: string) {
  const digits = value.replace(/[^\d]/g, '');
  return digits === '' || Number(digits) === 0;
}

// Texto secundário acolhedor — orienta o lojista em vez de parecer erro.
function secondaryLabel(index: number, empty: boolean) {
  switch (index) {
    case 0:
      return empty ? 'Nenhuma venda ainda' : 'Total do período';
    case 1:
      return empty ? 'Aguardando o 1º pedido' : 'Pedidos no período';
    case 2:
      return empty ? 'Sem dados ainda' : 'Por pedido';
    case 3:
      return empty ? 'Tudo em dia' : 'Requer atenção';
    default:
      return '';
  }
}

export function MetricStrip({ stats, lowPower }: { stats: Stat[]; lowPower?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {stats.slice(0, 4).map((stat, index) => {
        const Icon = ICONS[index] ?? DollarSign;
        const empty = isZeroValue(stat.value);
        const isPrincipal = index === 0; // Faturamento — indicador de marca (âmbar)
        const isPending = index === 3;
        const pendingActive = isPending && !empty; // Pendentes com valor — atenção (âmbar)
        const accent = isPrincipal || pendingActive;

        const trend = (stat.trend || '').toLowerCase();
        const positive = trend === 'up' || trend === 'positive';
        const negative = trend === 'down' || trend === 'negative';
        const showChange = !!stat.change && stat.change !== '...' && !empty && (positive || negative);

        return (
          <motion.div
            key={stat.label ?? index}
            initial={lowPower ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={lowPower ? { duration: 0 } : { delay: index * 0.05 }}
            className={cn(
              'relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 transition-colors sm:p-5',
              accent
                ? 'border-brand/25 bg-brand/[0.04] dark:border-brand/20 dark:bg-brand/[0.05]'
                : 'border-slate-200/70 bg-white/70 dark:border-white/[0.06] dark:bg-white/[0.02]',
            )}
          >
            {accent && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent"
              />
            )}

            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:text-xs">
                {LABELS[index] ?? stat.label}
              </span>
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-lg',
                  accent
                    ? 'bg-brand/15 text-brand'
                    : 'bg-slate-100 text-slate-400 dark:bg-white/[0.05] dark:text-slate-500',
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
            </div>

            <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-[2rem] sm:leading-[1.1]">
              {stat.value}
            </p>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {showChange && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
                    positive
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-red-500/10 text-red-600 dark:text-red-400',
                  )}
                >
                  {positive ? (
                    <ArrowUpRight className="size-3" aria-hidden="true" />
                  ) : (
                    <ArrowDownRight className="size-3" aria-hidden="true" />
                  )}
                  {stat.change}
                </span>
              )}
              <span
                className={cn(
                  'text-xs font-medium',
                  pendingActive
                    ? 'text-brand'
                    : isPending && empty
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-slate-500',
                )}
              >
                {secondaryLabel(index, empty)}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
