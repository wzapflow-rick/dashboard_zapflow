'use client';

import React, { useState } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createMesa } from '@/app/actions/tables';

interface CreateTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateTableModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateTableModalProps) {
  const [numero, setNumero] = useState('');
  const [nome, setNome] = useState('');
  const [capacidade, setCapacidade] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!numero || isNaN(Number(numero)) || Number(numero) <= 0) {
      setError('Informe um número válido para a mesa');
      return;
    }

    setIsLoading(true);

    try {
      await createMesa({
        numero: Number(numero),
        nome: nome.trim() || undefined,
        capacidade: capacidade ? Number(capacidade) : undefined,
      });

      setNumero('');
      setNome('');
      setCapacidade('');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar mesa');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setNumero('');
      setNome('');
      setCapacidade('');
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-slate-800 rounded-2xl w-full max-w-md shadow-xl border border-slate-700">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <h2 className="text-lg font-semibold text-white">Nova Mesa</h2>
                <button
                  onClick={handleClose}
                  disabled={isLoading}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Numero da Mesa *
                  </label>
                  <input
                    type="number"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    placeholder="Ex: 1"
                    min="1"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Nome (opcional)
                  </label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Mesa VIP, Varanda, etc."
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Capacidade (lugares)
                  </label>
                  <input
                    type="number"
                    value={capacidade}
                    onChange={(e) => setCapacidade(e.target.value)}
                    placeholder="Ex: 4"
                    min="1"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isLoading}
                    className="flex-1 px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Criando...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="size-4" />
                        <span>Criar Mesa</span>
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
