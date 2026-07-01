'use client';

import { motion } from 'motion/react';

interface CompareBarsProps {
  titulo: string;
  atualLabel: string;
  anteriorLabel: string;
  atual: number;
  anterior: number;
  variacao: number;
  formato?: 'moeda' | 'numero';
}

function fmt(v: number, formato: 'moeda' | 'numero') {
  if (formato === 'moeda') return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  return v.toLocaleString('pt-BR');
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-200">{titulo}</h4>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            positivo ? 'bg-primary/15 text-primary' : 'bg-red-500/15 text-red-400'
          }`}
        >
          {positivo ? '+' : ''}
          {variacao}%
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-slate-400">{atualLabel}</span>
            <span className="font-semibold text-slate-100">{fmt(atual, formato)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${pctAtual}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-slate-500">{anteriorLabel}</span>
            <span className="font-medium text-slate-400">{fmt(anterior, formato)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
            <motion.div
              className="h-full rounded-full bg-slate-500"
              initial={{ width: 0 }}
              animate={{ width: `${pctAnterior}%` }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
