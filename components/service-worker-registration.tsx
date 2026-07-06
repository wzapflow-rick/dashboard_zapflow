'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Quando um novo Service Worker assume o controle, recarrega a pagina uma
      // unica vez para garantir que o aparelho passe a rodar o codigo novo.
      // Sem isto, celulares ficavam presos numa versao antiga (ex.: impressao
      // sem nome/endereco do cliente) mesmo apos um novo deploy.
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      // Registra o Service Worker
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registrado:', registration.scope);

          // Procura atualizacoes imediatamente e a cada 60s (util em tablets/celulares
          // que ficam com o app aberto o dia todo no balcao).
          registration.update();
          setInterval(() => registration.update(), 60 * 1000);

          // Quando uma nova versao terminar de instalar, ativa na hora.
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[PWA] Nova versao disponivel — ativando');
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
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
