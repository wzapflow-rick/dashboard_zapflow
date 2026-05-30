'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  X,
  Plus,
  Receipt,
  Trash2,
  Loader2,
  Check,
  UserPlus,
  ShoppingBag,
  DollarSign,
  Clock,
  AlertCircle,
  Printer,
  PlusCircle,
  ExternalLink,
  Pencil,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import {
  type MesaComDetalhes,
  type ComandaComPedidos,
  updateMesa,
  deleteMesa,
  createComanda,
  updateComanda,
  fecharMesa,
  abrirMesa,
} from '@/app/actions/tables';
import TableOrderModal from './table-order-modal';
import TablePrintModal from './table-print-modal';
import { AddExtraValueModal } from '@/components/expedition/add-extra-value-modal';
import EditOrderModal from '@/components/expedition/edit-order-modal';

interface TableDetailModalProps {
  mesa: MesaComDetalhes;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export default function TableDetailModal({
  mesa,
  isOpen,
  onClose,
  onUpdate,
}: TableDetailModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFecharMesaConfirm, setShowFecharMesaConfirm] = useState(false);
  const [showAddComanda, setShowAddComanda] = useState(false);
  const [newComandaNome, setNewComandaNome] = useState('');
  const [selectedComanda, setSelectedComanda] = useState<ComandaComPedidos | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printType, setPrintType] = useState<'mesa' | 'comanda'>('mesa');
  const [comandaToPrint, setComandaToPrint] = useState<ComandaComPedidos | null>(null);

  const handleAbrirMesa = async () => {
    setIsLoading(true);
    setError('');
    try {
      await abrirMesa(mesa.id);
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Erro ao abrir mesa');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFecharMesa = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await fecharMesa(mesa.id);
      alert(`Mesa fechada!\n\nTotal: R$ ${result.total.toFixed(2).replace('.', ',')}\nComandas: ${result.comandas}`);
      onUpdate();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao fechar mesa');
    } finally {
      setIsLoading(false);
      setShowFecharMesaConfirm(false);
    }
  };

  const handleAddComanda = async () => {
    if (!newComandaNome.trim() && mesa.comandas.length > 0) {
      setError('Informe o nome do cliente para a comanda');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await createComanda({
        mesa_id: mesa.id,
        nome_cliente: newComandaNome.trim() || undefined,
      });
      setNewComandaNome('');
      setShowAddComanda(false);
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar comanda');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFecharComanda = async (comanda: ComandaComPedidos) => {
    setIsLoading(true);
    setError('');
    try {
      await updateComanda(comanda.id, { status: 'paga' });
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Erro ao fechar comanda');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMesa = async () => {
    setIsLoading(true);
    setError('');
    try {
      await deleteMesa(mesa.id);
      onUpdate();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir mesa');
    } finally {
      setIsLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleUpdateStatus = async (newStatus: 'livre' | 'ocupada' | 'reservada') => {
    setIsLoading(true);
    setError('');
    try {
      await updateMesa(mesa.id, { status: newStatus });
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNovoPedido = (comanda: ComandaComPedidos) => {
    setSelectedComanda(comanda);
    setShowOrderModal(true);
  };

  // Contar pedidos pendentes ou preparando (aguardando no kanban)
  const pedidosPendentes = mesa.comandas.reduce((acc, c) => {
    return acc + c.pedidos.filter((p: any) => 
      p.status === 'pendente' || p.status === 'preparando'
    ).length;
  }, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-slate-800 shadow-xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Mesa {mesa.numero}
                </h2>
                {mesa.nome && (
                  <p className="text-sm text-slate-400">{mesa.nome}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {pedidosPendentes > 0 && (
                  <Link
                    href="/dashboard/expedition"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors text-sm"
                    title="Ver pedidos no painel de expedicao"
                  >
                    <span className="font-semibold">{pedidosPendentes}</span>
                    <span className="hidden sm:inline">no Kanban</span>
                    <ExternalLink className="size-3.5" />
                  </Link>
                )}
                <button
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Status */}
              <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                <p className="text-sm text-slate-400 mb-2">Status da Mesa</p>
                <div className="flex gap-2">
                  <StatusButton
                    label="Livre"
                    active={mesa.status === 'livre'}
                    color="green"
                    onClick={() => handleUpdateStatus('livre')}
                    disabled={isLoading || mesa.comandas.length > 0}
                  />
                  <StatusButton
                    label="Ocupada"
                    active={mesa.status === 'ocupada'}
                    color="amber"
                    onClick={() => handleUpdateStatus('ocupada')}
                    disabled={isLoading}
                  />
                  <StatusButton
                    label="Reservada"
                    active={mesa.status === 'reservada'}
                    color="blue"
                    onClick={() => handleUpdateStatus('reservada')}
                    disabled={isLoading || mesa.comandas.length > 0}
                  />
                </div>
              </div>

              {/* Comandas Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Receipt className="size-4" />
                    Comandas
                  </h3>
                  {mesa.status !== 'livre' && (
                    <button
                      onClick={() => setShowAddComanda(true)}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                    >
                      <UserPlus className="size-3.5" />
                      Nova Comanda
                    </button>
                  )}
                </div>

                {/* Add Comanda Form */}
                <AnimatePresence>
                  {showAddComanda && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-3"
                    >
                      <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/50 space-y-3">
                        <input
                          type="text"
                          value={newComandaNome}
                          onChange={(e) => setNewComandaNome(e.target.value)}
                          placeholder="Nome do cliente (opcional se for a primeira)"
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setShowAddComanda(false);
                              setNewComandaNome('');
                            }}
                            className="flex-1 px-3 py-1.5 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={handleAddComanda}
                            disabled={isLoading}
                            className="flex-1 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            {isLoading ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <>
                                <Plus className="size-3.5" />
                                Criar
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Comandas List */}
                {mesa.comandas.length === 0 ? (
                  <div className="p-6 bg-slate-900/30 rounded-lg border border-dashed border-slate-700 text-center">
                    <Receipt className="size-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">
                      {mesa.status === 'livre'
                        ? 'Abra a mesa para criar comandas'
                        : 'Nenhuma comanda aberta'}
                    </p>
                    {mesa.status === 'livre' && (
                      <button
                        onClick={handleAbrirMesa}
                        disabled={isLoading}
                        className="mt-3 px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50"
                      >
                        Abrir Mesa
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mesa.comandas.map((comanda) => (
                      <ComandaCard
                        key={comanda.id}
                        comanda={comanda}
                        onNovoPedido={() => handleNovoPedido(comanda)}
                        onFechar={() => handleFecharComanda(comanda)}
                        onPrint={() => {
                          setComandaToPrint(comanda);
                          setPrintType('comanda');
                          setShowPrintModal(true);
                        }}
                        isLoading={isLoading}
                        mesaNumero={mesa.numero}
                        onRefresh={onUpdate}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Resumo */}
              {mesa.total_mesa > 0 && (
                <div className="p-4 bg-primary/10 rounded-xl border border-primary/30">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-slate-300">Total da Mesa</span>
                    <span className="text-xl font-bold text-primary">
                      R$ {mesa.total_mesa.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setPrintType('mesa');
                      setComandaToPrint(null);
                      setShowPrintModal(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    <Printer className="size-4" />
                    Imprimir Conta da Mesa
                  </button>
                </div>
              )}

              {/* Danger Zone */}
              <div className="pt-4 border-t border-slate-700">
                <p className="text-xs text-slate-500 mb-2">Zona de Perigo</p>
                <div className="flex gap-2">
                  {mesa.comandas.length > 0 && (
                    <button
                      onClick={() => setShowFecharMesaConfirm(true)}
                      disabled={isLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 disabled:opacity-50"
                    >
                      <DollarSign className="size-4" />
                      <span className="text-sm">Fechar Mesa</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isLoading || mesa.comandas.length > 0}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 disabled:opacity-50"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Delete Confirmation */}
            <AnimatePresence>
              {showDeleteConfirm && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-slate-900/95 flex items-center justify-center p-4"
                >
                  <div className="text-center">
                    <Trash2 className="size-12 text-red-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Excluir Mesa {mesa.numero}?
                    </h3>
                    <p className="text-slate-400 text-sm mb-6">
                      Esta acao nao pode ser desfeita.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleDeleteMesa}
                        disabled={isLoading}
                        className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                      >
                        {isLoading ? 'Excluindo...' : 'Excluir'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Fechar Mesa Confirmation */}
            <AnimatePresence>
              {showFecharMesaConfirm && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-slate-900/95 flex items-center justify-center p-4"
                >
                  <div className="text-center max-w-sm">
                    <DollarSign className="size-12 text-amber-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Fechar Mesa {mesa.numero}?
                    </h3>
                    <p className="text-slate-400 text-sm mb-2">
                      Todas as comandas serao encerradas.
                    </p>
                    <div className="p-3 bg-slate-800 rounded-lg mb-4">
                      <p className="text-2xl font-bold text-primary">
                        R$ {mesa.total_mesa.toFixed(2).replace('.', ',')}
                      </p>
                      <p className="text-xs text-slate-500">
                        {mesa.comandas.length} comanda{mesa.comandas.length !== 1 ? 's' : ''} aberta{mesa.comandas.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowFecharMesaConfirm(false)}
                        className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleFecharMesa}
                        disabled={isLoading}
                        className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                      >
                        {isLoading ? 'Fechando...' : 'Confirmar'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Order Modal */}
          {showOrderModal && selectedComanda && (
            <TableOrderModal
              isOpen={showOrderModal}
              onClose={() => {
                setShowOrderModal(false);
                setSelectedComanda(null);
              }}
              comanda={selectedComanda}
              mesa={mesa}
              onSuccess={() => {
                setShowOrderModal(false);
                setSelectedComanda(null);
                onUpdate();
              }}
            />
          )}

          {/* Print Modal */}
          {showPrintModal && (
            <TablePrintModal
              isOpen={showPrintModal}
              onClose={() => {
                setShowPrintModal(false);
                setComandaToPrint(null);
              }}
              mesa={mesa}
              comanda={comandaToPrint || undefined}
              tipo={printType}
            />
          )}
        </>
      )}
    </AnimatePresence>
  );
}

function StatusButton({
  label,
  active,
  color,
  onClick,
  disabled,
}: {
  label: string;
  active: boolean;
  color: 'green' | 'amber' | 'blue';
  onClick: () => void;
  disabled?: boolean;
}) {
  const colorClasses = {
    green: active
      ? 'bg-emerald-500 text-white'
      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20',
    amber: active
      ? 'bg-amber-500 text-white'
      : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20',
    blue: active
      ? 'bg-blue-500 text-white'
      : 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        colorClasses[color]
      )}
    >
      {label}
    </button>
  );
}

function ComandaCard({
  comanda,
  onNovoPedido,
  onFechar,
  onPrint,
  isLoading,
  mesaNumero,
  onRefresh,
}: {
  comanda: ComandaComPedidos;
  onNovoPedido: () => void;
  onFechar: () => void;
  onPrint: () => void;
  isLoading: boolean;
  mesaNumero: number;
  onRefresh?: () => void;
}) {
  const [showItens, setShowItens] = useState(false);
  const [showAddValueModal, setShowAddValueModal] = useState(false);
  const [showEditOrderModal, setShowEditOrderModal] = useState(false);
  const [selectedOrderToEdit, setSelectedOrderToEdit] = useState<any>(null);
  
  // Pega o primeiro pedido ativo da comanda para adicionar valor
  const pedidoAtivo = comanda.pedidos.find(p => p.status !== 'finalizado' && p.status !== 'cancelado') || comanda.pedidos[0];
  
  const totalComanda = comanda.pedidos.reduce(
    (acc, p) => acc + (Number(p.valor_total) || 0),
    0
  );

  // Extrair todos os itens de todos os pedidos
  const todosItens = comanda.pedidos.flatMap((pedido: any) => {
    try {
      const itens = typeof pedido.itens === 'string' ? JSON.parse(pedido.itens) : pedido.itens;
      return Array.isArray(itens) ? itens.map((item: any) => ({
        ...item,
        pedidoId: pedido.id,
        pedidoStatus: pedido.status,
      })) : [];
    } catch {
      return [];
    }
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/50 hover:border-slate-600/50 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Receipt className="size-4 text-slate-400" />
          <span className="text-sm font-medium text-white">
            {comanda.nome_cliente || `Comanda ${comanda.id}`}
          </span>
          {todosItens.length > 0 && (
            <span className="px-1.5 py-0.5 bg-slate-700 text-slate-300 text-[10px] rounded">
              {todosItens.length} {todosItens.length === 1 ? 'item' : 'itens'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pedidoAtivo && comanda.status === 'aberta' && (
            <motion.button
              onClick={() => setShowAddValueModal(true)}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              className="size-6 flex items-center justify-center rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
              title="Adicionar valor extra"
            >
              <PlusCircle className="size-3.5" />
            </motion.button>
          )}
          <span className="text-sm font-semibold text-primary">
            R$ {totalComanda.toFixed(2).replace('.', ',')}
          </span>
        </div>
      </div>

      {/* Itens da comanda (expandível) */}
      {todosItens.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setShowItens(!showItens)}
            className="w-full text-left text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1 mb-1"
          >
            <span className={`transition-transform ${showItens ? 'rotate-90' : ''}`}>▶</span>
            {showItens ? 'Ocultar itens' : 'Ver itens'}
          </button>
          
          <AnimatePresence>
            {showItens && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1 mt-2"
              >
                {todosItens.map((item: any, idx: number) => (
                  <div
                    key={`${item.pedidoId}-${idx}`}
                    className="flex flex-col text-xs py-1.5 px-2 bg-slate-800/50 rounded"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-slate-500">{item.quantidade}x</span>
                        <span className="text-slate-200 truncate">{item.produto || item.nome}</span>
                        <span className={cn(
                          'px-1 py-0.5 rounded text-[9px] font-medium capitalize shrink-0',
                          item.pedidoStatus === 'pendente' && 'bg-amber-500/20 text-amber-400',
                          item.pedidoStatus === 'preparando' && 'bg-blue-500/20 text-blue-400',
                          item.pedidoStatus === 'pronto' && 'bg-emerald-500/20 text-emerald-400',
                          item.pedidoStatus === 'finalizado' && 'bg-slate-500/20 text-slate-400'
                        )}>
                          {item.pedidoStatus}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 shrink-0">
                          R$ {((Number(item.preco_unitario) || 0) * (item.quantidade || 1)).toFixed(2).replace('.', ',')}
                        </span>
                        {item.pedidoStatus !== 'finalizado' && item.pedidoStatus !== 'cancelado' && (
                          <button
                            onClick={() => {
                              const pedido = comanda.pedidos.find((p: any) => p.id === item.pedidoId);
                              if (pedido) {
                                setSelectedOrderToEdit(pedido);
                                setShowEditOrderModal(true);
                              }
                            }}
                            className="size-5 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
                            title="Editar pedido"
                          >
                            <Pencil className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    {item.observacao && (
                      <p className="text-[10px] text-amber-400 mt-1 ml-6 italic">
                        OBS: {item.observacao}
                      </p>
                    )}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Pedidos resumo */}
      {comanda.pedidos.length > 0 && !showItens && (
        <div className="mb-3 flex flex-wrap gap-1">
          {comanda.pedidos.map((pedido: any) => (
            <button
              key={pedido.id}
              onClick={() => {
                if (pedido.status !== 'finalizado' && pedido.status !== 'cancelado') {
                  setSelectedOrderToEdit(pedido);
                  setShowEditOrderModal(true);
                }
              }}
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors',
                pedido.status === 'pendente' && 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30',
                pedido.status === 'preparando' && 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30',
                pedido.status === 'pronto' && 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30',
                pedido.status === 'finalizado' && 'bg-slate-500/20 text-slate-400 cursor-default'
              )}
              title={pedido.status !== 'finalizado' && pedido.status !== 'cancelado' ? 'Clique para editar' : ''}
            >
              #{pedido.id} - {pedido.status}
              {pedido.status !== 'finalizado' && pedido.status !== 'cancelado' && (
                <Pencil className="size-2.5" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <motion.button
          onClick={onNovoPedido}
          disabled={isLoading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary text-sm rounded-lg hover:bg-primary/20 hover:shadow-lg hover:shadow-primary/10 disabled:opacity-50 transition-all"
        >
          <ShoppingBag className="size-3.5" />
          Novo Pedido
        </motion.button>
        <motion.button
          onClick={onPrint}
          disabled={isLoading}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-700 text-slate-300 text-sm rounded-lg hover:bg-slate-600 disabled:opacity-50 transition-colors"
          title="Imprimir comanda"
        >
          <Printer className="size-3.5" />
        </motion.button>
        <motion.button
          onClick={onFechar}
          disabled={isLoading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-700 text-slate-300 text-sm rounded-lg hover:bg-slate-600 disabled:opacity-50 transition-colors"
        >
          <Check className="size-3.5" />
          Pagar
        </motion.button>
      </div>

      {/* Modal para adicionar valor extra */}
      {pedidoAtivo && (
        <AddExtraValueModal
          isOpen={showAddValueModal}
          onClose={() => setShowAddValueModal(false)}
          orderId={pedidoAtivo.id}
          orderNumber={`Mesa ${mesaNumero} - ${comanda.nome_cliente || 'Comanda'}`}
          onSuccess={() => {
            onRefresh?.();
          }}
        />
      )}

      {/* Modal para editar pedido */}
      {selectedOrderToEdit && (
        <EditOrderModal
          isOpen={showEditOrderModal}
          onClose={() => {
            setShowEditOrderModal(false);
            setSelectedOrderToEdit(null);
          }}
          order={selectedOrderToEdit}
          onSuccess={() => {
            setShowEditOrderModal(false);
            setSelectedOrderToEdit(null);
            onRefresh?.();
          }}
        />
      )}
    </motion.div>
  );
}
