'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useWhatsappStatus } from '@/hooks/use-whatsapp-status';

const LABELS = {
  connected: 'WhatsApp conectado',
  connecting: 'Conectando',
  disconnected: 'WhatsApp offline',
} as const;

export function WhatsappStatusBadge({ className }: { className?: string }) {
  const { status, isLoading } = useWhatsappStatus();
  const state = status ?? 'connecting';
  const label = isLoading && !status ? 'Verificando' : LABELS[state];

  return (
    <Link
      href="/dashboard/settings"
      aria-label={`${label}. Abrir configurações da conexão`}
      className={cn(
        'group inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        state === 'connected' &&
          'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400',
        state === 'connecting' &&
          'border-amber-500/25 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400',
        state === 'disconnected' &&
          'border-red-500/25 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:text-red-400',
        className,
      )}
    >
      <span className="relative flex size-2" aria-hidden="true">
        {state === 'connected' && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
        )}
        <span
          className={cn(
            'relative inline-flex size-2 rounded-full',
            state === 'connected' && 'bg-emerald-500',
            state === 'connecting' && 'bg-amber-500',
            state === 'disconnected' && 'bg-red-500',
          )}
        />
      </span>
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  );
}
