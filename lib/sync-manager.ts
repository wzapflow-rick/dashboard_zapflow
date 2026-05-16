/**
 * ZapFlow Sync Manager
 * Gerencia sincronizacao de dados offline com o servidor
 */

import {
  getSyncQueue,
  removeFromSyncQueue,
  updateSyncQueueItem,
  SyncQueueItem,
  clearStore,
} from './offline-store';

// Tipos de callbacks
type SyncCallback = (item: SyncQueueItem) => Promise<boolean>;
type OnlineCallback = () => void;
type OfflineCallback = () => void;

// Registra handlers por tipo de operacao
const syncHandlers: Map<string, SyncCallback> = new Map();

// Callbacks de mudanca de status
const onlineCallbacks: Set<OnlineCallback> = new Set();
const offlineCallbacks: Set<OfflineCallback> = new Set();

// Estado
let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let isSyncing = false;

/**
 * Inicializa o Sync Manager
 */
export function initSyncManager(): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleOnline = () => {
    console.log('[SyncManager] Voltou online');
    isOnline = true;
    onlineCallbacks.forEach((cb) => cb());
    
    // Tenta sincronizar automaticamente
    processQueue();
  };

  const handleOffline = () => {
    console.log('[SyncManager] Ficou offline');
    isOnline = false;
    offlineCallbacks.forEach((cb) => cb());
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Verifica status inicial
  isOnline = navigator.onLine;

  // Cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Registra handler para processar tipo de operacao
 */
export function registerSyncHandler(type: string, handler: SyncCallback): void {
  syncHandlers.set(type, handler);
}

/**
 * Registra callback para quando voltar online
 */
export function onOnline(callback: OnlineCallback): () => void {
  onlineCallbacks.add(callback);
  return () => onlineCallbacks.delete(callback);
}

/**
 * Registra callback para quando ficar offline
 */
export function onOffline(callback: OfflineCallback): () => void {
  offlineCallbacks.add(callback);
  return () => offlineCallbacks.delete(callback);
}

/**
 * Verifica se esta online
 */
export function getOnlineStatus(): boolean {
  return isOnline;
}

/**
 * Verifica se esta sincronizando
 */
export function getSyncingStatus(): boolean {
  return isSyncing;
}

/**
 * Processa a fila de sync
 */
export async function processQueue(): Promise<{
  processed: number;
  failed: number;
  remaining: number;
}> {
  if (!isOnline || isSyncing) {
    const queue = await getSyncQueue();
    return { processed: 0, failed: 0, remaining: queue.length };
  }

  isSyncing = true;
  let processed = 0;
  let failed = 0;

  try {
    const queue = await getSyncQueue();
    console.log('[SyncManager] Processando fila:', queue.length, 'items');

    for (const item of queue) {
      const handler = syncHandlers.get(item.type);
      
      if (!handler) {
        console.warn('[SyncManager] Sem handler para tipo:', item.type);
        // Remove items sem handler (provavelmente obsoletos)
        if (item.attempts > 5) {
          await removeFromSyncQueue(item.id);
        }
        continue;
      }

      try {
        // Atualiza tentativas
        await updateSyncQueueItem(item.id, {
          attempts: item.attempts + 1,
          lastAttempt: Date.now(),
        });

        // Executa handler
        const success = await handler(item);

        if (success) {
          await removeFromSyncQueue(item.id);
          processed++;
          console.log('[SyncManager] Item sincronizado:', item.id);
        } else {
          failed++;
          console.warn('[SyncManager] Falha ao sincronizar:', item.id);
        }
      } catch (error) {
        failed++;
        console.error('[SyncManager] Erro ao processar item:', item.id, error);
        
        // Remove se excedeu tentativas
        if (item.attempts >= 5) {
          console.warn('[SyncManager] Item removido apos 5 tentativas:', item.id);
          await removeFromSyncQueue(item.id);
        }
      }
    }
  } finally {
    isSyncing = false;
  }

  const remainingQueue = await getSyncQueue();
  
  return {
    processed,
    failed,
    remaining: remainingQueue.length,
  };
}

/**
 * Forca sync via Service Worker
 */
export async function triggerBackgroundSync(): Promise<void> {
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    const registration = await navigator.serviceWorker.ready;
    // @ts-ignore - sync API
    await registration.sync.register('zapflow-sync');
    console.log('[SyncManager] Background sync registrado');
  } else {
    // Fallback: processa diretamente
    await processQueue();
  }
}

/**
 * Limpa fila de sync
 */
export async function clearSyncQueue(): Promise<void> {
  await clearStore('sync-queue');
  console.log('[SyncManager] Fila de sync limpa');
}

/**
 * Pinga o servidor para verificar conectividade real
 */
export async function pingServer(): Promise<boolean> {
  try {
    const response = await fetch('/api/health', {
      method: 'HEAD',
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ===========================================
// HANDLERS PADRAO PARA TIPOS COMUNS
// ===========================================

/**
 * Handler para atualizar status de pedido
 */
export async function handleOrderStatusSync(item: SyncQueueItem): Promise<boolean> {
  const { orderId, newStatus, empresaId } = item.payload;
  
  try {
    const response = await fetch('/api/orders/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, status: newStatus, empresaId }),
    });
    
    return response.ok;
  } catch {
    return false;
  }
}

// Registra handlers padrao
if (typeof window !== 'undefined') {
  registerSyncHandler('order-status', handleOrderStatusSync);
}
