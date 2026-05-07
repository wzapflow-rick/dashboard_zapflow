'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Registra o Service Worker
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registrado:', registration.scope);

          // Verifica atualizacoes periodicamente
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // Nova versao disponivel
                  console.log('[PWA] Nova versao disponivel');
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('[PWA] Erro ao registrar Service Worker:', error);
        });

      // Listener para mensagens do Service Worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_QUEUED') {
          console.log('[PWA] Operacao enfileirada para sync:', event.data.url);
        }
        if (event.data.type === 'SYNC_COMPLETE') {
          console.log('[PWA] Sync completo:', event.data.syncedCount, 'items');
        }
      });
    }
  }, []);

  return null;
}
