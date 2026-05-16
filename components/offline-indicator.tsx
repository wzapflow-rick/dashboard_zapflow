'use client';

import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, X, CloudOff, AlertTriangle } from 'lucide-react';
import { useOffline } from '@/hooks/use-offline';
import { cn } from '@/lib/utils';

interface OfflineIndicatorProps {
  className?: string;
}

export function OfflineIndicator({ className }: OfflineIndicatorProps) {
  const { isOnline, pendingCount, forceSync, isSyncing } = useOffline();
  const [dismissed, setDismissed] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  // Mostra o banner quando ficar offline
  useEffect(() => {
    if (!isOnline) {
      setDismissed(false);
      setShowBanner(true);
    } else {
      // Esconde apos 3 segundos quando voltar online
      const timer = setTimeout(() => {
        setShowBanner(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  // Nao renderiza se estiver online e nao tiver pendencias
  if (isOnline && pendingCount === 0 && !showBanner) {
    return null;
  }

  // Nao renderiza se foi dispensado e estiver online
  if (dismissed && isOnline) {
    return null;
  }

  // Banner de sucesso quando voltar online
  if (isOnline && showBanner && pendingCount === 0) {
    return (
      <div
        className={cn(
          'fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50',
          'bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg',
          'flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300',
          className
        )}
      >
        <div className="size-8 bg-white/20 rounded-lg flex items-center justify-center">
          <RefreshCw className="size-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold">Conexao restaurada</p>
          <p className="text-xs text-green-100">Seus dados estao sincronizados</p>
        </div>
        <button
          onClick={() => setShowBanner(false)}
          className="size-8 hover:bg-white/10 rounded-lg flex items-center justify-center transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  // Banner principal de offline
  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50',
        'bg-amber-500 text-white px-4 py-3 rounded-xl shadow-lg shadow-amber-500/20',
        'animate-in slide-in-from-bottom-5 duration-300',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
          {isOnline ? (
            <AlertTriangle className="size-5" />
          ) : (
            <CloudOff className="size-5" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold">
              {isOnline ? 'Sincronizando...' : 'Voce esta offline'}
            </p>
            {!isOnline && (
              <button
                onClick={() => setDismissed(true)}
                className="size-6 hover:bg-white/10 rounded-lg flex items-center justify-center transition-colors shrink-0"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          
          <p className="text-xs text-amber-100 mt-0.5">
            {isOnline 
              ? `Sincronizando ${pendingCount} operacao(oes)...`
              : 'Voce pode continuar trabalhando. Os dados serao sincronizados quando a conexao voltar.'
            }
          </p>
          
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-1 bg-white/20 rounded-lg text-xs font-medium">
                {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
              </span>
              
              {isOnline && (
                <button
                  onClick={() => forceSync()}
                  disabled={isSyncing}
                  className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={cn('size-3', isSyncing && 'animate-spin')} />
                  {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Indicador compacto para usar em headers
 */
export function OfflineStatusBadge({ className }: { className?: string }) {
  const { isOnline, pendingCount, isSyncing } = useOffline();

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        isOnline 
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
          : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 animate-pulse',
        className
      )}
    >
      {isOnline ? (
        <RefreshCw className={cn('size-3', isSyncing && 'animate-spin')} />
      ) : (
        <WifiOff className="size-3" />
      )}
      {isOnline 
        ? `${pendingCount} pendente${pendingCount > 1 ? 's' : ''}`
        : 'Offline'
      }
    </div>
  );
}
