/**
 * ZapFlow Offline Store
 * Gerencia cache local usando IndexedDB para funcionamento offline
 */

const DB_NAME = 'zapflow-offline';
const DB_VERSION = 1;

// Stores disponiveis
export type StoreName = 'orders' | 'products' | 'categories' | 'company' | 'sync-queue';

// Interface para items com TTL
interface CachedItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // em milissegundos
}

// TTL padrao por store (em milissegundos)
const DEFAULT_TTL: Record<StoreName, number> = {
  'orders': 5 * 60 * 1000,      // 5 minutos
  'products': 30 * 60 * 1000,   // 30 minutos
  'categories': 60 * 60 * 1000, // 1 hora
  'company': 60 * 60 * 1000,    // 1 hora
  'sync-queue': Infinity,        // Nunca expira
};

// Singleton da conexao do banco
let dbConnection: IDBDatabase | null = null;

/**
 * Abre conexao com IndexedDB
 */
async function openDB(): Promise<IDBDatabase> {
  if (dbConnection) return dbConnection;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[OfflineStore] Erro ao abrir banco:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbConnection = request.result;
      
      // Limpa conexao se o banco fechar
      dbConnection.onclose = () => {
        dbConnection = null;
      };
      
      resolve(dbConnection);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Cria stores se nao existirem
      if (!db.objectStoreNames.contains('orders')) {
        const ordersStore = db.createObjectStore('orders', { keyPath: 'id' });
        ordersStore.createIndex('status', 'data.status', { unique: false });
        ordersStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('company')) {
        db.createObjectStore('company', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('sync-queue')) {
        const syncStore = db.createObjectStore('sync-queue', { keyPath: 'id' });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      console.log('[OfflineStore] Banco criado/atualizado');
    };
  });
}

/**
 * Salva item no store
 */
export async function setItem<T>(
  store: StoreName,
  id: string | number,
  data: T,
  ttl?: number
): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const objectStore = tx.objectStore(store);

    const item: CachedItem<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? DEFAULT_TTL[store],
    };

    const request = objectStore.put({ id, ...item });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Busca item do store
 */
export async function getItem<T>(
  store: StoreName,
  id: string | number
): Promise<T | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const objectStore = tx.objectStore(store);
    const request = objectStore.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result = request.result as (CachedItem<T> & { id: string | number }) | undefined;
      
      if (!result) {
        resolve(null);
        return;
      }

      // Verifica TTL
      if (result.ttl !== Infinity && Date.now() - result.timestamp > result.ttl) {
        // Cache expirado, remove e retorna null
        deleteItem(store, id).catch(console.error);
        resolve(null);
        return;
      }

      resolve(result.data);
    };
  });
}

/**
 * Busca todos os items de um store
 */
export async function getAllItems<T>(store: StoreName): Promise<T[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const objectStore = tx.objectStore(store);
    const request = objectStore.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result as (CachedItem<T> & { id: string | number })[];
      const now = Date.now();
      
      // Filtra items expirados
      const validItems = results.filter((item) => {
        if (item.ttl === Infinity) return true;
        return now - item.timestamp <= item.ttl;
      });

      resolve(validItems.map((item) => item.data));
    };
  });
}

/**
 * Remove item do store
 */
export async function deleteItem(
  store: StoreName,
  id: string | number
): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const objectStore = tx.objectStore(store);
    const request = objectStore.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Limpa todo o store
 */
export async function clearStore(store: StoreName): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const objectStore = tx.objectStore(store);
    const request = objectStore.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Salva multiplos items de uma vez
 */
export async function setItems<T>(
  store: StoreName,
  items: Array<{ id: string | number; data: T }>,
  ttl?: number
): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const objectStore = tx.objectStore(store);
    const timestamp = Date.now();
    const itemTtl = ttl ?? DEFAULT_TTL[store];

    items.forEach(({ id, data }) => {
      objectStore.put({
        id,
        data,
        timestamp,
        ttl: itemTtl,
      });
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ===========================================
// FUNCOES ESPECIFICAS PARA SYNC QUEUE
// ===========================================

export interface SyncQueueItem {
  id: string;
  type: 'order-status' | 'create-order' | 'other';
  payload: any;
  timestamp: number;
  attempts: number;
  lastAttempt?: number;
}

/**
 * Adiciona item na fila de sync
 */
export async function addToSyncQueue(
  type: SyncQueueItem['type'],
  payload: any
): Promise<string> {
  const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const item: SyncQueueItem = {
    id,
    type,
    payload,
    timestamp: Date.now(),
    attempts: 0,
  };

  await setItem('sync-queue', id, item);
  return id;
}

/**
 * Busca items da fila de sync
 */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const items = await getAllItems<SyncQueueItem>('sync-queue');
  return items.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Remove item da fila de sync
 */
export async function removeFromSyncQueue(id: string): Promise<void> {
  await deleteItem('sync-queue', id);
}

/**
 * Atualiza tentativas de um item
 */
export async function updateSyncQueueItem(
  id: string,
  updates: Partial<SyncQueueItem>
): Promise<void> {
  const item = await getItem<SyncQueueItem>('sync-queue', id);
  if (item) {
    await setItem('sync-queue', id, { ...item, ...updates });
  }
}

/**
 * Conta items na fila de sync
 */
export async function getSyncQueueCount(): Promise<number> {
  const items = await getSyncQueue();
  return items.length;
}

// ===========================================
// FUNCOES ESPECIFICAS PARA PEDIDOS
// ===========================================

export interface CachedOrder {
  id: number;
  codigo: string;
  status: string;
  cliente_nome?: string;
  cliente_telefone?: string;
  total: number;
  created_at: string;
  items?: any[];
  endereco?: any;
  observacao?: string;
}

/**
 * Salva pedidos no cache
 */
export async function cacheOrders(orders: CachedOrder[]): Promise<void> {
  await setItems(
    'orders',
    orders.map((order) => ({ id: order.id, data: order }))
  );
}

/**
 * Busca pedidos do cache
 */
export async function getCachedOrders(): Promise<CachedOrder[]> {
  return getAllItems<CachedOrder>('orders');
}

/**
 * Busca pedido especifico do cache
 */
export async function getCachedOrder(id: number): Promise<CachedOrder | null> {
  return getItem<CachedOrder>('orders', id);
}

/**
 * Atualiza status de pedido no cache
 */
export async function updateCachedOrderStatus(
  id: number,
  status: string
): Promise<void> {
  const order = await getCachedOrder(id);
  if (order) {
    await setItem('orders', id, { ...order, status });
  }
}

// ===========================================
// UTILIDADES
// ===========================================

/**
 * Verifica se IndexedDB esta disponivel
 */
export function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

/**
 * Limpa todos os caches (exceto sync-queue)
 */
export async function clearAllCaches(): Promise<void> {
  await Promise.all([
    clearStore('orders'),
    clearStore('products'),
    clearStore('categories'),
    clearStore('company'),
  ]);
}

/**
 * Exporta dados para debug
 */
export async function exportOfflineData(): Promise<{
  orders: CachedOrder[];
  syncQueue: SyncQueueItem[];
  syncQueueCount: number;
}> {
  const [orders, syncQueue] = await Promise.all([
    getCachedOrders(),
    getSyncQueue(),
  ]);

  return {
    orders,
    syncQueue,
    syncQueueCount: syncQueue.length,
  };
}
