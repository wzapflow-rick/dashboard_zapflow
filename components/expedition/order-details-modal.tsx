'use client';

import React from 'react';
import { X, User, Phone, MapPin, CreditCard, Clock, Package, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
}

const formatPrice = (price: number) => `R$ ${Number(price || 0).toFixed(2).replace('.', ',')}`;

export default function OrderDetailsModal({ isOpen, onClose, order }: OrderDetailsModalProps) {
  if (!order) return null;

  // Formatar itens do pedido
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

  const formaPagamento: { [key: string]: string } = {
    'pix': 'PIX',
    'dinheiro': 'Dinheiro',
    'cartao': 'Cartão',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          />
          
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700"
            >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="size-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Package className="size-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white">Pedido #{order.id}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {order.criado_em ? new Date(order.criado_em).toLocaleString('pt-BR') : 'N/A'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="size-5 text-slate-400 dark:text-slate-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Cliente */}
              <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3 flex items-center gap-2">
                  <User className="size-3" />
                  Cliente
                </h3>
                <p className="font-bold text-slate-900 dark:text-white">{order.cliente_nome || order.nome_cliente || 'Cliente'}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2 mt-1">
                  <Phone className="size-3" />
                  {order.telefone_cliente || 'N/A'}
                </p>
              </div>

              {/* Endereço / Retirada */}
              <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3 flex items-center gap-2">
                  <MapPin className="size-3" />
                  {order.tipo_entrega === 'retirada' ? 'Retirada' : 'Endereço de Entrega'}
                </h3>
                {order.tipo_entrega === 'retirada' ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">Retirada no balcão</p>
                ) : (
                  <div className="space-y-1">
                    {order.endereco_entrega && order.endereco_entrega !== 'Retirada no balcão' ? (
                      <>
                        <p className="text-sm text-slate-900 dark:text-white font-medium">{order.endereco_entrega}</p>
                        {order.bairro_entrega && (
                          <p className="text-sm text-slate-600 dark:text-slate-400">Bairro: {order.bairro_entrega}</p>
                        )}
                      </>
                    ) : order.bairro_entrega ? (
                      <p className="text-sm text-slate-900 dark:text-white font-medium">{order.bairro_entrega}</p>
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400 italic">Endereço não informado</p>
                    )}
                  </div>
                )}
              </div>

              {/* Itens */}
              <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">Itens do Pedido</h3>
                <div className="space-y-2">
                  {items.length > 0 ? (
                    items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-start py-2 border-b border-slate-200 dark:border-slate-600 last:border-0">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {item.quantidade || 1}x {item.produto || item.nome || 'Item'}
                          </p>
                          {item.observacao && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Obs: {item.observacao}</p>
                          )}
                        </div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {formatPrice(item.subtotal || (item.preco * (item.quantidade || 1)))}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum item encontrado</p>
                  )}
                </div>
              </div>

              {/* Observações */}
              {order.observacoes && (
                <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-700 rounded-xl p-4">
                  <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase mb-1">Observações</h3>
                  <p className="text-sm text-amber-800 dark:text-amber-200">{order.observacoes}</p>
                </div>
              )}

              {/* Resumo Financeiro */}
              <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">Resumo</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Subtotal</span>
                    <span className="font-medium dark:text-white">{formatPrice(order.subtotal)}</span>
                  </div>
                  {order.desconto > 0 && (
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <span>Desconto</span>
                      <span>-{formatPrice(order.desconto)}</span>
                    </div>
                  )}
                  {order.taxa_entrega > 0 && (
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>Taxa de Entrega</span>
                      <span>{formatPrice(order.taxa_entrega)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-2 border-t border-slate-200 dark:border-slate-600">
                    <span className="dark:text-white">Total</span>
                    <span className="text-primary">{formatPrice(order.valor_total)}</span>
                  </div>
                </div>
              </div>

              {/* Pagamento e Pontos */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <CreditCard className="size-3" />
                    Pagamento
                  </h3>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {formaPagamento[order.forma_pagamento] || order.forma_pagamento || 'N/A'}
                  </p>
                  {order.forma_pagamento === 'dinheiro' && order.troco_necessario > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">Troco para: {formatPrice(order.troco_necessario)}</p>
                  )}
                </div>
                <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <Star className="size-3" />
                    Pontos
                  </h3>
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                    +{order.pontos_ganhos || 0} pontos
                  </p>
                  {order.pontos_usados > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">Usou: {order.pontos_usados} pontos</p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700">
              <p className="text-xs text-center text-slate-400 dark:text-slate-500">
                Origem: {order.origem === 'cardapio_publico' ? 'Cardápio Online' : 'Painel Admin'}
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
