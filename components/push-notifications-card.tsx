'use client';

import React from 'react';
import { BellRing, Smartphone, Share, PlusSquare } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type PushState = 'loading' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on' | 'missing-key';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

async function getRegistration() {
  const existing = await navigator.serviceWorker.getRegistration();
  return existing ?? navigator.serviceWorker.register('/sw.js');
}

export function PushNotificationsCard() {
  const [state, setState] = React.useState<PushState>('loading');
  const [busy, setBusy] = React.useState(false);
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  React.useEffect(() => {
    const detect = async () => {
      if (!publicKey) return setState('missing-key');
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      if (!supported) {
        return setState(isIOS() && !isStandalone() ? 'ios-install' : 'unsupported');
      }
      if (Notification.permission === 'denied') return setState('denied');
      const registration = await getRegistration();
      const subscription = await registration.pushManager.getSubscription();
      setState(subscription && Notification.permission === 'granted' ? 'on' : 'off');
    };
    detect().catch(() => setState('unsupported'));
  }, [publicKey]);

  const enable = async () => {
    if (!publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const registration = await getRegistration();
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) throw new Error('save-failed');

      setState('on');
      await fetch('/api/push/test', { method: 'POST' });
      toast.success('Notificações ativadas neste aparelho');
    } catch {
      toast.error('Não foi possível ativar as notificações. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const registration = await getRegistration();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState('off');
      toast.success('Notificações desativadas neste aparelho');
    } catch {
      toast.error('Não foi possível desativar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const data = await res.json();
      if (data.sent > 0) toast.success('Notificação de teste enviada');
      else toast.error('Nenhum aparelho recebeu. Desative e ative de novo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-5 border border-slate-200 dark:border-zinc-800/60 rounded-2xl bg-white dark:bg-zinc-900/50 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'size-11 rounded-xl flex items-center justify-center shrink-0',
              state === 'on' ? 'bg-primary/15' : 'bg-slate-100 dark:bg-zinc-800',
            )}
          >
            <BellRing className={cn('size-5', state === 'on' ? 'text-primary' : 'text-slate-500')} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-white">Notificações no celular</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed text-pretty">
              Receba um aviso com som na barra de notificações a cada novo pedido, mesmo com o app fechado.
              Ative em cada aparelho que for usar (celular, tablet do balcão, computador).
            </p>
          </div>
        </div>

        {(state === 'on' || state === 'off') && (
          <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
            <span className="sr-only">Ativar notificações neste aparelho</span>
            <input
              type="checkbox"
              className="sr-only peer"
              checked={state === 'on'}
              disabled={busy}
              onChange={(e) => (e.target.checked ? enable() : disable())}
            />
            <div className="w-11 h-6 bg-slate-200 dark:bg-zinc-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary peer-disabled:opacity-50 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50" />
          </label>
        )}
      </div>

      {state === 'on' && (
        <button
          type="button"
          onClick={sendTest}
          disabled={busy}
          className="self-start text-xs font-semibold text-primary hover:underline disabled:opacity-50"
        >
          Enviar notificação de teste
        </button>
      )}

      {state === 'ios-install' && (
        <div className="rounded-xl bg-slate-50 dark:bg-zinc-800/60 p-4 flex flex-col gap-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <p className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <Smartphone className="size-4" /> No iPhone, instale o app primeiro
          </p>
          <p className="flex items-center gap-1.5">
            1. Toque em <Share className="size-3.5" aria-label="Compartilhar" /> Compartilhar no Safari
          </p>
          <p className="flex items-center gap-1.5">
            2. Escolha <PlusSquare className="size-3.5" aria-hidden /> Adicionar à Tela de Início
          </p>
          <p>3. Abra o ZapFlash pelo ícone e volte aqui para ativar.</p>
        </div>
      )}

      {state === 'denied' && (
        <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
          As notificações foram bloqueadas neste navegador. Libere nas configurações do site (ícone de cadeado ao
          lado do endereço) e recarregue a página.
        </p>
      )}

      {state === 'unsupported' && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Este navegador não suporta notificações. Use o Chrome no Android/computador ou o app instalado no iPhone.
        </p>
      )}

      {state === 'missing-key' && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Notificações ainda não configuradas no servidor (chaves VAPID ausentes).
        </p>
      )}
    </div>
  );
}
