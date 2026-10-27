'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useState } from 'react';
import { Bot, Megaphone, QrCode, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getBotConfig, saveBotConfig } from '@/app/actions/bot';
import { useWhatsappStatus } from '@/hooks/use-whatsapp-status';

const STATE_COPY = {
  connected: { title: 'Conectado', hint: 'Recebendo mensagens normalmente.', tone: 'text-emerald-600 dark:text-emerald-400' },
  connecting: { title: 'Conectando', hint: 'Aguardando confirmação da instância.', tone: 'text-amber-600 dark:text-amber-400' },
  disconnected: { title: 'Desconectado', hint: 'Escaneie o QR Code para reconectar.', tone: 'text-red-600 dark:text-red-400' },
} as const;

const cardClass =
  'flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 transition-colors dark:border-zinc-800/60 dark:bg-[#111113] dark:hover:border-zinc-700/70';

export function ControlCenter() {
  const { status } = useWhatsappStatus();
  const { data: botConfig, mutate } = useSWR('bot-config', () => getBotConfig());
  const [saving, setSaving] = useState(false);

  const state = status ?? 'connecting';
  const copy = STATE_COPY[state];
  const botActive = botConfig?.bot_ativo ?? false;

  const handleBotToggle = async (checked: boolean) => {
    setSaving(true);
    mutate(botConfig ? { ...botConfig, bot_ativo: checked } : botConfig, { revalidate: false });
    const result = await saveBotConfig({ bot_ativo: checked });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error || 'Não foi possível alterar o bot.');
      mutate();
      return;
    }
    toast.success(checked ? 'Bot de saudação ativado' : 'Bot de saudação pausado');
  };

  return (
    <section aria-label="Controle rápido" className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <span className="flex size-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-white/[0.04]">
            <QrCode className="size-4 text-zinc-600 dark:text-zinc-300" aria-hidden="true" />
          </span>
          <span className={cn('flex items-center gap-1.5 text-xs font-medium', copy.tone)}>
            <span
              aria-hidden="true"
              className={cn(
                'size-1.5 rounded-full',
                state === 'connected' && 'bg-emerald-500',
                state === 'connecting' && 'bg-amber-500',
                state === 'disconnected' && 'bg-red-500',
              )}
            />
            {copy.title}
          </span>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Instância do WhatsApp</h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{copy.hint}</p>
        </div>
        <Link
          href="/dashboard/settings"
          className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-zinc-700 transition-colors hover:text-primary dark:text-zinc-300"
        >
          Gerenciar conexão
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <span className="flex size-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-white/[0.04]">
            <Bot className="size-4 text-zinc-600 dark:text-zinc-300" aria-hidden="true" />
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={botActive}
            aria-label="Ativar bot de saudação"
            data-testid="toggle-greeting-bot"
            disabled={saving || !botConfig}
            onClick={() => handleBotToggle(!botActive)}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50',
              botActive ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'inline-block size-4 rounded-full bg-white shadow transition-transform',
                botActive ? 'translate-x-[18px]' : 'translate-x-0.5',
              )}
            />
          </button>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Bot de saudação</h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {botActive ? 'Respondendo novos contatos com o cardápio.' : 'Pausado. Novos contatos não recebem resposta automática.'}
          </p>
        </div>
        <Link
          href="/dashboard/settings"
          className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-zinc-700 transition-colors hover:text-primary dark:text-zinc-300"
        >
          Editar mensagens
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className={cardClass}>
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <Megaphone className="size-4 text-primary" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Nova campanha</h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Envie uma oferta para sua base de clientes pelo WhatsApp.
          </p>
        </div>
        <Link
          href="/dashboard/campanhas"
          className="mt-auto inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          Criar disparo
        </Link>
      </div>
    </section>
  );
}
