'use client';


import { MorphingInfinity } from '@/components/ui/morphing-infinity';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import {
  getZapflowComparativos,
  type ComparativoPeriodo,
  type ComparativosData,
} from '@/app/actions/zapflow-insights';
import { cn } from '@/lib/utils';
import { CompareBars } from './compare-bars';

const FILTROS: { value: ComparativoPeriodo; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: '7dias', label: '7 dias' },
  { value: '30dias', label: '30 dias' },
];

async function buscarComparativos(periodo: ComparativoPeriodo): Promise<ComparativosData> {
  const result = await getZapflowComparativos(periodo);
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Não foi possível carregar os comparativos.');
  }
  return result.data;
}

interface ComparativosSectionProps {
  initialData: ComparativosData;
  cacheScope: string;
  loadPeriodo?: (periodo: ComparativoPeriodo) => Promise<ComparativosData>;
}

export function ComparativosSection({
  initialData,
  cacheScope,
  loadPeriodo = buscarComparativos,
}: ComparativosSectionProps) {
  const [periodo, setPeriodo] = useState<ComparativoPeriodo>('hoje');
  const comparativosKey =
    periodo === 'hoje'
      ? null
      : (['zapflow-comparativos', cacheScope, periodo] as const);
  const {
    data: comparativosRemotos,
    error,
    isLoading,
    isValidating,
  } = useSWR(comparativosKey, ([, , periodoSelecionado]) => loadPeriodo(periodoSelecionado), {
    keepPreviousData: true,
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  });
  const atualizando = isLoading || isValidating;
  const comparativos = periodo === 'hoje' ? initialData : comparativosRemotos ?? initialData;

  useEffect(() => {
    if (error) {
      toast.error('Não foi possível atualizar o período.', {
        description: 'Os últimos dados carregados continuam visíveis.',
      });
    }
  }, [error]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-5 text-primary" aria-hidden="true" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Comparativos</h3>
        </div>

        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
          <span className="sr-only" role="status" aria-live="polite">
            {atualizando ? 'Atualizando comparativos.' : ''}
          </span>
          <span
            className="hidden min-w-24 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 sm:inline-flex"
            aria-hidden="true"
          >
            {atualizando ? (
              <>
                <MorphingInfinity className="size-3.5" aria-hidden="true" />
                Atualizando
              </>
            ) : null}
          </span>

          <div
            className="flex flex-1 rounded-xl border border-slate-200/70 bg-white/70 p-1 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60 sm:flex-none"
            role="group"
            aria-label="Período dos comparativos"
          >
            {FILTROS.map((filtro) => {
              const selecionado = periodo === filtro.value;
              return (
                <button
                  key={filtro.value}
                  type="button"
                  aria-pressed={selecionado}
                  onClick={() => setPeriodo(filtro.value)}
                  className={cn(
                    'inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors sm:flex-none',
                    selecionado
                      ? 'bg-primary text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                  )}
                >
                  {selecionado && atualizando ? (
                    <MorphingInfinity className="size-3 sm:hidden" aria-hidden="true" />
                  ) : null}
                  {filtro.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className={cn('grid gap-4 transition-opacity md:grid-cols-3', atualizando && 'opacity-60')}
        aria-busy={atualizando}
      >
        <CompareBars
          titulo={`Faturamento (${comparativos.periodoLabel.toLowerCase()})`}
          atualLabel={comparativos.atualLabel}
          anteriorLabel={comparativos.anteriorLabel}
          atual={comparativos.faturamento.atual}
          anterior={comparativos.faturamento.anterior}
          variacao={comparativos.faturamento.variacao}
          serie={comparativos.faturamento.serie}
          formato="moeda"
        />
        <CompareBars
          titulo="Ticket médio"
          atualLabel={comparativos.atualLabel}
          anteriorLabel={comparativos.anteriorLabel}
          atual={comparativos.ticketMedio.atual}
          anterior={comparativos.ticketMedio.anterior}
          variacao={comparativos.ticketMedio.variacao}
          serie={comparativos.ticketMedio.serie}
          formato="moeda"
        />
        <CompareBars
          titulo="Pedidos"
          atualLabel={comparativos.atualLabel}
          anteriorLabel={comparativos.anteriorLabel}
          atual={comparativos.pedidos.atual}
          anterior={comparativos.pedidos.anterior}
          variacao={comparativos.pedidos.variacao}
          serie={comparativos.pedidos.serie}
          formato="numero"
        />
      </div>
    </div>
  );
}
