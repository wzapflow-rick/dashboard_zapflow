'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, Sparkles } from 'lucide-react';
import { perguntarAoZapflow } from '@/app/actions/zapflow-insights';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

const SUGESTOES = [
  'Como aumentar meu ticket medio?',
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
      const res = await perguntarAoZapflow(pergunta, mensagens);
      setMensagens((prev) => [
        ...prev,
        { role: 'assistant', content: res.success ? res.resposta : res.resposta || 'Nao consegui responder agora. Tente de novo.' },
      ]);
    } catch {
      setMensagens((prev) => [...prev, { role: 'assistant', content: 'Ops, tive um problema. Tente novamente.' }]);
    } finally {
      setCarregando(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      enviar(input);
    }
  };

  return (
    <>
      {/* Botao flutuante */}
      <motion.button
        onClick={() => setAberto((v) => !v)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-slate-900 shadow-lg shadow-primary/30"
        style={{ boxShadow: '0 0 24px rgba(34,197,94,0.4)' }}
        aria-label="Abrir chat com o ZapFlow"
      >
        {aberto ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </motion.button>

      <AnimatePresence>
        {aberto && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-40 flex h-[520px] w-[calc(100vw-3rem)] max-w-sm flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0f1f35] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.03] p-4">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/15">
                <Sparkles className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Pergunte ao ZapFlow</p>
                <p className="text-xs text-slate-400">Seu consultor de delivery</p>
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {mensagens.length === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-300">
                    Oi! Sou seu consultor. Pergunte qualquer coisa sobre suas vendas, cardapio ou clientes.
                  </p>
                  <div className="space-y-2">
                    {SUGESTOES.map((s) => (
                      <button
                        key={s}
                        onClick={() => enviar(s)}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs text-slate-300 transition-colors hover:border-primary/40 hover:text-white"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mensagens.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${
                      m.role === 'user'
                        ? 'rounded-br-md bg-primary text-slate-900'
                        : 'rounded-bl-md bg-white/[0.06] text-slate-100'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {carregando && (
                <div className="flex justify-start">
                  <div className="flex gap-1 rounded-2xl rounded-bl-md bg-white/[0.06] px-4 py-3">
                    <span className="size-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                    <span className="size-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                    <span className="size-2 animate-bounce rounded-full bg-slate-400" />
                  </div>
                </div>
              )}
              <div ref={fimRef} />
            </div>

            {/* Input */}
            <div className="border-t border-white/10 p-3">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Digite sua pergunta..."
                  className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  onClick={() => enviar(input)}
                  disabled={carregando || !input.trim()}
                  className="flex size-8 items-center justify-center rounded-full bg-primary text-slate-900 transition-opacity disabled:opacity-40"
                  aria-label="Enviar"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
