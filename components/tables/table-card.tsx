'use client';

import React from 'react';
import { Users, Receipt, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type MesaComDetalhes } from '@/app/actions/tables';

interface TableCardProps {
  mesa: MesaComDetalhes;
  onClick: () => void;
}

export default function TableCard({ mesa, onClick }: TableCardProps) {
  const statusConfig = {
    livre: {
      bg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
      border: 'border-emerald-500/30',
      badge: 'bg-emerald-500',
      text: 'text-emerald-400',
      label: 'Livre',
    },
    ocupada: {
      bg: 'bg-amber-500/10 hover:bg-amber-500/20',
      border: 'border-amber-500/30',
      badge: 'bg-amber-500',
      text: 'text-amber-400',
      label: 'Ocupada',
    },
    reservada: {
      bg: 'bg-blue-500/10 hover:bg-blue-500/20',
      border: 'border-blue-500/30',
      badge: 'bg-blue-500',
      text: 'text-blue-400',
      label: 'Reservada',
    },
  };

  const config = statusConfig[mesa.status] || statusConfig.livre;

  const totalComandas = mesa.comandas.length;
  const totalPedidos = mesa.comandas.reduce((acc, c) => acc + c.pedidos.length, 0);

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative w-full p-4 rounded-xl border transition-all text-left',
        'focus:outline-none focus:ring-2 focus:ring-primary/50',
        config.bg,
        config.border
      )}
    >
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
