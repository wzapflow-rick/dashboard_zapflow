'use client';

import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw, Send } from 'lucide-react';
import { display, formatBRL } from './content';

const menu = [
  { id: 'smash', name: 'Smash duplo', desc: 'Dois blends, cheddar e cebola caramelizada', price: 32.9 },
  { id: 'batata', name: 'Batata rústica', desc: 'Com páprica e maionese da casa', price: 14 },
  { id: 'acai', name: 'Açaí 500 ml', desc: 'Banana, granola e leite em pó', price: 22 },
];

type Message = { from: 'cliente' | 'loja'; text: string };

export function OrderDemo() {
  const [qty, setQty] = useState<Record<string, number>>({ smash: 1 });
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const items = menu.filter((m) => (qty[m.id] ?? 0) > 0);
  const total = items.reduce((s, m) => s + m.price * qty[m.id], 0);
  const locked = sending || messages.length > 0;

  function change(id: string, delta: number) {
    if (locked) return;
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(9, (q[id] ?? 0) + delta)) }));
  }

  function sendOrder() {
    if (!items.length || locked) return;
    const summary = items.map((m) => `${qty[m.id]}x ${m.name}`).join(', ');
    const script: Message[] = [
      { from: 'cliente', text: `Pedido pelo cardápio: ${summary}. Total ${formatBRL(total)}.` },
      { from: 'loja', text: `Recebemos seu pedido #1042! Segue o Pix copia e cola de ${formatBRL(total)}.` },
      { from: 'loja', text: 'Pagamento confirmado. Seu pedido já está na cozinha, previsão de 35 min.' },
      { from: 'loja', text: 'Saiu para entrega! O motoboy chega em cerca de 10 min.' },
    ];
    setSending(true);
    script.forEach((msg, i) => {
      timers.current.push(
        setTimeout(() => {
          setMessages((prev) => [...prev, msg]);
          if (i === script.length - 1) setSending(false);
        }, i * 1100),
      );
    });
  }

  function reset() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setMessages([]);
    setSending(false);
    setQty({ smash: 1 });
  }

  return (
    <div className="grid items-start gap-6 md:grid-cols-2">
      <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <p className={`${display} text-lg font-semibold text-zinc-50`}>Tropical Burger</p>
            <p className="text-sm text-emerald-400">Aberto agora</p>
          </div>
          <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-400">Cardápio do cliente</span>
        </div>

        <ul className="divide-y divide-zinc-800/70">
          {menu.map((m) => {
            const n = qty[m.id] ?? 0;
            return (
              <li key={m.id} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-100">{m.name}</p>
                  <p className="truncate text-sm text-zinc-500">{m.desc}</p>
                  <p className="mt-1 text-sm font-semibold text-amber-400">{formatBRL(m.price)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => change(m.id, -1)}
                    disabled={locked || n === 0}
                    aria-label={`Remover ${m.name}`}
                    className="flex size-9 items-center justify-center rounded-full border border-zinc-700 text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-30"
                  >
                    <Minus className="size-4" aria-hidden />
                  </button>
                  <span className="w-5 text-center tabular-nums text-zinc-100" aria-live="polite">
                    {n}
                  </span>
                  <button
                    type="button"
                    onClick={() => change(m.id, 1)}
                    disabled={locked}
                    aria-label={`Adicionar ${m.name}`}
                    className="flex size-9 items-center justify-center rounded-full bg-amber-500 text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-30"
                  >
                    <Plus className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={sendOrder}
          disabled={!items.length || locked}
          className="mt-2 flex h-12 w-full items-center justify-between rounded-full bg-emerald-500 px-5 font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          <span className="flex items-center gap-2">
            <Send className="size-4" aria-hidden />
            {locked ? 'Pedido enviado' : 'Fazer pedido'}
          </span>
          <span className="tabular-nums">{formatBRL(total)}</span>
        </button>
      </div>

      <div className="flex min-h-[420px] flex-col overflow-hidden rounded-[2rem] border border-zinc-800 bg-[#0b141a]">
        <div className="flex items-center gap-3 bg-[#1f2c33] px-5 py-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-zinc-950" aria-hidden>
            TB
          </span>
          <div>
            <p className="text-sm font-semibold text-zinc-50">Tropical Burger</p>
            <p className="text-xs text-zinc-400">{sending ? 'digitando…' : 'WhatsApp com atendimento automático'}</p>
          </div>
        </div>

        <ol className="flex flex-1 flex-col gap-2 p-4" aria-live="polite" aria-label="Conversa no WhatsApp">
          {messages.length === 0 ? (
            <li className="m-auto max-w-[16rem] text-center text-sm text-zinc-500">
              Monte o pedido ao lado e toque em Fazer pedido para ver a automação responder.
            </li>
          ) : (
            messages.map((m, i) => (
              <li
                key={i}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed motion-safe:animate-[demo-in_250ms_ease-out] ${
                  m.from === 'cliente'
                    ? 'self-end rounded-br-sm bg-[#005c4b] text-zinc-50'
                    : 'self-start rounded-bl-sm bg-[#1f2c33] text-zinc-100'
                }`}
              >
                {m.text}
              </li>
            ))
          )}
        </ol>

        {messages.length > 0 && !sending ? (
          <button
            type="button"
            onClick={reset}
            className="m-4 mt-0 inline-flex items-center justify-center gap-2 self-end rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
          >
            <RotateCcw className="size-4" aria-hidden />
            Simular outro pedido
          </button>
        ) : null}
      </div>
    </div>
  );
}
