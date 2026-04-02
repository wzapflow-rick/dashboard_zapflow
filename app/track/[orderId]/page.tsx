'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  Package, 
  Clock, 
  MapPin, 
  Phone, 
  Truck, 
  CheckCircle,
  ChefHat,
  Circle,
  User
} from 'lucide-react';
import { motion } from 'motion/react';

const statusSteps = [
  { id: 'pagamento_pendente', label: 'Pagamento Pendente', icon: Clock, color: 'orange' },
  { id: 'pendente', label: 'Pedido Confirmado', icon: CheckCircle, color: 'blue' },
  { id: 'preparando', label: 'Preparando', icon: ChefHat, color: 'amber' },
  { id: 'entrega', label: 'Saiu para Entrega', icon: Truck, color: 'purple' },
  { id: 'finalizado', label: 'Entregue', icon: CheckCircle, color: 'green' },
];

export default function TrackOrderPage() {
  const params = useParams();
  const orderId = params?.orderId as string;
  
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orderId) {
      fetchOrder();
      // Atualizar a cada 30 segundos
      const interval = setInterval(fetchOrder, 30000);
      return () => clearInterval(interval);
    }
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/track/${orderId}`);
      if (!res.ok) throw new Error('Pedido não encontrado');
      const data = await res.json();
      setOrder(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar pedido');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentStepIndex = () => {
    if (!order) return -1;
    return statusSteps.findIndex(s => s.id === order.status);
  };

  const formatPrice = (price: number) => `R$ ${Number(price || 0).toFixed(2).replace('.', ',')}`;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md w-full">
          <Package className="size-16 text-slate-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Pedido não encontrado</h1>
          <p className="text-slate-500">{error || 'Verifique o número do pedido e tente novamente.'}</p>
        </div>
      </div>
    );
  }

  const currentStepIndex = getCurrentStepIndex();

  // Parse items
  let items: any[] = [];
  try {
    if (typeof order.itens === 'string') {
      items = JSON.parse(order.itens);
    } else if (Array.isArray(order.itens)) {
      items = order.itens;
    }
  } catch (e) {
    items = [];
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <div className="max-w-lg mx-auto space-y-6 py-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="size-20 bg-white rounded-full shadow-lg mx-auto mb-4 flex items-center justify-center">
            <Package className="size-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Acompanhe seu Pedido</h1>
          <p className="text-slate-600 mt-1">Pedido #{order.id}</p>
        </motion.div>

        {/* Status Timeline */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg p-6"
        >
          <h2 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Clock className="size-5 text-green-500" />
            Status do Pedido
          </h2>
          
          <div className="space-y-0">
            {statusSteps.map((step, index) => {
              const isCompleted = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const StepIcon = step.icon;

              return (
                <div key={step.id} className="flex gap-4">
                  {/* Timeline line and icon */}
                  <div className="flex flex-col items-center">
                    <div className={`
                      size-10 rounded-full flex items-center justify-center shrink-0
                      ${isCompleted 
                        ? 'bg-green-500 text-white' 
                        : 'bg-slate-100 text-slate-400'}
                      ${isCurrent ? 'ring-4 ring-green-200' : ''}
                    `}>
                      <StepIcon className="size-5" />
                    </div>
                    {index < statusSteps.length - 1 && (
                      <div className={`
                        w-0.5 h-12 my-1
                        ${index < currentStepIndex ? 'bg-green-500' : 'bg-slate-200'}
                      `} />
                    )}
                  </div>

                  {/* Step info */}
                  <div className="pb-8">
                    <p className={`
                      font-bold text-sm
                      ${isCompleted ? 'text-slate-900' : 'text-slate-400'}
                    `}>
                      {step.label}
                    </p>
                    {isCurrent && (
                      <p className="text-xs text-green-600 mt-1">
                        {order.status === 'preparando' && 'Seu pedido está sendo preparado com carinho!'}
                        {order.status === 'entrega' && 'Seu pedido está a caminho!'}
                        {order.status === 'pendente' && 'Pedido confirmado! Aguardando preparo.'}
                        {order.status === 'pagamento_pendente' && 'Aguardando confirmação do pagamento.'}
                        {order.status === 'finalizado' && 'Pedido entregue! Bom apetite!'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Entregador (se atribuído) */}
        {order.entregador_id && order.status === 'entrega' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-lg p-6"
          >
            <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Truck className="size-5 text-purple-500" />
              Seu Entregador
            </h2>
            <div className="flex items-center gap-4">
              <div className="size-14 bg-gradient-to-br from-purple-100 to-purple-50 rounded-full flex items-center justify-center">
                <User className="size-7 text-purple-500" />
              </div>
              <div>
                <p className="font-bold text-slate-900">{order.entregador_nome || 'Entregador'}</p>
                <p className="text-sm text-slate-500">{order.entregador_veiculo || 'Delivery'}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Endereço */}
        {order.tipo_entrega === 'delivery' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl shadow-lg p-6"
          >
            <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <MapPin className="size-5 text-red-500" />
              Endereço de Entrega
            </h2>
            <p className="text-slate-700">{order.endereco_entrega || 'Não informado'}</p>
            {order.bairro_entrega && (
              <p className="text-slate-500 text-sm mt-1">{order.bairro_entrega}</p>
            )}
          </motion.div>
        )}

        {/* Resumo do Pedido */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl shadow-lg p-6"
        >
          <h2 className="font-bold text-slate-900 mb-4">Resumo do Pedido</h2>
          
          <div className="space-y-3">
            {items.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-slate-600">
                  {item.quantidade || 1}x {item.produto || item.nome || 'Item'}
                </span>
                <span className="font-medium text-slate-900">
                  {formatPrice(item.subtotal || (item.preco * (item.quantidade || 1)))}
                </span>
              </div>
            ))}
            
            <div className="border-t border-slate-100 pt-3 mt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="text-slate-700">{formatPrice(order.subtotal)}</span>
              </div>
              
              {order.taxa_entrega > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Taxa de entrega</span>
                  <span className="text-slate-700">{formatPrice(order.taxa_entrega)}</span>
                </div>
              )}
              
              {order.desconto > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Desconto</span>
                  <span>-{formatPrice(order.desconto)}</span>
                </div>
              )}
              
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-slate-200">
                <span className="text-slate-900">Total</span>
                <span className="text-green-600">{formatPrice(order.valor_total)}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Informações Adicionais */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl shadow-lg p-6"
        >
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Pagamento</p>
              <p className="font-bold text-slate-900 capitalize">
                {order.forma_pagamento || 'Não informado'}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Data do Pedido</p>
              <p className="font-bold text-slate-900">{formatDate(order.criado_em)}</p>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 pt-4">
          Dúvidas? Entre em contato conosco pelo WhatsApp
        </p>
      </div>
    </div>
  );
}
