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
  ArrowRight,
  Star
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { getCustomers, getCustomerHistory } from '@/app/actions/customers';
import { toggleBotStatus } from '@/app/actions/bot';
import Image from 'next/image';
import OrderDetailsModal from '@/components/modals/order-details-modal';
import { Bot, User as UserIcon, RefreshCcw } from 'lucide-react';

export default function CustomerBase() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
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

  // Contagem de clientes por bairro - verificar todos os campos possíveis
  const neighborhoodCounts = customers.reduce((acc, c) => {
    // Tentar diferentes nomes de campo que podem vir do NocoDB
    const bairro = c.bairro_entrega || c.bairro || c.neighborhood || c.bairroEntrega || c.delivery_neighborhood;
    if (bairro && typeof bairro === 'string' && bairro.trim() !== '') {
      const bairroTrimmed = bairro.trim();
      acc[bairroTrimmed] = (acc[bairroTrimmed] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const neighborhoods = Object.keys(neighborhoodCounts).sort();

  const filteredCustomers = customers.filter(c => {
    const name = c.nome || '';
    const phone = c.telefone || '';

    // Apply search filter
    const matchesSearch = !searchQuery ||
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      phone.includes(searchQuery);

    if (!matchesSearch) return false;

    // Apply category filter
    if (activeFilter === 'Novos') return c.qtd_pedidos === 1;
    if (activeFilter === 'Recorrentes') return c.qtd_pedidos > 1;
    if (activeFilter && neighborhoods.includes(activeFilter)) return c.bairro_entrega === activeFilter;

    return true;
  });

  const handleFilterClick = (filter: string) => {
    if (activeFilter === filter) {
      setActiveFilter(null);
    } else {
      setActiveFilter(filter);
    }
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
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Base de Clientes</h2>
      </header>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 rounded-2xl focus:border-primary/30 focus:outline-none transition-all text-sm font-medium dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
          <button
            onClick={() => {
              setActiveFilter(null);
              setSearchQuery('');
            }}
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border-2",
              !activeFilter && !searchQuery ? "bg-slate-900 dark:bg-slate-700 text-white border-slate-900 dark:border-slate-600" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500"
            )}
          >
            Todos
          </button>
          {['Novos', 'Recorrentes'].map((filter) => (
            <button
              key={filter}
              onClick={() => handleFilterClick(filter)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border-2",
                activeFilter === filter ? "bg-primary text-white border-primary" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500"
              )}
            >
              {filter}
            </button>
          ))}
          <div className="relative">
            <button
              type="button"
              disabled
              title="Em breve - filtros por bairro"
              className="px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border-2 flex items-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-600 cursor-not-allowed opacity-60"
            >
              <Filter className="size-3" />
              Bairros
              <ChevronDown className="size-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b-2 border-slate-100 dark:bg-slate-700/50 dark:border-slate-700">
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest dark:text-slate-500">Rank</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest dark:text-slate-500">Cliente</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest dark:text-slate-500">Estatísticas</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest dark:text-slate-500">Última Compra</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest dark:text-slate-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="size-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs font-bold text-slate-400 uppercase dark:text-slate-500">Carregando base de clientes...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="max-w-xs mx-auto">
                      <div className="size-16 bg-slate-50 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Search className="size-8 text-slate-300 dark:text-slate-500" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nenhum cliente encontrado</h3>
                      <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">Tente ajustar seus filtros ou busca.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer: any, index: number) => (
                  <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors group dark:hover:bg-slate-700/30">
                    <td className="px-6 py-4">
                      <div className={cn(
                        "size-8 rounded-xl flex items-center justify-center text-xs font-black",
                        index === 0 ? "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400" :
                          index === 1 ? "bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300" :
                            index === 2 ? "bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400" : "text-slate-400 dark:text-slate-500"
                      )}>
                        #{index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-2xl bg-slate-100 dark:bg-slate-600 flex items-center justify-center text-slate-400 border-2 border-white dark:border-slate-500 shadow-sm font-bold uppercase overflow-hidden">
                          {customer.image ? <Image src={customer.image} alt="" width={40} height={40} /> : (customer.nome?.[0] || 'C')}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">{customer.nome}</h4>
                            <span className={cn(
                              "text-[9px] font-bold px-2 py-0.5 rounded-lg uppercase",
                              customer.qtd_pedidos === 1 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400" :
                                customer.qtd_pedidos > 1 && customer.valor_total_gasto > 500 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400" :
                                  "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400"
                            )}>
                              {customer.qtd_pedidos === 1 ? 'Novo' :
                                customer.qtd_pedidos > 1 && customer.valor_total_gasto > 500 ? 'VIP' :
                                  'Recorrente'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-medium dark:text-slate-400">{customer.telefone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-6">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase dark:text-slate-500">Pedidos</p>
                          <p className="text-sm font-black text-slate-700 dark:text-slate-200">{customer.qtd_pedidos}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase dark:text-slate-500">Total</p>
                          <p className="text-sm font-black text-primary">R$ {Number(customer.valor_total_gasto).toFixed(2).replace('.', ',')}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 dark:text-slate-500">
                            <Star className="size-3 text-amber-500" />
                            Pontos
                          </p>
                          <p className={cn(
                            "text-sm font-black",
                            (customer.pontos_fidelidade || 0) >= 100 ? "text-green-600 dark:text-green-400" : "text-slate-700 dark:text-slate-200"
                          )}>
                            {customer.pontos_fidelidade || 0}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        {customer.ultima_compra ? new Date(customer.ultima_compra).toLocaleDateString('pt-BR') : 'Sem registros'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openHistory(customer)}
                          className="p-2.5 bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary hover:border-primary/30 dark:hover:border-primary/30 hover:bg-primary/5 transition-all"
                        >
                          <History className="size-4" />
                        </button>
                        <a
                          href={`https://wa.me/${customer.telefone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2.5 bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-400 hover:border-green-300 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all"
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
              className="relative w-full max-w-md bg-white dark:bg-slate-800 h-full shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b-2 border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-4">
                  <div className="relative size-14 rounded-2xl bg-slate-200 dark:bg-slate-600 overflow-hidden border-2 border-white dark:border-slate-500 shadow-sm flex items-center justify-center text-slate-400">
                    {selectedCustomer?.image ? (
                      <Image src={selectedCustomer.image} alt="" fill className="object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <ShoppingBag className="size-6" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selectedCustomer?.nome || 'Cliente'}</h2>
                    <p className="text-xs text-slate-500 font-medium dark:text-slate-400">{selectedCustomer?.telefone}</p>
                  </div>
                </div>
                <button onClick={() => setIsHistoryOpen(false)} className="p-2.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors">
                  <X className="size-5 text-slate-500 dark:text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 max-h-[calc(100vh-160px)] custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 bg-slate-50 dark:bg-slate-700 rounded-2xl border-2 border-slate-100 dark:border-slate-600">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider dark:text-slate-500">Total Pedidos</p>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">{selectedCustomer?.qtd_pedidos || 0}</p>
                  </div>
                  <div className="p-5 bg-slate-50 dark:bg-slate-700 rounded-2xl border-2 border-slate-100 dark:border-slate-600">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider dark:text-slate-500">Gasto Total</p>
                    <p className="text-3xl font-black text-primary">R$ {Number(selectedCustomer?.valor_total_gasto || 0).toFixed(2).replace('.', ',')}</p>
                  </div>
                </div>

                {/* Bot Status Control */}
                <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "size-10 rounded-xl flex items-center justify-center",
                        (selectedCustomer?.modo_robo !== false) ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400"
                      )}>
                        {(selectedCustomer?.modo_robo !== false) ? <Bot className="size-5" /> : <UserIcon className="size-5" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">Modo de Atendimento</p>
                        <p className="text-[10px] text-slate-500 font-medium dark:text-slate-400">
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
                        "px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all shadow-sm flex items-center gap-2",
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
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 dark:text-white">
                    <History className="size-4 text-primary" />
                    Histórico de Pedidos
                  </h3>

                  <div className="space-y-3 pb-8">
                    {historyLoading ? (
                      <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2 dark:text-slate-500">
                        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-bold uppercase">Carregando histórico...</p>
                      </div>
                    ) : customerHistory.length === 0 ? (
                      <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-2xl dark:border-slate-700">
                        <ShoppingBag className="size-8 text-slate-200 mx-auto mb-2 dark:text-slate-600" />
                        <p className="text-sm font-medium text-slate-400 dark:text-slate-500">Nenhum pedido encontrado</p>
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
                            className="p-4 rounded-xl border border-slate-100 hover:border-primary/20 hover:bg-primary/5 transition-all group cursor-pointer dark:border-slate-700 dark:hover:border-primary/30 dark:hover:bg-primary/10"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <span className="text-xs font-bold text-slate-400 uppercase dark:text-slate-500">#{order.id}</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Calendar className="size-3 text-slate-400 dark:text-slate-500" />
                                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                    {order.criado_em ? new Date(order.criado_em).toLocaleDateString('pt-BR') : '—'}
                                  </span>
                                </div>
                              </div>
                              <span className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                                order.status === 'finalizado' ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400"
                              )}>
                                {order.status}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 font-medium line-clamp-2 dark:text-slate-300">{formattedItems || 'Pedido sem itens'}</p>
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                              <span className="text-sm font-bold text-slate-900 dark:text-white">R$ {Number(order.valor_total).toFixed(2).replace('.', ',')}</span>
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

              <div className="p-6 border-t border-slate-100 shrink-0 dark:border-slate-700">
                <button
                  onClick={handleCreateNewOrder}
                  className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
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

