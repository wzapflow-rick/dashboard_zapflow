'use client';

import React, { useState } from 'react';
import { X, Plus, Loader2, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { addExtraValueToOrder } from '@/app/actions/orders';

interface AddExtraValueModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: number;
  orderNumber?: number | string;
  onSuccess?: (novoTotal: number) => void;
}

export function AddExtraValueModal({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  onSuccess,
}: AddExtraValueModalProps) {
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const valorNumerico = parseFloat(valor.replace(',', '.'));

    if (!nome.trim()) {
      setError('Informe o nome do item');
      return;
    }

    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      setError('Informe um valor valido');
      return;
    }

    setIsLoading(true);

    try {
      const result = await addExtraValueToOrder(orderId, nome.trim(), valorNumerico);
      
      if (result.success) {
        onSuccess?.(result.novoTotal);
        setNome('');
        setValor('');
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao adicionar valor');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setNome('');
      setValor('');
      setError('');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          >
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <DollarSign className="size-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      Adicionar Valor
                    </h3>
                    {orderNumber && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Pedido #{orderNumber}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  disabled={isLoading}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Content */}
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Nome do Item
                  </label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Acai 300g, Refrigerante..."
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    autoFocus
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Valor (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                      R$
                    </span>
                    <input
                      type="text"
                      value={valor}
                      onChange={(e) => {
                        // Permite apenas numeros, virgula e ponto
                        const v = e.target.value.replace(/[^0-9.,]/g, '');
                        setValor(v);
                      }}
                      placeholder="0,00"
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                      disabled={isLoading}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Este valor sera somado ao total do pedido
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isLoading}
                    className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !nome.trim() || !valor}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="size-4" />
                        Adicionar
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
