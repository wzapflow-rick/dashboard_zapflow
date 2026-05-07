'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  initSyncManager,
  onOnline,
  onOffline,
  getOnlineStatus,
  processQueue,
  getSyncingStatus,
} from '@/lib/sync-manager';
import {
  getSyncQueueCount,
  cacheOrders,
  getCachedOrders,
  updateCachedOrderStatus,
  addToSyncQueue,
  CachedOrder,
  isIndexedDBAvailable,
} from '@/lib/offline-store';

interface UseOfflineReturn {
  isOnline: boolean;
  isOfflineReady: boolean;
  isSyncing: boolean;
  pendingCount: number;
  // Funcoes para pedidos
  getCachedOrders: () => Promise<CachedOrder[]>;
  cacheOrders: (orders: CachedOrder[]) => Promise<void>;
  updateOrderStatusOffline: (orderId: number, status: string, empresaId: number) => Promise<void>;
  // Funcoes de sync
  forceSync: () => Promise<{ processed: number; failed: number; remaining: number }>;
  // Status
  lastSyncTime: Date | null;
}

/**
 * Hook para gerenciar estado offline e sincronizacao
 */
export function useOffline(): UseOfflineReturn {
  const [isOnline, setIsOnline] = useState(true);
  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Inicializa sync manager e listeners
  useEffect(() => {
    // Verifica se IndexedDB esta disponivel
    if (!isIndexedDBAvailable()) {
      console.warn('[useOffline] IndexedDB nao disponivel');
      return;
    }

    setIsOfflineReady(true);
    setIsOnline(getOnlineStatus());

    // Inicializa sync manager
    const cleanup = initSyncManager();

    // Registra callbacks
    const unsubOnline = onOnline(() => {
      setIsOnline(true);
      // Atualiza contagem apos sync
      setTimeout(() => updatePendingCount(), 1000);
    });

    const unsubOffline = onOffline(() => {
      setIsOnline(false);
    });

    // Atualiza contagem inicial
    updatePendingCount();

    // Listener para mensagens do Service Worker
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data.type === 'SYNC_COMPLETE') {
        setLastSyncTime(new Date());
        updatePendingCount();
      }
      if (event.data.type === 'SYNC_QUEUED') {
        updatePendingCount();
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }

    return () => {
      cleanup();
      unsubOnline();
      unsubOffline();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
    };
  }, []);

  // Atualiza contagem de items pendentes
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await getSyncQueueCount();
      setPendingCount(count);
    } catch (error) {
      console.error('[useOffline] Erro ao contar pendentes:', error);
    }
  }, []);

  // Atualiza status de pedido (funciona offline)
  const updateOrderStatusOffline = useCallback(
    async (orderId: number, status: string, empresaId: number) => {
      // Atualiza cache local imediatamente
      await updateCachedOrderStatus(orderId, status);

      if (isOnline) {
        // Se online, tenta enviar diretamente
        // A action real vai fazer isso
        return;
      }

      // Se offline, adiciona na fila de sync
      await addToSyncQueue('order-status', {
        orderId,
        newStatus: status,
        empresaId,
        timestamp: Date.now(),
      });

      await updatePendingCount();
    },
    [isOnline, updatePendingCount]
  );

  // Forca sincronizacao
  const forceSync = useCallback(async () => {
    if (!isOnline) {
      return { processed: 0, failed: 0, remaining: pendingCount };
    }

    setIsSyncing(true);
    try {
      const result = await processQueue();
      setLastSyncTime(new Date());
      await updatePendingCount();
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, pendingCount, updatePendingCount]);

  return {
    isOnline,
    isOfflineReady,
    isSyncing,
    pendingCount,
    getCachedOrders,
    cacheOrders,
    updateOrderStatusOffline,
    forceSync,
    lastSyncTime,
  };
}

/**
 * Hook simplificado apenas para status online/offline
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
