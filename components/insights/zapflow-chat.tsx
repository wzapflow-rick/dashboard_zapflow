'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { perguntarAoZapflow } from '@/app/actions/zapflow-insights';
import { cn } from '@/lib/utils';
import { MorphingInfinity } from '@/components/ui/morphing-infinity';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

const SUGESTOES = [
  'Como aumentar meu ticket médio?',
  'O que fazer nos dias mais fracos?',
  'Como recuperar clientes que sumiram?',
];

export function ZapflowChat() {
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, carregando]);

  const enviar = async (texto: string) => {
    const pergunta = texto.trim();
    if (!pergunta || carregando) return;

    const novoHistorico = [...mensagens, { role: 'user' as const, content: pergunta }];
    setMensagens(novoHistorico);
    setInput('');
    setCarregando(true);

    try {
      const result = await perguntarAoZapflow(pergunta, mensagens);
      setMensagens((current) => [
        ...current,
        {
          role: 'assistant',
          content: result.success ? result.resposta : result.resposta || 'Não consegui responder agora. Tente de novo.',
        },
      ]);
    } catch {
      setMensagens((current) => [...current, { role: 'assistant', content: 'Não consegui responder agora. Tente novamente.' }]);
    } finally {
      setCarregando(false);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      enviar(input);
    }
  };

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setAberto((current) => !current)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-24 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-slate-950 shadow-lg shadow-primary/30 lg:bottom-6 lg:right-6"
        style={{ boxShadow: '0 0 24px rgba(34,197,94,0.35)' }}
        aria-label={aberto ? 'Fechar chat com o ZapFlow' : 'Abrir chat com o ZapFlow'}
        aria-expanded={aberto}
        aria-controls="zapflow-chat-panel"
      >
        {aberto ? <X className="size-6" aria-hidden="true" /> : <MessageCircle className="size-6" aria-hidden="true" />}
      </motion.button>

      <AnimatePresence>
        {aberto && (
          <motion.aside
            id="zapflow-chat-panel"
            role="dialog"
            aria-label="Pergunte ao ZapFlow"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-40 right-4 z-40 flex h-[calc(100dvh-11rem)] max-h-[520px] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-slate-700/60 dark:bg-[#0f1f35]/95 lg:bottom-24 lg:right-6 lg:h-[520px] lg:w-[calc(100vw-3rem)]"
          >
            <header className="flex items-center gap-3 border-b border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-700/50 dark:bg-white/[0.03]">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/15">
                <Sparkles className="size-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Pergunte ao ZapFlow</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Seu consultor de delivery</p>
              </div>
            </header>

            <div className="custom-scrollbar flex flex-1 flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
              {mensagens.length === 0 && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    Oi! Sou seu consultor. Pergunte qualquer coisa sobre suas vendas, cardápio ou clientes.
                  </p>
                  <div className="flex flex-col gap-2">
                    {SUGESTOES.map((sugestao) => (
                      <button
                        key={sugestao}
                        type="button"
                        onClick={() => enviar(sugestao)}
                        disabled={carregando}
                        className="w-full rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-left text-xs text-slate-600 transition-colors hover:border-primary/40 hover:text-slate-900 disabled:opacity-50 dark:border-slate-700/60 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:text-white"
                      >
                        {sugestao}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mensagens.map((mensagem, index) => (
                <div key={index} className={cn('flex', mensagem.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                      mensagem.role === 'user'
                        ? 'rounded-br-md bg-primary text-slate-950'
                        : 'rounded-bl-md bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-slate-100',
                    )}
                  >
                    {mensagem.content}
                  </div>
                </div>
              ))}

              {carregando && (
                <div className="flex justify-start" role="status" aria-label="ZapFlow está respondendo">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3 text-slate-500 dark:bg-white/[0.06] dark:text-slate-300">
                    <MorphingInfinity className="size-5 text-primary" aria-hidden="true" />
                    <span className="text-xs font-medium">Pensando...</span>
                  </div>
                </div>
              )}
              <div ref={fimRef} />
            </div>

            <div className="border-t border-slate-200/70 p-3 dark:border-slate-700/50">
              <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/70 px-3 py-1.5 focus-within:border-primary/40 dark:border-slate-700/60 dark:bg-white/[0.03]">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Digite sua pergunta..."
                  aria-label="Pergunta para o ZapFlow"
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => enviar(input)}
                  disabled={carregando || !input.trim()}
                  className="flex size-8 items-center justify-center rounded-full bg-primary text-slate-950 transition-opacity disabled:opacity-40"
                  aria-label="Enviar pergunta"
                >
                  <Send className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
