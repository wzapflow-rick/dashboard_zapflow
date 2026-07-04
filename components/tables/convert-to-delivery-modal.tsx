'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bike, Loader2, AlertCircle } from 'lucide-react';
import { transformarComandaEmDelivery } from '@/app/actions/tables';

interface ConvertToDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  comandaId: number;
  comandaNome: string;
  onSuccess: () => void;
}

export default function ConvertToDeliveryModal({
  isOpen,
  onClose,
  comandaId,
  comandaNome,
  onSuccess,
}: ConvertToDeliveryModalProps) {
  const [endereco, setEndereco] = useState('');
  const [bairro, setBairro] = useState('');
  const [telefone, setTelefone] = useState('');
  const [taxaEntrega, setTaxaEntrega] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!endereco.trim()) {
      setError('Informe o endereço de entrega');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const taxa = taxaEntrega
        ? Number(taxaEntrega.replace(',', '.'))
        : 0;
      await transformarComandaEmDelivery(comandaId, {
        endereco: endereco.trim(),
        bairro: bairro.trim() || undefined,
        telefone: telefone.trim() || undefined,
        taxaEntrega: Number.isFinite(taxa) ? taxa : 0,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao transformar em delivery');
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
                <Bike className="size-5" />
              </div>
              <div>
                <h3 className="font-bold text-white leading-tight">Transformar em Delivery</h3>
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
              Os pedidos ativos desta comanda vão para o painel de expedição como entrega,
              a comanda é fechada e a mesa liberada. O pagamento acontece na entrega.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Endereço de entrega *
              </label>
              <input
                type="text"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, número, complemento"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Bairro</label>
                <input
                  type="text"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  placeholder="Bairro"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Taxa (R$)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={taxaEntrega}
                  onChange={(e) => setTaxaEntrega(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Telefone do cliente
              </label>
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex gap-3 p-4 border-t border-slate-700">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 border border-slate-600 text-slate-300 font-semibold rounded-xl hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Bike className="size-4" />
                  Enviar p/ Entrega
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
