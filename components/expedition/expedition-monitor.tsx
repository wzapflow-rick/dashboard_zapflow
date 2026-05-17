import React, { useState, useEffect, useCallback } from 'react';
import { Search, Printer, Eye, WifiOff, RefreshCw, CloudOff, Cloud, Keyboard } from 'lucide-react';
import dynamic from 'next/dynamic';
import { KanbanColumn } from '@/components/expedition/kanban-column';
import { getOrders, updateOrderStatus, verificarEstoqueDoPedido } from '@/app/actions/orders';
import RegisterCustomerModal from '@/components/expedition/register-customer-modal';
import StockWarningModal from '@/components/expedition/stock-warning-modal';
import OrderDetailsModal from '@/components/expedition/order-details-modal';
import EditOrderModal from '@/components/expedition/edit-order-modal';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import OrderCreatorModal from '@/components/modals/order-creator-modal';
import { useOffline } from '@/hooks/use-offline';

const PrintModal = dynamic(() => import('@/components/expedition/print-modal'), {
  ssr: false,
});

const CancelOrderModal = dynamic(() => import('@/components/expedition/cancel-order-modal'), {
  ssr: false,
});

const columns = [
  { id: 'agendado', title: 'Agendados', color: 'violet' },
  { id: 'pagamento_pendente', title: 'Aguardando Pagamento', color: 'orange' },
  { id: 'pendente', title: 'Novos Pedidos', color: 'red' },
  { id: 'preparando', title: 'Preparando', color: 'amber' },
  { id: 'entrega', title: 'Saiu para Entrega', color: 'blue' },
  { id: 'finalizado', title: 'Concluídos', color: 'green' },
  { id: 'cancelado', title: 'Cancelados', color: 'gray' },
];

