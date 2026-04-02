'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Truck, 
  LogOut, 
  MapPin, 
  Phone, 
  Clock, 
  CheckCircle,
  Package,
  Loader2,
  RefreshCw,
  DollarSign,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getDriverSession, 
  getDriverOrders, 
  updateOrderStatusByDriver, 
  driverLogout 
} from '@/app/actions/driver-auth';
import { toast } from 'sonner';

interface DriverOrder {
  id: number;
  cliente_nome: string;
  telefone_cliente: string;
  endereco_entrega: string;
  bairro_entrega: string;
  valor_total: number;
  taxa_entrega: number;
  status: string;
  tipo_entrega: string;
  criado_em: string;
  itens: string;
  observacoes: string;
}

export default function DriverDashboard() {
  const router = useRouter();
  const [driver, setDriver] = useState<any>(null);
  const [orders, setOrders] = useState<DriverOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const session = await getDriverSession();
      if (!session) {
        router.push('/driver/login');
        return;
      }
      setDriver(session);
      await loadOrders(session.driverId);
    } catch (error) {
      router.push('/driver/login');
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async (driverId: number) => {
    try {
      const data = await getDriverOrders(driverId);
      setOrders(data);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
    }
  };

  const handleRefresh = async () => {
    if (!driver?.driverId) return;
    setRefreshing(true);
    await loadOrders(driver.driverId);
    setRefreshing(false);
    toast.success('Pedidos atualizados!');
  };

  const handleUpdateStatus = async (orderId: number, newStatus: string) => {
    setUpdating(orderId);
    try {
      await updateOrderStatusByDriver(orderId, newStatus);
      
      if (newStatus === 'finalizado') {
        toast.success('Pedido finalizado! 🎉');
      } else {
        toast.success('Status atualizado!');
      }
      
      await loadOrders(driver.driverId);
    } catch (error) {
      toast.error('Erro ao atualizar status');
    } finally {
      setUpdating(null);
    }
  };

  const handleLogout = async () => {
    await driverLogout();
    router.push('/driver/login');
  };

  const formatPrice = (price: number) => `R$ ${Number(price || 0).toFixed(2).replace('.', ',')}`;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '--:--';
    try {
      return new Date(dateStr).toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return '--:--';
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'preparando':
        return { label: 'Preparando', color: 'amber', icon: Package };
      case 'entrega':
        return { label: 'Saiu para Entrega', color: 'blue', icon: Truck };
      default:
        return { label: status, color: 'gray', icon: Clock };
    }
  };

  const getNextStatus = (currentStatus: string) => {
    if (currentStatus === 'preparando') return 'entrega';
    if (currentStatus === 'entrega') return 'finalizado';
    return null;
  };

  const getNextStatusLabel = (currentStatus: string) => {
    if (currentStatus === 'preparando') return 'Iniciar Entrega';
    if (currentStatus === 'entrega') return 'Confirmar Entrega';
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 className="size-10 text-purple-500 animate-spin" />
      </div>
    );
  }

  const activeOrders = orders.filter(o => o.status === 'entrega');
  const pendingOrders = orders.filter(o => o.status === 'preparando');

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-pink-500 text-white p-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Truck className="size-5" />
            </div>
            <div>
              <h1 className="font-bold">Olá, {driver?.driverName || 'Entregador'}!</h1>
              <p className="text-xs text-white/80">
                {activeOrders.length > 0 
                  ? `${activeOrders.length} entrega(s) em andamento` 
                  : pendingOrders.length > 0
                    ? `${pendingOrders.length} pedido(s) para buscar`
                    : 'Nenhuma entrega no momento'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
              <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto p-4 space-y-4">
        {orders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-8 text-center shadow-sm"
          >
            <div className="size-20 bg-purple-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Package className="size-10 text-purple-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Nenhum pedido</h2>
            <p className="text-slate-500 mt-2">
              Aguarde, em breve novas entregas serão atribuídas para você!
            </p>
          </motion.div>
        ) : (
          <AnimatePresence>
            {orders.map((order, index) => {
              const statusInfo = getStatusInfo(order.status);
              const nextStatus = getNextStatus(order.status);
              const nextLabel = getNextStatusLabel(order.status);
              const StatusIcon = statusInfo.icon;

              // Parse items
              let items: any[] = [];
              try {
                items = typeof order.itens === 'string' ? JSON.parse(order.itens) : order.itens || [];
              } catch {
                items = [];
              }

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-2xl shadow-sm overflow-hidden"
                >
                  {/* Order Header */}
                  <div className={`p-4 ${
                    order.status === 'entrega' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-amber-500 text-white'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatusIcon className="size-5" />
                        <span className="font-bold">Pedido #{order.id}</span>
                      </div>
                      <span className="text-sm opacity-80">
                        {formatDate(order.criado_em)}
                      </span>
                    </div>
                    <p className="text-sm mt-1 opacity-90">{statusInfo.label}</p>
                  </div>

                  {/* Order Content */}
                  <div className="p-4 space-y-4">
                    {/* Customer Info */}
                    <div className="flex items-start gap-3">
                      <div className="size-10 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                        <User className="size-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{order.cliente_nome || 'Cliente'}</p>
                        <a 
                          href={`tel:${order.telefone_cliente}`}
                          className="text-sm text-purple-600 flex items-center gap-1"
                        >
                          <Phone className="size-3" />
                          {order.telefone_cliente}
                        </a>
                      </div>
                    </div>

                    {/* Address */}
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="size-5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-slate-900">
                            {order.endereco_entrega || 'Endereço não informado'}
                          </p>
                          {order.bairro_entrega && (
                            <p className="text-sm text-slate-500">{order.bairro_entrega}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-2">Itens</p>
                      <div className="space-y-1">
                        {items.slice(0, 3).map((item: any, idx: number) => (
                          <p key={idx} className="text-sm text-slate-600">
                            {item.quantidade || 1}x {item.produto || item.nome || 'Item'}
                          </p>
                        ))}
                        {items.length > 3 && (
                          <p className="text-xs text-slate-400">+{items.length - 3} itens...</p>
                        )}
                      </div>
                    </div>

                    {/* Observations */}
                    {order.observacoes && (
                      <div className="bg-amber-50 border border-amber-100 rounded-lg p-2">
                        <p className="text-xs text-amber-700">
                          <strong>OBS:</strong> {order.observacoes}
                        </p>
                      </div>
                    )}

                    {/* Total */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1 text-slate-500">
                        <DollarSign className="size-4" />
                        <span className="text-sm">Total do pedido</span>
                      </div>
                      <span className="font-bold text-lg text-slate-900">
                        {formatPrice(order.valor_total)}
                      </span>
                    </div>

                    {/* Action Button */}
                    {nextStatus && nextLabel && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, nextStatus)}
                        disabled={updating === order.id}
                        className={`w-full py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
                          nextStatus === 'finalizado'
                            ? 'bg-green-500 hover:bg-green-600'
                            : 'bg-blue-500 hover:bg-blue-600'
                        } disabled:opacity-50`}
                      >
                        {updating === order.id ? (
                          <>
                            <Loader2 className="size-5 animate-spin" />
                            Atualizando...
                          </>
                        ) : (
                          <>
                            {nextStatus === 'finalizado' ? (
                              <CheckCircle className="size-5" />
                            ) : (
                              <Truck className="size-5" />
                            )}
                            {nextLabel}
                          </>
                        )}
                      </button>
                    )}

                    {order.status === 'finalizado' && (
                      <div className="w-full py-3 rounded-xl bg-green-100 text-green-700 font-bold text-center flex items-center justify-center gap-2">
                        <CheckCircle className="size-5" />
                        Entrega Concluída
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-slate-400">
        ZapFlow Entregador v1.0
      </footer>
    </div>
  );
}
