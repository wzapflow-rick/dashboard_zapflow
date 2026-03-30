'use client';

import React from 'react';
import {
  X,
  MapPin,
  Phone,
  Clock,
  CreditCard,
  User,
  Package,
  CheckCircle2,
  Calendar,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
}

export default function OrderDetailsModal({ isOpen, onClose, order }: OrderDetailsModalProps) {
  if (!order) return null;

  const formattedItems = Array.isArray(order.itens) ? order.itens : [];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-900 shrink-0">
              <div className="flex items-center gap-3">
                <div className="size-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                  <Package className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white leading-tight">Pedido #{order.id}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Detalhes Completos</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="size-8 rounded-full bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {/* Status e Data */}
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <Calendar className="size-4 text-slate-400" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Data/Hora</p>
                    <p className="text-sm font-bold text-slate-700">
                      {order.criado_em ? new Date(order.criado_em).toLocaleString('pt-BR') : '—'}
                    </p>
                  </div>
                </div>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                  order.status === 'finalizado' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                )}>
                  {order.status}
                </span>
              </div>

              {/* Cliente */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                <div className="size-10 rounded-full bg-white shadow-sm flex items-center justify-center text-primary border border-slate-100">
                  <User className="size-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Cliente</p>
                  <p className="text-sm font-bold text-slate-900">{order.nome_cliente || order.telefone_cliente || 'Cliente'}</p>
                  <p className="text-xs text-slate-500 font-medium">{order.telefone_cliente}</p>
                </div>
              </div>

              {/* Itens */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Tag className="size-3" /> Itens do Pedido
                </h4>
                <div className="bg-white border border-slate-100 rounded-2xl divide-y divide-slate-50 overflow-hidden">
                  {formattedItems.map((item: any, i: number) => (
                    <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="size-7 flex items-center justify-center bg-slate-100 rounded font-black text-xs text-slate-500">{item.quantidade}x</span>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{item.produto}</p>
                          {item.observacao && <p className="text-[10px] text-red-500 font-medium italic">Obs: {item.observacao}</p>}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-slate-900">R$ {Number(item.preco_unitario || item.preco || 0).toFixed(2).replace('.', ',')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Extras */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Pagamento</p>
                  <div className="flex items-center gap-2">
                    <CreditCard className="size-4 text-primary" />
                    <span className="text-sm font-bold text-slate-700">{order.forma_pagamento || 'A combinar'}</span>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Local</p>
                  <div className="flex items-center gap-2 text-primary">
                    <MapPin className="size-4" />
                    <span className="text-sm font-bold text-slate-700">{order.bairro_entrega || 'Retirada'}</span>
                  </div>
                </div>
              </div>

              {order.observacoes && (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                  <p className="text-[10px] font-bold text-amber-500 uppercase mb-1">Nota do Pedido</p>
                  <p className="text-xs text-amber-700 font-medium leading-relaxed italic">"{order.observacoes}"</p>
                </div>
              )}
            </div>

            {/* Total e Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Total do Pedido</p>
                <p className="text-2xl font-black text-slate-900">R$ {Number(order.valor_total).toFixed(2).replace('.', ',')}</p>
              </div>
              <button
                onClick={onClose}
                className="px-8 py-3 bg-slate-900 text-white font-black rounded-xl hover:opacity-90 transition-all shadow-lg shadow-slate-900/10 uppercase text-sm tracking-widest"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