export default function ExpeditionMonitor() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<any>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedOrderForRegister, setSelectedOrderForRegister] = useState<any>(null);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockShortages, setStockShortages] = useState<any[]>([]);
  const [stockClient, setStockClient] = useState<{ nome: string, telefone: string } | null>(null);
  const [pendingMove, setPendingMove] = useState<{ id: number, nextStatus: string } | null>(null);
  const [isOrderCreatorOpen, setIsOrderCreatorOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<any>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<number | null>(null);
  const [usingCache, setUsingCache] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<any>(null);

  // Hook de offline
  const { 
    isOnline, 
    isOfflineReady, 
    pendingCount, 
    getCachedOrders, 
    cacheOrders: saveOrdersToCache,
    forceSync,
    isSyncing 
  } = useOffline();

  const loadOrders = useCallback(async () => {
    try {
      // Tenta buscar do servidor
      const data = await getOrders();
      setOrders(data || []);
      setUsingCache(false);
      
      // Salva no cache para uso offline
      if (isOfflineReady && data && data.length > 0) {
        await saveOrdersToCache(data.map((o: any) => ({
          id: o.id,
          codigo: o.codigo,
          status: o.status,
          cliente_nome: o.cliente_nome,
          cliente_telefone: o.cliente_telefone,
          total: o.total,
          created_at: o.created_at,
          items: o.items,
          endereco: o.endereco,
          observacao: o.observacao,
        })));
      }
    } catch (err) {
      console.error('Erro ao carregar pedidos:', err);
      
      // Se falhar e tivermos cache, usa os dados do cache
      if (isOfflineReady) {
        try {
          const cachedData = await getCachedOrders();
          if (cachedData && cachedData.length > 0) {
            setOrders(cachedData);
            setUsingCache(true);
            toast.warning('Usando dados offline. Algumas informacoes podem estar desatualizadas.');
          }
        } catch (cacheErr) {
          console.error('Erro ao buscar cache:', cacheErr);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [isOfflineReady, getCachedOrders, saveOrdersToCache]);

  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      oscillator.start();
      setTimeout(() => {
        oscillator.frequency.value = 1000;
      }, 100);
      setTimeout(() => {
        oscillator.stop();
      }, 200);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    loadOrders();

    // Polling para novos pedidos a cada 10 segundos (apenas se online)
    const interval = setInterval(() => {
      if (isOnline) {
        loadOrders();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [loadOrders, isOnline]);

  // Tenta sincronizar quando voltar online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      toast.info(`Sincronizando ${pendingCount} operacao(oes) pendente(s)...`);
      forceSync().then((result) => {
        if (result.processed > 0) {
          toast.success(`${result.processed} operacao(oes) sincronizada(s)!`);
          loadOrders(); // Recarrega para pegar dados atualizados
        }
      });
    }
  }, [isOnline, pendingCount, forceSync, loadOrders]);

  // Referencia para rastrear pedidos anteriores (para detectar novos)
  const prevOrdersRef = React.useRef<any[]>([]);

  // Som de notificacao para NOVOS pedidos chegando
  useEffect(() => {
    if (orders.length > 0 && prevOrdersRef.current.length > 0) {
      const prevIds = new Set(prevOrdersRef.current.map(o => o.id));
      const newOrders = orders.filter(o => !prevIds.has(o.id) && o.status === 'pendente');
      
      if (newOrders.length > 0) {
        // Toca som para novos pedidos
        playNotificationSound();
        toast.success(`${newOrders.length} novo(s) pedido(s) chegou!`, {
          duration: 5000,
        });
      }
    }
    prevOrdersRef.current = orders;
  }, [orders]);

  // Filtra pedidos pela busca
  const filteredOrders = React.useMemo(() => {
    if (!searchQuery.trim()) return orders;
    
    const query = searchQuery.toLowerCase().trim();
    return orders.filter(order => {
      const clienteName = (order.cliente_nome || '').toLowerCase();
      const clientePhone = (order.telefone_cliente || order.cliente_telefone || '').toLowerCase();
      const orderId = String(order.id || '');
      const codigo = String(order.codigo || '').toLowerCase();
      const mesa = order.numero_mesa ? `mesa ${order.numero_mesa}` : '';
      
      return (
        clienteName.includes(query) ||
        clientePhone.includes(query) ||
        orderId.includes(query) ||
        codigo.includes(query) ||
        mesa.includes(query)
      );
    });
  }, [orders, searchQuery]);

  // Atalhos de teclado para navegacao no kanban
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar se estiver digitando em input ou textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ignorar se algum modal estiver aberto
      if (isPrintModalOpen || isRegisterModalOpen || isStockModalOpen || isOrderCreatorOpen || isDetailsOpen || isCancelModalOpen || isEditModalOpen) {
        return;
      }

      // Pedidos ativos (exceto finalizados e cancelados) ordenados por coluna e posicao
      const activeOrders = filteredOrders.filter(o => 
        o.status !== 'finalizado' && o.status !== 'cancelado'
      );

      if (activeOrders.length === 0) return;

      const currentIndex = selectedOrderId 
        ? activeOrders.findIndex(o => o.id === selectedOrderId)
        : -1;

      switch (e.key) {
        case 'ArrowDown':
        case 'j': // Vim-style
          e.preventDefault();
          if (currentIndex === -1) {
            setSelectedOrderId(activeOrders[0]?.id || null);
          } else if (currentIndex < activeOrders.length - 1) {
            setSelectedOrderId(activeOrders[currentIndex + 1].id);
          }
          break;

        case 'ArrowUp':
        case 'k': // Vim-style
          e.preventDefault();
          if (currentIndex === -1) {
            setSelectedOrderId(activeOrders[activeOrders.length - 1]?.id || null);
          } else if (currentIndex > 0) {
            setSelectedOrderId(activeOrders[currentIndex - 1].id);
          }
          break;

        case 'Enter':
          e.preventDefault();
          if (selectedOrderId) {
            const selectedOrder = activeOrders.find(o => o.id === selectedOrderId);
            if (selectedOrder) {
              handleMoveOrder(selectedOrder.id, selectedOrder.status);
            }
          }
          break;

        case 'Escape':
          e.preventDefault();
          setSelectedOrderId(null);
          break;

        case 'p':
        case 'P':
          e.preventDefault();
          if (selectedOrderId) {
            const selectedOrder = orders.find(o => o.id === selectedOrderId);
            if (selectedOrder) {
              openPrintModal(selectedOrder);
            }
          }
          break;

        case 'e':
        case 'E':
          e.preventDefault();
          if (selectedOrderId) {
            const selectedOrder = orders.find(o => o.id === selectedOrderId);
            if (selectedOrder && (selectedOrder.status === 'pendente' || selectedOrder.status === 'preparando')) {
              openEditModal(selectedOrder);
            }
          }
          break;

        case 'd':
        case 'D':
          e.preventDefault();
          if (selectedOrderId) {
            const selectedOrder = orders.find(o => o.id === selectedOrderId);
            if (selectedOrder) {
              openDetailsModal(selectedOrder);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredOrders, selectedOrderId, isPrintModalOpen, isRegisterModalOpen, isStockModalOpen, isOrderCreatorOpen, isDetailsOpen, isCancelModalOpen, isEditModalOpen]);

  const handleMoveOrder = async (orderId: number, currentStatus: string) => {
    const statusFlow: { [key: string]: string } = {
      'agendado': 'pagamento_pendente',
      'pagamento_pendente': 'pendente',
      'pendente': 'preparando',
      'preparando': 'entrega',
      'entrega': 'finalizado'
    };

    const nextStatus = statusFlow[currentStatus];
    if (!nextStatus) return;

    // Não permitir mover pedidos cancelados
    if (currentStatus === 'cancelado') return;

    // Tocar som ao confirmar pagamento
    if (currentStatus === 'pagamento_pendente') {
      playNotificationSound();
    }

    // VALIDAÇÃO DE ESTOQUE: Se estiver indo para "preparando"
    if (nextStatus === 'preparando') {
      try {
        const validation = await verificarEstoqueDoPedido(orderId);
        if (!validation.hasEnough) {
          setStockShortages(validation.shortages);
          setStockClient(validation.cliente || null);
          setPendingMove({ id: orderId, nextStatus });
          setIsStockModalOpen(true);
          return;
        }
      } catch (err) {
        console.error('Erro ao validar estoque:', err);
      }
    }

    await executeMove(orderId, nextStatus);
  };

  const executeMove = async (orderId: number, nextStatus: string) => {
    try {
      // Atualização otimista
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: nextStatus } : o));

      // Persistir no banco
      await updateOrderStatus(orderId, nextStatus);

      if (nextStatus === 'finalizado') {
        toast.success('Pedido finalizado e estoque deduzido!');
      }
    } catch (err) {
      console.error('Erro ao mover pedido:', err);
      loadOrders();
    }
  };

  const openPrintModal = (order: any) => {
    setSelectedOrderForPrint(JSON.parse(JSON.stringify(order)));
    setIsPrintModalOpen(true);
  };

  const openRegisterModal = (order: any) => {
    setSelectedOrderForRegister(JSON.parse(JSON.stringify(order)));
    setIsRegisterModalOpen(true);
  };

  const openDetailsModal = (order: any) => {
    setSelectedOrderForDetails(JSON.parse(JSON.stringify(order)));
    setIsDetailsOpen(true);
  };

  const openEditModal = (order: any) => {
    setSelectedOrderForEdit(JSON.parse(JSON.stringify(order)));
    setIsEditModalOpen(true);
  };

  const handleCancelOrder = (orderId: number) => {
    setOrderToCancel(orderId);
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancel = async (motivo: string) => {
    if (!orderToCancel) return;

    try {
      await updateOrderStatus(orderToCancel, 'cancelado', motivo);
      toast.success('Pedido cancelado!');

      loadOrders();
      setIsCancelModalOpen(false);
      setOrderToCancel(null);
    } catch (err) {
      console.error('Erro ao cancelar pedido:', err);
      toast.error('Erro ao cancelar pedido');
    }
  };

  const handleConfirmPrint = () => {
    console.log(`Imprimindo pedido ${selectedOrderForPrint?.id}`);
    setIsPrintModalOpen(false);
    setSelectedOrderForPrint(null);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-white dark:bg-slate-950">
      <header className="h-auto min-h-16 border-b border-slate-200 dark:border-slate-800/50 bg-white dark:bg-gradient-to-r dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 px-4 sm:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 rounded-t-xl shadow-sm dark:shadow-2xl dark:shadow-black/30">
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-4">
            <h2 className="text-lg sm:text-xl font-bold text-slate-950 dark:text-white dark:font-extrabold">
              Monitor de Expedição
            </h2>
            {isOnline ? (
              <span className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-gradient-to-r dark:from-emerald-900/75 dark:to-teal-500/25 text-[10px] sm:text-xs font-bold text-slate-700 dark:text-emerald-300 uppercase tracking-wide border border-slate-200 dark:border-emerald-500/50 backdrop-blur-sm flex items-center gap-1.5">
                <Cloud className="size-3" />
                Live
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-full bg-amber-100 dark:bg-gradient-to-r dark:from-amber-900/75 dark:to-orange-500/25 text-[10px] sm:text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wide border border-amber-200 dark:border-amber-500/50 backdrop-blur-sm flex items-center gap-1.5 animate-pulse">
                <CloudOff className="size-3" />
                Offline
              </span>
            )}
            {usingCache && (
              <span className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/50 text-[10px] font-medium text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/50">
                Cache
              </span>
            )}
            {pendingCount > 0 && (
              <span className="px-2 py-1 rounded-full bg-orange-100 dark:bg-orange-900/50 text-[10px] font-medium text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-500/50 flex items-center gap-1">
                <RefreshCw className={`size-3 ${isSyncing ? 'animate-spin' : ''}`} />
                {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button className="sm:hidden size-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200 hover:shadow-lg">
            <Printer className="size-5" />
          </button>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 size-4 pointer-events-none" />
            <input
              className="pl-9 pr-3 h-9 w-full sm:w-64 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 dark:focus:ring-blue-500/40 dark:focus:border-blue-500/50 outline-none transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-600/50"
              placeholder="Buscar pedido..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => setIsOrderCreatorOpen(true)}
            className="h-9 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-500 dark:hover:to-blue-600 text-white text-xs font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-blue-500/30 dark:shadow-blue-500/20 uppercase tracking-wider transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/40 dark:hover:shadow-blue-500/30 active:scale-95"
          >
            <Plus className="size-4" />
            Novo Pedido
          </button>
          <div className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 text-[10px] text-slate-500 dark:text-slate-400" title="Atalhos de teclado: ↑↓ navegar, Enter mover, P imprimir, E editar, D detalhes, Esc limpar">
            <Keyboard className="size-3.5" />
            <span className="font-medium">↑↓</span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="font-medium">Enter</span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="font-medium">P E D</span>
          </div>
          <button className="hidden sm:flex size-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200 hover:shadow-lg">
            <Printer className="size-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-x-auto p-4 sm:p-6 flex gap-4 sm:gap-6 bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 rounded-b-xl border-x border-b border-slate-200 dark:border-slate-800/50 custom-scrollbar">
        {columns.map((col) => {
          const columnOrders = filteredOrders.filter(o => o.status === col.id);
          return (
            <KanbanColumn
              key={col.id}
              col={col}
              columnOrders={columnOrders}
              onOpenPrintModal={openPrintModal}
              onMoveOrder={handleMoveOrder}
              onRegisterCustomer={openRegisterModal}
              onOpenDetails={openDetailsModal}
              onCancelOrder={handleCancelOrder}
              onEditOrder={openEditModal}
              selectedOrderId={selectedOrderId}
              onSelectOrder={setSelectedOrderId}
            />
          );
        })}
      </div>

      {isPrintModalOpen && (
        <PrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          order={selectedOrderForPrint}
        />
      )}

      {isRegisterModalOpen && (
        <RegisterCustomerModal
          isOpen={isRegisterModalOpen}
          onClose={() => {
            setIsRegisterModalOpen(false);
            setSelectedOrderForRegister(null);
          }}
          order={selectedOrderForRegister}
          onSuccess={loadOrders}
        />
      )}

      {isStockModalOpen && (
        <StockWarningModal
          isOpen={isStockModalOpen}
          onClose={() => {
            setIsStockModalOpen(false);
            setPendingMove(null);
          }}
          onConfirm={() => {
            if (pendingMove) {
              executeMove(pendingMove.id, pendingMove.nextStatus);
            }
            setIsStockModalOpen(false);
            setPendingMove(null);
          }}
          shortages={stockShortages}
          orderId={pendingMove?.id || 0}
          cliente={stockClient}
        />
      )}

      {isOrderCreatorOpen && (
        <OrderCreatorModal
          isOpen={isOrderCreatorOpen}
          onClose={() => setIsOrderCreatorOpen(false)}
          onSuccess={loadOrders}
        />
      )}

      {isDetailsOpen && (
        <OrderDetailsModal
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedOrderForDetails(null);
          }}
          order={selectedOrderForDetails}
        />
      )}

      {isCancelModalOpen && (
        <CancelOrderModal
          isOpen={isCancelModalOpen}
          onClose={() => {
            setIsCancelModalOpen(false);
            setOrderToCancel(null);
          }}
          onConfirm={handleConfirmCancel}
          orderId={orderToCancel || 0}
        />
      )}

      {isEditModalOpen && (
        <EditOrderModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedOrderForEdit(null);
          }}
          order={selectedOrderForEdit}
          onSuccess={loadOrders}
        />
      )}
    </div>
  );
}
