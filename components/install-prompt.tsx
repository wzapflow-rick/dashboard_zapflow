'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'zapflow-install-dismissed';

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    // Se ja esta instalado (standalone), nao mostra nada
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-expect-error - propriedade especifica do Safari iOS
      window.navigator.standalone === true;

    if (isStandalone) return;

    // Se o usuario ja dispensou recentemente, nao mostra
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const days = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (days < 7) return;
    }

    // Detecta iOS (Safari nao dispara beforeinstallprompt)
    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setIsIOS(true);
      setShowBanner(true);
      return;
    }

    // Android / Chrome: captura o evento de instalacao
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSHelp(true);
      return;
    }

    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setShowIOSHelp(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  if (!showBanner) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-4 md:left-auto md:right-4 md:bottom-4 md:max-w-sm">
      <div className="rounded-2xl border border-border bg-card shadow-lg p-4">
        {showIOSHelp ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-card-foreground text-pretty">
                Como instalar no iPhone
              </h3>
              <button
                onClick={handleDismiss}
                className="p-1 -m-1 text-muted-foreground hover:text-card-foreground"
                aria-label="Fechar"
              >
                <X className="size-5" />
              </button>
            </div>
            <ol className="text-sm text-muted-foreground leading-relaxed flex flex-col gap-2">
              <li className="flex items-center gap-2">
                <span>{'1.'}</span>
                <span className="flex items-center gap-1">
                  Toque no botao Compartilhar
                  <Share className="size-4 inline" />
                  na barra do Safari
                </span>
              </li>
              <li>{'2. Escolha "Adicionar a Tela de Inicio"'}</li>
              <li>{'3. Toque em "Adicionar" no canto superior'}</li>
            </ol>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Download className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-card-foreground leading-tight">
                Instalar o app
              </h3>
              <p className="text-sm text-muted-foreground leading-snug">
                Acesse mais rapido, em tela cheia, direto da tela inicial.
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 -m-1 text-muted-foreground hover:text-card-foreground"
              aria-label="Agora nao"
            >
              <X className="size-5" />
            </button>
          </div>
        )}

        {!showIOSHelp && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleInstall}
              className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {isIOS ? 'Ver como instalar' : 'Instalar agora'}
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Agora nao
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
