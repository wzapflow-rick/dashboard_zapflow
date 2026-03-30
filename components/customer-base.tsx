'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Megaphone,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  History,
  ChevronDown,
  Calendar,
  ShoppingBag,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { getCustomers, getCustomerHistory } from '@/app/actions/customers';
import { toggleBotStatus } from '@/app/actions/bot';
import Image from 'next/image';
import OrderDetailsModal from './order-details-modal';
import { Bot, User as UserIcon, RefreshCcw } from 'lucide-react';

export default function CustomerBase() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isNeighborhoodDropdownOpen, setIsNeighborhoodDropdownOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [toast, setToast] = useState<any>(null); // Quick fix for toast requirement if not already globally available or used as hook

  // Actual sonner toast expected to be available globally via toaster in layout
  // but let's ensure it's imported correctly.

  useEffect(() => {
    // Import toast dynamically or use sonner if available
    import('sonner').then(mod => setToast(mod.toast));
  }, []);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [customerHistory, setCustomerHistory] = useState<any[]>([]);

  useEffect(() => {
    async function loadCustomers() {
      try {
        const data = await getCustomers();
        setCustomers(data);
      } catch (err) {
        console.error('Erro ao buscar clientes:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCustomers();
  }, []);

  const neighborhoods = Array.from(new Set(customers.map(c => c.bairro_entrega).filter(Boolean)));

  const filteredCustomers = customers.filter(c => {
    const name = c.nome || '';
    const phone = c.telefone || '';
    const matchesSearch =
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      phone.includes(searchQuery);

    if (activeFilter === 'Novos') return matchesSearch && c.qtd_pedidos === 1;
    if (activeFilter === 'Recorrentes') return matchesSearch && c.qtd_pedidos > 1;
    if (activeFilter === 'VIP') return matchesSearch && c.valor_total_gasto > 500;
    if (activeFilter && neighborhoods.includes(activeFilter)) return matchesSearch && c.bairro_entrega === activeFilter;

    return matchesSearch;
  });

  const handleFilterClick = (filter: string) => {
    if (activeFilter === filter) {
      setActiveFilter(null);
      setSearchQuery('');
    } else {
      setActiveFilter(filter);
      setSearchQuery(filter);
    }
  };

  const handleNeighborhoodSelect = (neighborhood: string) => {
    setActiveFilter(neighborhood);
    setSearchQuery(neighborhood);
    setIsNeighborhoodDropdownOpen(false);
  };

  const openHistory = async (customer: any) => {
    setSelectedCustomer(customer);
    setIsHistoryOpen(true);
    setHistoryLoading(true);
    setCustomerHistory([]);
    try {
      if (customer.telefone) {
        const history = await getCustomerHistory(customer.telefone);
        setCustomerHistory(history);
      }
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openOrderDetails = (order: any) => {
    setSelectedOrderDetails(order);
    setIsDetailsOpen(true);
  };

  const handleCreateNewOrder = () => {
    alert('Funcionalidade de Criar Novo Pedido será integrada com o PDV em breve!');
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Base de Clientes</h2>
      </header>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
          <button
            onClick={() => setActiveFilter(null)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border",
              !activeFilter ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            )}
          >
            Todos
          </button>
          {['Novos', 'Recorrentes', 'VIP'].map((filter) => (
            <button
              key={filter}
              onClick={() => handleFilterClick(filter)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border",
                activeFilter === filter ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              )}
            >
              {filter}
            </button>
          ))}
          <div className="relative">
            <button
              onClick={() => setIsNeighborhoodDropdownOpen(!isNeighborhoodDropdownOpen)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-2",
                activeFilter && neighborhoods.includes(activeFilter) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              )}
            >
              <Filter className="size-3" />
              Bairros
              <ChevronDown className="size-3" />
            </button>
            <AnimatePresence>
              {isNeighborhoodDropdownOpen && (
                <>
                  <div className="absolute inset-0 z-40 fixed" onClick={() => setIsNeighborhoodDropdownOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 max-h-60 overflow-y-auto"
                  >
                    {neighborhoods.map((n: any) => (
                      <button
                        key={n}
                        onClick={() => handleNeighborhoodSelect(n)}
                        className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-primary transition-all"
                      >
                        {n}
                      </button>
                    ))}
                    {neighborhoods.length === 0 && (
                      <p className="px-4 py-2 text-[10px] text-slate-400 italic">Nenhum bairro encontrado</p>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Rank</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Estatísticas</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Última Compra</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs font-bold text-slate-400 uppercase">Carregando base de clientes...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="max-w-xs mx-auto">
                      <div className="size-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                        <Search className="size-8" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">Nenhum cliente encontrado</h3>
                      <p className="text-sm text-slate-500 mt-1">Tente ajustar seus filtros ou busca.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer: any, index: number) => (
                  <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className={cn(
                        "size-8 rounded-lg flex items-center justify-center text-xs font-black",
                        index === 0 ? "bg-amber-100 text-amber-600" :
                          index === 1 ? "bg-slate-200 text-slate-600" :
                            index === 2 ? "bg-orange-100 text-orange-600" : "text-slate-400"
                      )}>
                        #{index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border-2 border-white shadow-sm font-bold uppercase overflow-hidden">
                          {customer.image ? <Image src={customer.image} alt="" width={40} height={40} /> : (customer.nome?.[0] || 'C')}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{customer.nome}</h4>
                          <p className="text-xs text-slate-500 font-medium">{customer.telefone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-4">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Pedidos</p>
                          <p className="text-sm font-black text-slate-700">{customer.qtd_pedidos}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Total</p>
                          <p className="text-sm font-black text-primary">R$ {Number(customer.valor_total_gasto).toFixed(2).replace('.', ',')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-slate-600">
                        {customer.ultima_compra ? new Date(customer.ultima_compra).toLocaleDateString('pt-BR') : 'Sem registros'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={() => openHistory(customer)}
                          className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all shadow-sm"
                        >
                          <History className="size-4" />
                        </button>
                        <a
                          href={`https://wa.me/${customer.telefone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-green-600 hover:border-green-300 hover:bg-green-50 transition-all shadow-sm"
                        >
                          <Megaphone className="size-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* History Side Sheet */}
      <AnimatePresence>
        {isHistoryOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="relative size-12 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm flex items-center justify-center text-slate-400">
                    {selectedCustomer?.image ? (
                      <Image src={selectedCustomer.image} alt="" fill className="object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <ShoppingBag className="size-6" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{selectedCustomer?.nome || 'Cliente'}</h2>
                    <p className="text-xs text-slate-500 font-medium">{selectedCustomer?.telefone}</p>
                  </div>
                </div>
                <button onClick={() => setIsHistoryOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X className="size-5 text-slate-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 max-h-[calc(100vh-160px)] custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Pedidos</p>
                    <p className="text-2xl font-black text-slate-900">{selectedCustomer?.qtd_pedidos || 0}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gasto Total</p>
                    <p className="text-2xl font-black text-primary">R$ {Number(selectedCustomer?.valor_total_gasto || 0).toFixed(2).replace('.', ',')}</p>
                  </div>
                </div>

                {/* Bot Status Control */}
                <div className="p-4 bg-white rounded-2xl border-2 border-slate-100 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "size-8 rounded-lg flex items-center justify-center",
                        (selectedCustomer?.modo_robo !== false) ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-600"
                      )}>
                        {(selectedCustomer?.modo_robo !== false) ? <Bot className="size-4" /> : <UserIcon className="size-4" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Modo de Atendimento</p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {(selectedCustomer?.modo_robo !== false) ? 'O Robô está atendendo' : 'Atendimento Humano Ativo'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        const newStatus = !(selectedCustomer?.modo_robo !== false);
                        const res = await toggleBotStatus(selectedCustomer.telefone, newStatus);
                        if (res.success) {
                          setSelectedCustomer({ ...selectedCustomer, modo_robo: newStatus });
                          setCustomers(customers.map(c => c.id === selectedCustomer.id ? { ...c, modo_robo: newStatus } : c));
                          toast.success(newStatus ? 'Bot reativado!' : 'Atendimento humano ativado.');
                        } else {
                          toast.error('Erro ao alterar status.');
                        }
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm flex items-center gap-1.5",
                        (selectedCustomer?.modo_robo !== false)
                          ? "bg-amber-500 text-white hover:bg-amber-600"
                          : "bg-primary text-white hover:bg-primary/90"
                      )}
                    >
                      {(selectedCustomer?.modo_robo !== false) ? (
                        <><RefreshCcw className="size-3" /> Pausar IA</>
                      ) : (
                        <><Bot className="size-3" /> Ativar IA</>
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <History className="size-4 text-primary" />
                    Histórico de Pedidos
                  </h3>

                  <div className="space-y-3 pb-8">
                    {historyLoading ? (
                      <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-bold uppercase">Carregando histórico...</p>
                      </div>
                    ) : customerHistory.length === 0 ? (
                      <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                        <ShoppingBag className="size-8 text-slate-200 mx-auto mb-2" />
                        <p className="text-sm font-medium text-slate-400">Nenhum pedido encontrado</p>
                      </div>
                    ) : (
                      customerHistory.map((order: any) => {
                        const formattedItems = Array.isArray(order.itens)
                          ? order.itens.map((item: any) => `${item.quantidade}x ${item.produto}`).join(', ')
                          : '';

                        return (
                          <div
                            key={order.id}
                            onClick={() => openOrderDetails(order)}
                            className="p-4 rounded-xl border border-slate-100 hover:border-primary/20 hover:bg-primary/5 transition-all group cursor-pointer"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <span className="text-xs font-bold text-slate-400 uppercase">#{order.id}</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Calendar className="size-3 text-slate-400" />
                                  <span className="text-xs font-semibold text-slate-600">
                                    {order.criado_em ? new Date(order.criado_em).toLocaleDateString('pt-BR') : '—'}
                                  </span>
                                </div>
                              </div>
                              <span className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                                order.status === 'finalizado' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                              )}>
                                {order.status}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 font-medium line-clamp-2">{formattedItems || 'Pedido sem itens'}</p>
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100">
                              <span className="text-sm font-bold text-slate-900">R$ {Number(order.valor_total).toFixed(2).replace('.', ',')}</span>
                              <button className="text-xs font-bold text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                                Ver detalhes <ArrowRight className="size-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 shrink-0">
                <button
                  onClick={handleCreateNewOrder}
                  className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="size-4" />
                  Criar Novo Pedido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <OrderDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        order={selectedOrderDetails}
      />
    </div>
  );
}

