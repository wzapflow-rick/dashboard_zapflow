'use client';

import React from 'react';
import { Users, Receipt, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type MesaComDetalhes } from '@/app/actions/tables';

interface TableCardProps {
  mesa: MesaComDetalhes;
  onSelect: (mesa: MesaComDetalhes) => void;
}

// Config estatica movida para fora do componente: evita recriar o objeto
// a cada render de cada card.
const STATUS_CONFIG = {
  livre: {
    bg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500',
    text: 'text-emerald-400',
    label: 'Livre',
    glow: 'hover:shadow-emerald-500/20',
    glowAnim: false,
  },
  ocupada: {
    bg: 'bg-amber-500/10 hover:bg-amber-500/15',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500',
    text: 'text-amber-400',
    label: 'Ocupada',
    glow: 'shadow-amber-500/15 hover:shadow-amber-500/25',
    glowAnim: true,
  },
  reservada: {
    bg: 'bg-blue-500/10 hover:bg-blue-500/20',
    border: 'border-blue-500/30',
    badge: 'bg-blue-500',
    text: 'text-blue-400',
    label: 'Reservada',
    glow: 'shadow-blue-500/15 hover:shadow-blue-500/25',
    glowAnim: false,
  },
} as const;

function TableCard({ mesa, onSelect }: TableCardProps) {
  const config = STATUS_CONFIG[mesa.status] || STATUS_CONFIG.livre;

  const totalComandas = mesa.comandas.length;
  const totalPedidos = mesa.comandas.reduce((acc, c) => acc + c.pedidos.length, 0);

  // Contar pedidos pendentes ou preparando (aguardando no kanban)
  const pedidosPendentes = mesa.comandas.reduce((acc, c) => {
    return acc + c.pedidos.filter((p: any) =>
      p.status === 'pendente' || p.status === 'preparando'
    ).length;
  }, 0);

  return (
    <button
      type="button"
      onClick={() => onSelect(mesa)}
      className={cn(
        'animate-table-in relative w-full p-4 rounded-xl border text-left shadow-lg',
        'focus:outline-none focus:ring-2 focus:ring-primary/50',
        // Transicoes e transforms feitos em CSS (GPU): baratos em telas fracas.
        'transition-transform transition-colors duration-200 will-change-transform',
        'hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98]',
        config.bg,
        config.border,
        config.glow,
        config.glowAnim && 'animate-table-glow',
        pedidosPendentes > 0 && 'ring-2 ring-red-500/50'
      )}
    >
      {/* Badge de pedidos pendentes (pulse via CSS) */}
      {pedidosPendentes > 0 && (
        <div className="absolute -top-2 -right-2 flex items-center justify-center size-6 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg shadow-red-500/30 animate-pulse">
          {pedidosPendentes}
        </div>
      )}

      {/* Status Badge */}
      <div className="absolute top-3 right-3">
        <span
          className={cn(
            'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white',
            config.badge
          )}
        >
          {config.label}
        </span>
      </div>

      {/* Mesa Number */}
      <div className="mb-3">
        <span className="text-3xl font-bold text-white">
          {mesa.numero}
        </span>
        {mesa.nome && (
          <p className="text-sm text-slate-400 mt-0.5 truncate">
            {mesa.nome}
          </p>
        )}
      </div>

      {/* Info Grid */}
      {mesa.status === 'ocupada' && (
        <div className="space-y-2 pt-2 border-t border-slate-700/50">
          {/* Comandas */}
          <div className="flex items-center gap-2 text-slate-400">
            <Receipt className="size-3.5" />
            <span className="text-xs">
              {totalComandas} comanda{totalComandas !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Pedidos ativos */}
          {totalPedidos > 0 && (
            <div className="flex items-center gap-2 text-slate-400">
              <Clock className="size-3.5" />
              <span className="text-xs">
                {totalPedidos} pedido{totalPedidos !== 1 ? 's' : ''} em andamento
              </span>
            </div>
          )}

          {/* Total */}
          {mesa.total_mesa > 0 && (
            <div className={cn('text-sm font-semibold mt-2', config.text)}>
              R$ {mesa.total_mesa.toFixed(2).replace('.', ',')}
            </div>
          )}
        </div>
      )}

      {/* Capacidade (quando livre) */}
      {mesa.status === 'livre' && mesa.capacidade && (
        <div className="flex items-center gap-2 text-slate-500 mt-2">
          <Users className="size-3.5" />
          <span className="text-xs">
            {mesa.capacidade} lugares
          </span>
        </div>
      )}
    </button>
  );
}

// React.memo evita re-render de cards cujos dados nao mudaram entre
// atualizacoes da lista (o pai revalida via SWR a cada 10s).
export default React.memo(TableCard);
