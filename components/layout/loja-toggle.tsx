'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Power, Loader2, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Status {
  aberto: boolean;
  fechadoManual: boolean;
  abertoManual: boolean;
  proximaAbertura: { label: string } | null;
}

export function LojaToggle() {
  const [status, setStatus] = React.useState<Status | null>(null);
  const [loading, setLoading] = React.useState(false);
  // 'fechar' = confirmar fechamento; 'abrir' = confirmar abertura; null = fechado.
  const [confirmMode, setConfirmMode] = React.useState<'fechar' | 'abrir' | null>(null);

  const carregar = React.useCallback(async () => {
    try {
      const { getLojaStatus } = await import('@/app/actions/loja-status');
      const res = await getLojaStatus();
      if (res.ok) {
        setStatus({
          aberto: res.aberto,
          fechadoManual: res.fechadoManual,
          abertoManual: res.abertoManual,
          proximaAbertura: res.proximaAbertura,
        });
      }
    } catch (_) {}
  }, []);

  React.useEffect(() => {
    queueMicrotask(carregar);
    const interval = setInterval(carregar, 60000);
    return () => clearInterval(interval);
  }, [carregar]);

  const fechar = async () => {
    setLoading(true);
    try {
      const { fecharLojaManual } = await import('@/app/actions/loja-status');
      const res = await fecharLojaManual();
      if (res.ok) {
        setStatus({
          aberto: res.aberto,
          fechadoManual: res.fechadoManual,
          abertoManual: res.abertoManual,
          proximaAbertura: res.proximaAbertura,
        });
      }
    } catch (_) {
    } finally {
      setLoading(false);
      setConfirmMode(null);
    }
  };

  const abrir = async () => {
    setLoading(true);
    try {
      const { abrirLojaManual } = await import('@/app/actions/loja-status');
      const res = await abrirLojaManual();
      if (res.ok) {
        setStatus({
          aberto: res.aberto,
          fechadoManual: res.fechadoManual,
          abertoManual: res.abertoManual,
          proximaAbertura: res.proximaAbertura,
        });
      }
    } catch (_) {
    } finally {
      setLoading(false);
      setConfirmMode(null);
    }
  };

  if (!status) return null;

  const aberto = status.aberto;

  return (
    <>
      <motion.button
        onClick={() => setConfirmMode(aberto ? 'fechar' : 'abrir')}
        disabled={loading}
        className={cn(
          'flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all border disabled:opacity-60',
          aberto
            ? 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 hover:border-emerald-500/40'
            : 'bg-red-500/10 dark:bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20 hover:border-red-500/40',
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        title={aberto ? 'Clique para fechar a loja agora' : 'Clique para abrir a loja'}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <span className="relative flex size-2.5">
            <span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-75',
                aberto ? 'animate-ping bg-emerald-500' : 'bg-red-500',
              )}
            />
            <span
              className={cn(
                'relative inline-flex size-2.5 rounded-full',
                aberto ? 'bg-emerald-500' : 'bg-red-500',
              )}
            />
          </span>
        )}
        <span className="hidden sm:inline">{aberto ? 'Loja aberta' : 'Loja fechada'}</span>
        <span className="sm:hidden">{aberto ? 'Aberta' : 'Fechada'}</span>
      </motion.button>

      {/* Modal de confirmacao (fechar OU abrir a loja) */}
      <AnimatePresence>
        {confirmMode && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setConfirmMode(null)}
            />
            <motion.div
              className="relative w-full max-w-md rounded-2xl bg-white dark:bg-[#0f1f35] border border-slate-200 dark:border-white/10 shadow-2xl p-6"
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <button
                onClick={() => setConfirmMode(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                aria-label="Fechar"
              >
                <X className="size-4" />
              </button>

              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    'size-12 shrink-0 rounded-xl flex items-center justify-center',
                    confirmMode === 'fechar' ? 'bg-red-500/10' : 'bg-emerald-500/10',
                  )}
                >
                  {confirmMode === 'fechar' ? (
                    <AlertTriangle className="size-6 text-red-500" />
                  ) : (
                    <Power className="size-6 text-emerald-500" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                    {confirmMode === 'fechar' ? 'Fechar a loja agora?' : 'Abrir a loja agora?'}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {confirmMode === 'fechar'
                      ? `O cardapio sera bloqueado para novos pedidos imediatamente. A loja${
                          status.proximaAbertura
                            ? ` reabre automaticamente ${status.proximaAbertura.label}.`
                            : ' permanecera fechada ate voce abrir novamente.'
                        }`
                      : 'A loja abrira agora para receber pedidos, mesmo fora do horario configurado (ex.: feriado). Ela volta a seguir o horario normal automaticamente amanha.'}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setConfirmMode(null)}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmMode === 'fechar' ? fechar : abrir}
                  disabled={loading}
                  className={cn(
                    'flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-60',
                    confirmMode === 'fechar'
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-emerald-500 hover:bg-emerald-600',
                  )}
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Power className="size-4" />
                  )}
                  {confirmMode === 'fechar' ? 'Fechar loja' : 'Abrir loja'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
