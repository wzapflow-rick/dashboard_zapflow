'use client';

import { motion } from 'motion/react';
import { DollarSign, ShoppingBag, TrendingUp, Clock } from 'lucide-react';
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

export function MetricStrip({ stats, lowPower }: { stats: Stat[]; lowPower?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {stats.slice(0, 4).map((stat, index) => {
        const Icon = ICONS[index] ?? DollarSign;
        const isPending = index === 3;
        const pendingActive = isPending && stat.value !== '0';
        // Faturamento é o indicador principal: recebe o acento de marca (âmbar).
        const isPrincipal = index === 0;

        return (
          <motion.div
            key={stat.label ?? index}
            initial={lowPower ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={lowPower ? { duration: 0 } : { delay: index * 0.05 }}
            className={cn(
              'rounded-2xl border p-4 transition-colors sm:p-5',
              pendingActive
                ? 'border-amber-300/60 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/[0.07]'
                : isPrincipal
                  ? 'border-brand/25 bg-white/80 dark:border-brand/20 dark:bg-white/[0.035]'
                  : 'border-slate-200/70 bg-white/70 dark:border-white/[0.07] dark:bg-white/[0.02]',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
                {LABELS[index] ?? stat.label}
              </span>
              <Icon
                className={cn(
                  'size-4 shrink-0',
                  pendingActive
                    ? 'text-amber-500 dark:text-amber-400'
                    : isPrincipal
                      ? 'text-brand'
                      : 'text-slate-400 dark:text-slate-500',
                )}
                aria-hidden="true"
              />
            </div>
            <p className="mt-2 text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:mt-3 sm:text-3xl">
              {stat.value}
            </p>
            <p
              className={cn(
                'mt-1 text-xs font-medium',
                pendingActive ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500',
              )}
            >
              {isPending ? (pendingActive ? 'Requer atenção' : 'Tudo em dia') : 'Tempo real'}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}
