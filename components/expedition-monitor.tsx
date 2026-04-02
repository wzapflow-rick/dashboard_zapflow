import React, { useState, useEffect } from 'react';
import { Search, Printer, Eye } from 'lucide-react';
import dynamic from 'next/dynamic';
import { KanbanColumn } from './expedition/kanban-column';
import { getOrders, updateOrderStatus, verificarEstoqueDoPedido } from '@/app/actions/orders';
import RegisterCustomerModal from './expedition/register-customer-modal';
import StockWarningModal from './expedition/stock-warning-modal';
import OrderDetailsModal from './expedition/order-details-modal';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import OrderCreatorModal from './order-creator-modal';

const PrintModal = dynamic(() => import('./expedition/print-modal'), {
  ssr: false,
});

const columns = [
  { id: 'pagamento_pendente', title: 'Aguardando Pagamento', color: 'orange' },
  { id: 'pendente', title: 'Novos Pedidos', color: 'red' },
  { id: 'preparando', title: 'Preparando', color: 'amber' },
  { id: 'entrega', title: 'Saiu para Entrega', color: 'blue' },
  { id: 'finalizado', title: 'Concluídos', color: 'green' },
];

export default function ExpeditionMonitor() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [knownOrderIds, setKnownOrderIds] = useState<Set<number>>(new Set());
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  const loadOrders = async () => {
    try {
      const data = await getOrders();
      const cleanData = JSON.parse(JSON.stringify(data || []));

      // 🔍 DEBUG TOTAL
      if (cleanData.length > 0) {
        const first = cleanData[0];
        console.log('=== FULL ORDER OBJECT ===');
        console.log(JSON.stringify(first, null, 2));

        // Checar CADA propriedade
        for (const [key, value] of Object.entries(first)) {
          const type = typeof value;
          const isClass = value && (value.constructor?.name !== 'Object' && value.constructor?.name !== 'Array');
          console.log(`${key}: ${type} | Constructor: ${value?.constructor?.name} | IsClass: ${isClass}`);
        }
      }

      setOrders(cleanData);
    } catch (err) {
      console.error('Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  // Som para NOVO PEDIDO na expedição - Tom mais agudo e duplo
  const playNewOrderSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Primeiro tom
      const osc1 = audioContext.createOscillator();
      const gain1 = audioContext.createGain();
      osc1.connect(gain1);
      gain1.connect(audioContext.destination);
      osc1.type = 'sine';
      osc1.frequency.value = 1200;
      gain1.gain.value = 0.4;
      osc1.start();
      setTimeout(() => {
        osc1.stop();
      }, 100);

      // Segundo tom
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.type = 'sine';
      osc2.frequency.value = 1600;
      gain2.gain.value = 0.4;
      setTimeout(() => {
        osc2.start();
        setTimeout(() => {
          osc2.stop();
        }, 150);
      }, 120);
    } catch (e) {
      console.log('Não foi possível tocar som');
    }
  };

  // Som para PENDENTE na expedição - Tom mais grave e curto
  const playPendingSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 600;
      oscillator.type = 'triangle';
      gainNode.gain.value = 0.3;

      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
      }, 200);
    } catch (e) {
      console.log('Não foi possível tocar som');
    }
  };

  useEffect(() => {
    loadOrders();

    // Polling para novos pedidos a cada 10 segundos
    const interval = setInterval(() => {
      loadOrders();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleMoveOrder = async (orderId: number, currentStatus: string) => {
    const statusFlow: { [key: string]: string } = {
      'pagamento_pendente': 'pendente',  // Pagamento confirmado → Novo pedido
      'pendente': 'preparando',
      'preparando': 'entrega',
      'entrega': 'finalizado'
    };

    const nextStatus = statusFlow[currentStatus];
    if (!nextStatus) return;

    // Tocar som ao confirmar pagamento (pedido pendente)
    if (currentStatus === 'pagamento_pendente') {
      playPendingSound();
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

  const handleConfirmPrint = () => {
    console.log(`Imprimindo pedido ${selectedOrderForPrint?.id}`);
    setIsPrintModalOpen(false);
    setSelectedOrderForPrint(null);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <header className="h-auto min-h-16 border-b border-slate-200 bg-white px-4 sm:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 rounded-t-xl">
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-4">
            <h2 className="text-lg sm:text-xl font-bold">Monitor de Expedição</h2>
            <span className="px-2 py-1 rounded bg-slate-100 text-[10px] sm:text-xs font-bold text-slate-600 uppercase">Live</span>
          </div>
          <button className="sm:hidden size-9 flex items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
            <Printer className="size-5" />
          </button>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
            <input
              className="pl-9 h-9 w-full sm:w-64 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="Buscar pedido..."
              type="text"
            />
          </div>
          <button
            onClick={() => setIsOrderCreatorOpen(true)}
            className="h-9 px-4 bg-primary text-white text-xs font-black rounded-lg hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg shadow-primary/20 uppercase tracking-wider"
          >
            <Plus className="size-4" />
            Novo Pedido
          </button>
          <button className="hidden sm:flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
            <Printer className="size-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-x-auto p-4 sm:p-6 flex gap-4 sm:gap-6 bg-slate-50/50 rounded-b-xl border-x border-b border-slate-200 custom-scrollbar">
        {columns.map((col) => {
          const columnOrders = orders.filter(o => o.status === col.id);
          return (
            <KanbanColumn
              key={col.id}
              col={col}
              columnOrders={columnOrders}
              onOpenPrintModal={openPrintModal}
              onMoveOrder={handleMoveOrder}
              onRegisterCustomer={openRegisterModal}
              onOpenDetails={openDetailsModal}
            />
          );
        })}
      </div>

      {isPrintModalOpen && (
        <PrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          order={selectedOrderForPrint}
          onConfirm={handleConfirmPrint}
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
    </div>
  );
}