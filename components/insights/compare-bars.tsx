'use client';

import {
  ZapflowLineChart,
  type ZapflowLineChartPoint,
} from '@/components/charts/zapflow-line-chart';
import { cn } from '@/lib/utils';

interface CompareBarsProps {
  titulo: string;
  atualLabel: string;
  anteriorLabel: string;
  atual: number;
  anterior: number;
  variacao: number;
  serie?: ZapflowLineChartPoint[];
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
  serie,
  formato = 'moeda',
}: CompareBarsProps) {
  const positivo = variacao >= 0;
  const chartData = serie?.length
    ? serie
    : [
        { label: anteriorLabel, value: anterior },
        { label: atualLabel, value: atual },
      ];

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

      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{atualLabel}</p>
          <p className="mt-1 font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmt(atual, formato)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400 dark:text-slate-500">{anteriorLabel}</p>
          <p className="mt-1 text-sm font-medium tabular-nums text-slate-500 dark:text-slate-400">{fmt(anterior, formato)}</p>
        </div>
      </div>

      <ZapflowLineChart
        data={chartData}
        valueLabel={titulo}
        formatValue={(value) => fmt(value, formato)}
        compact
        showYAxis={false}
      />
    </article>
  );
}
