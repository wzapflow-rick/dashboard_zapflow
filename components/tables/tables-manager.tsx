'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Users, RefreshCw, Settings2, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import useSWR from 'swr';
import { getMesasComDetalhes, type MesaComDetalhes } from '@/app/actions/tables';
import { getDeliveryRates } from '@/app/actions/delivery';
import TableCard from './table-card';
import CreateTableModal from './create-table-modal';
import TableDetailModal from './table-detail-modal';

export default function TablesManager() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedMesa, setSelectedMesa] = useState<MesaComDetalhes | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'livre' | 'ocupada' | 'reservada'>('all');

  const { data: mesas = [], mutate, isLoading } = useSWR(
    'mesas-com-detalhes',
    getMesasComDetalhes,
    {
      refreshInterval: 10000,
      // Mantem os dados ja carregados na tela enquanto revalida (sem piscar o loading).
      keepPreviousData: true,
      // Em segundo plano (aba minimizada) nao revalida, economizando recursos em PCs fracos.
      revalidateOnFocus: true,
      revalidateIfStale: true,
    }
  );

  // Bairros configurados em Configuracoes > Entrega, para o select de taxa na mesa.
  const { data: bairros = [] } = useSWR('delivery-rates', getDeliveryRates, {
    revalidateOnFocus: false,
  });

  const filteredMesas = mesas.filter((mesa) => {
    if (filterStatus === 'all') return true;
    return mesa.status === filterStatus;
  });

  const stats = {
    total: mesas.length,
    livres: mesas.filter((m) => m.status === 'livre').length,
    ocupadas: mesas.filter((m) => m.status === 'ocupada').length,
    reservadas: mesas.filter((m) => m.status === 'reservada').length,
  };

  const handleRefresh = useCallback(() => {
    mutate();
  }, [mutate]);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Gerenciamento de Mesas</h1>
          <p className="text-slate-400 text-sm mt-1">
            Controle suas mesas e comandas em tempo real
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className={cn('size-4', isLoading && 'animate-spin')} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="size-4" />
            <span>Nova Mesa</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          label="Total de Mesas"
          value={stats.total}
          color="slate"
        />
        <StatsCard
          label="Livres"
          value={stats.livres}
          color="green"
          onClick={() => setFilterStatus(filterStatus === 'livre' ? 'all' : 'livre')}
          active={filterStatus === 'livre'}
        />
        <StatsCard
          label="Ocupadas"
          value={stats.ocupadas}
          color="amber"
          onClick={() => setFilterStatus(filterStatus === 'ocupada' ? 'all' : 'ocupada')}
          active={filterStatus === 'ocupada'}
        />
        <StatsCard
          label="Reservadas"
          value={stats.reservadas}
          color="blue"
          onClick={() => setFilterStatus(filterStatus === 'reservada' ? 'all' : 'reservada')}
          active={filterStatus === 'reservada'}
        />
      </div>

      {/* Filter indicator */}
      {filterStatus !== 'all' && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-slate-400">Filtrado por:</span>
          <span className="px-3 py-1 bg-slate-800 rounded-full text-sm font-medium capitalize">
            {filterStatus}
          </span>
          <button
            onClick={() => setFilterStatus('all')}
            className="text-slate-400 hover:text-white text-sm underline"
          >
            Limpar filtro
          </button>
        </div>
      )}

      {/* Mesas Grid */}
      {isLoading && mesas.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="size-8 text-primary animate-spin" />
            <span className="text-slate-400">Carregando mesas...</span>
          </div>
        </div>
      ) : filteredMesas.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-slate-800/50 rounded-xl border border-slate-700/50">
          <Users className="size-12 text-slate-600 mb-3" />
          <p className="text-slate-400 text-lg font-medium">
            {mesas.length === 0 ? 'Nenhuma mesa cadastrada' : 'Nenhuma mesa encontrada'}
          </p>
          <p className="text-slate-500 text-sm mt-1">
            {mesas.length === 0
              ? 'Clique em "Nova Mesa" para começar'
              : 'Tente remover os filtros aplicados'}
          </p>
          {mesas.length === 0 && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="size-4" />
              <span>Criar primeira mesa</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredMesas.map((mesa) => (
              <motion.div
                key={mesa.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <TableCard
                  mesa={mesa}
                  onClick={() => setSelectedMesa(mesa)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modals */}
      <CreateTableModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          mutate();
        }}
      />

      {selectedMesa && (
        <TableDetailModal
          mesa={mesas.find(m => m.id === selectedMesa.id) || selectedMesa}
          bairros={bairros}
          isOpen={!!selectedMesa}
          onClose={() => setSelectedMesa(null)}
          onUpdate={async () => {
            const newMesas = await mutate();
            if (newMesas) {
              const updatedMesa = newMesas.find(m => m.id === selectedMesa.id);
              if (updatedMesa) {
                setSelectedMesa(updatedMesa);
              } else {
                setSelectedMesa(null);
              }
            }
          }}
        />
      )}
    </div>
  );
}

function StatsCard({
  label,
  value,
  color,
  onClick,
  active,
}: {
  label: string;
  value: number;
  color: 'slate' | 'green' | 'amber' | 'blue';
  onClick?: () => void;
  active?: boolean;
}) {
  const colorClasses = {
    slate: 'bg-slate-800 border-slate-700',
    green: 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500',
    amber: 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500',
    blue: 'bg-blue-500/10 border-blue-500/30 hover:border-blue-500',
  };

  const valueColorClasses = {
    slate: 'text-white',
    green: 'text-emerald-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
  };

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'p-4 rounded-xl border transition-all text-left',
        colorClasses[color],
        onClick && 'cursor-pointer',
        active && 'ring-2 ring-white/20'
      )}
    >
      <p className="text-slate-400 text-sm">{label}</p>
      <p className={cn('text-2xl font-bold mt-1', valueColorClasses[color])}>{value}</p>
    </button>
  );
}
