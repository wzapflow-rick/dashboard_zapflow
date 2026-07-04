'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Loader2, AlertCircle } from 'lucide-react';
import { salvarDadosEntregaComanda } from '@/app/actions/tables';

interface DeliveryInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  comandaId: number;
  comandaNome: string;
  initialNome?: string;
  initialTelefone?: string;
  initialEndereco?: string;
  onSuccess: () => void;
}

export default function DeliveryInfoModal({
  isOpen,
  onClose,
  comandaId,
  comandaNome,
  initialNome,
  initialTelefone,
  initialEndereco,
  onSuccess,
}: DeliveryInfoModalProps) {
  const [nomeCliente, setNomeCliente] = useState(initialNome || '');
  const [telefone, setTelefone] = useState(initialTelefone || '');
  const [endereco, setEndereco] = useState(initialEndereco || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!endereco.trim() && !telefone.trim()) {
      setError('Informe ao menos o telefone ou o endereço de entrega');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await salvarDadosEntregaComanda(comandaId, {
        nomeCliente: nomeCliente.trim() || undefined,
        telefone: telefone.trim() || undefined,
        endereco: endereco.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar dados de entrega');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLimpar = async () => {
    setIsLoading(true);
    setError('');
    try {
      await salvarDadosEntregaComanda(comandaId, {
        nomeCliente: nomeCliente.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao limpar dados de entrega');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <div className="size-9 flex items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
                <MapPin className="size-5" />
              </div>
              <div>
                <h3 className="font-bold text-white leading-tight">Dados de Entrega</h3>
                <p className="text-xs text-slate-400">{comandaNome}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </div>
            )}

            <p className="text-xs text-slate-400 leading-relaxed">
              Os dados ficam salvos nesta comanda e são impressos junto com a conta.
              A mesa continua normalmente — nada é enviado para a expedição.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nome do cliente
              </label>
              <input
                type="text"
                value={nomeCliente}
                onChange={(e) => setNomeCliente(e.target.value)}
                placeholder="Nome"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Telefone
              </label>
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Endereço de entrega
              </label>
              <textarea
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, número, bairro, complemento, referência"
                rows={3}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 p-4 border-t border-slate-700">
            {(initialEndereco || initialTelefone) && (
              <button
                onClick={handleLimpar}
                disabled={isLoading}
                className="px-4 py-2.5 border border-slate-600 text-slate-300 font-semibold rounded-xl hover:bg-slate-700 disabled:opacity-50 transition-colors"
                title="Remover dados de entrega desta comanda"
              >
                Limpar
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <MapPin className="size-4" />
                  Salvar
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
