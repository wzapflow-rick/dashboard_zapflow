// ZapFlow Service Worker - Offline First Strategy
const CACHE_NAME = 'zapflow-v1';
const OFFLINE_CACHE = 'zapflow-offline-v1';

// Recursos estaticos para cache inicial
const STATIC_ASSETS = [
  '/dashboard',
  '/dashboard/expedition',
  '/dashboard/orders',
];

// APIs que devem ter cache offline
const API_CACHE_PATTERNS = [
  '/api/orders',
  '/api/products',
  '/api/categories',
  '/api/company',
];

// Instalacao do Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Some static assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// Ativacao - limpa caches antigos
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== OFFLINE_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Estrategia de fetch
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requests nao-GET para cache (mas permitir que passem)
  if (request.method !== 'GET') {
    // Para POST/PUT/DELETE, tenta enviar e, se falhar, salva na sync queue
    if (shouldQueueOffline(url.pathname)) {
      event.respondWith(handleMutationRequest(request));
    }
    return;
  }

  // Estrategia Network First para APIs
  if (isApiRequest(url.pathname)) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Estrategia Cache First para assets estaticos
  event.respondWith(cacheFirstStrategy(request));
});

// Verifica se e uma request de API
function isApiRequest(pathname) {
  return API_CACHE_PATTERNS.some((pattern) => pathname.includes(pattern));
}

// Verifica se deve enfileirar offline
function shouldQueueOffline(pathname) {
  return pathname.includes('/api/orders') || pathname.includes('/actions/');
}

// Network First: tenta rede, fallback para cache
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Se sucesso, atualiza cache
    if (networkResponse.ok) {
      const cache = await caches.open(OFFLINE_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Adiciona header indicando que veio do cache
      const headers = new Headers(cachedResponse.headers);
      headers.set('X-From-Cache', 'true');
      
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers,
      });
    }
    
    // Se nao tem cache, retorna erro de offline
    return new Response(
      JSON.stringify({ 
        error: 'offline', 
        message: 'Voce esta offline e nao ha dados em cache',
        offline: true 
      }),
      {
        status: 503,
        headers: { 
          'Content-Type': 'application/json',
          'X-Offline': 'true'
        },
      }
    );
  }
}

// Cache First: tenta cache, fallback para rede
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // Atualiza cache em background
    fetch(request).then((response) => {
      if (response.ok) {
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, response);
        });
      }
    }).catch(() => {});
    
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Retorna pagina offline generica se disponivel
    return caches.match('/offline.html') || new Response('Offline', { status: 503 });
  }
}

// Lida com requests de mutacao (POST, PUT, DELETE)
async function handleMutationRequest(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch (error) {
    console.log('[SW] Mutation failed, queueing for sync:', request.url);
    
    // Salva na IndexedDB para sync posterior
    const requestData = await serializeRequest(request);
    await saveToSyncQueue(requestData);
    
    // Notifica o cliente
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'SYNC_QUEUED',
          url: request.url,
          timestamp: Date.now(),
        });
      });
    });
    
    // Retorna sucesso simulado para nao quebrar a UI
    return new Response(
      JSON.stringify({ 
        success: true, 
        offline: true,
        message: 'Operacao salva localmente. Sera sincronizada quando voltar online.',
        queued: true
      }),
      {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'X-Offline-Queued': 'true'
        },
      }
    );
  }
}

// Serializa request para salvar
async function serializeRequest(request) {
  const body = await request.text();
  return {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body,
    timestamp: Date.now(),
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  };
}

// Salva na fila de sync (IndexedDB)
async function saveToSyncQueue(requestData) {
  return new Promise((resolve, reject) => {
    const dbRequest = indexedDB.open('zapflow-offline', 1);
    
    dbRequest.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('sync-queue')) {
        db.createObjectStore('sync-queue', { keyPath: 'id' });
      }
    };
    
    dbRequest.onsuccess = (event) => {
      const db = event.target.result;
      const tx = db.transaction('sync-queue', 'readwrite');
      const store = tx.objectStore('sync-queue');
      store.add(requestData);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    
    dbRequest.onerror = () => reject(dbRequest.error);
  });
}

// Background Sync - processa fila quando voltar online
self.addEventListener('sync', (event) => {
  if (event.tag === 'zapflow-sync') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(processSyncQueue());
  }
});

// Processa a fila de sync
async function processSyncQueue() {
  return new Promise((resolve, reject) => {
    const dbRequest = indexedDB.open('zapflow-offline', 1);
    
    dbRequest.onsuccess = async (event) => {
      const db = event.target.result;
      const tx = db.transaction('sync-queue', 'readwrite');
      const store = tx.objectStore('sync-queue');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = async () => {
        const items = getAllRequest.result;
        console.log('[SW] Processing sync queue:', items.length, 'items');
        
        for (const item of items) {
          try {
            const response = await fetch(item.url, {
              method: item.method,
              headers: item.headers,
              body: item.body,
            });
            
            if (response.ok) {
              // Remove da fila
              const deleteTx = db.transaction('sync-queue', 'readwrite');
              deleteTx.objectStore('sync-queue').delete(item.id);
              console.log('[SW] Synced:', item.url);
            }
          } catch (error) {
            console.warn('[SW] Sync failed for:', item.url, error);
          }
        }
        
        // Notifica clientes
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'SYNC_COMPLETE',
              syncedCount: items.length,
              timestamp: Date.now(),
            });
          });
        });
        
        resolve();
      };
    };
    
    dbRequest.onerror = () => reject(dbRequest.error);
  });
}

// Listener para mensagens do cliente
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'FORCE_SYNC') {
    processSyncQueue();
  }
  
  if (event.data.type === 'GET_SYNC_QUEUE_COUNT') {
    getSyncQueueCount().then((count) => {
      event.source.postMessage({
        type: 'SYNC_QUEUE_COUNT',
        count,
      });
    });
  }
});

// Conta items na fila de sync
async function getSyncQueueCount() {
  return new Promise((resolve) => {
    const dbRequest = indexedDB.open('zapflow-offline', 1);
    
    dbRequest.onsuccess = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('sync-queue')) {
        resolve(0);
        return;
      }
      const tx = db.transaction('sync-queue', 'readonly');
      const store = tx.objectStore('sync-queue');
      const countRequest = store.count();
      countRequest.onsuccess = () => resolve(countRequest.result);
      countRequest.onerror = () => resolve(0);
    };
    
    dbRequest.onerror = () => resolve(0);
  });
}

console.log('[SW] Service Worker loaded');
