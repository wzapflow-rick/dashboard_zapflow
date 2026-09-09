'use client';

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface CompareBarsProps {
  titulo: string;
  atualLabel: string;
  anteriorLabel: string;
  atual: number;
  anterior: number;
  variacao: number;
  formato?: 'moeda' | 'numero';
}

function fmt(value: number, formato: 'moeda' | 'numero') {
  if (formato === 'moeda') return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  return value.toLocaleString('pt-BR');
}

export function CompareBars({
  titulo,
  atualLabel,
  anteriorLabel,
  atual,
  anterior,
  variacao,
  formato = 'moeda',
}: CompareBarsProps) {
  const max = Math.max(atual, anterior, 1);
  const pctAtual = (atual / max) * 100;
  const pctAnterior = (anterior / max) * 100;
  const positivo = variacao >= 0;

  return (
    <article className="rounded-2xl border border-slate-200/70 bg-white/75 p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/50">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{titulo}</h4>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-bold',
            positivo ? 'bg-primary/15 text-primary' : 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400',
          )}
        >
          {positivo ? '+' : ''}
          {variacao}%
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 dark:text-slate-400">{atualLabel}</span>
            <span className="font-semibold text-slate-800 dark:text-slate-100">{fmt(atual, formato)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${pctAtual}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-400 dark:text-slate-500">{anteriorLabel}</span>
            <span className="font-medium text-slate-500 dark:text-slate-400">{fmt(anterior, formato)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <motion.div
              className="h-full rounded-full bg-slate-400 dark:bg-slate-500"
              initial={{ width: 0 }}
              animate={{ width: `${pctAnterior}%` }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
