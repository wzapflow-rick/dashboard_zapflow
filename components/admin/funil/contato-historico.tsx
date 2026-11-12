'use client';

import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Info, Pause, Play, CheckCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { MorphingInfinity } from '@/components/ui/morphing-infinity';
import { concluirAtendimento, getInteracoesContato, retomarAutomacao } from '@/app/actions/funil';
import type { FunilContato } from '@/lib/funil-config';
import type { Interacao } from '@/lib/crm-interacoes';

const ROTULO_TIPO: Record<string, string> = {
  mensagem_recebida: 'Mensagem recebida',
  mensagem_enviada: 'Mensagem enviada',
  estagio_alterado: 'Estágio alterado',
  automacao_pausada: 'Automação pausada',
  automacao_retomada: 'Automação retomada',
  atendimento_concluido: 'Atendimento concluído',
  opt_out: 'Descadastro (opt-out)',
};

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function descricaoExtra(i: Interacao): string | null {
  const d = i.dados || {};
  if (i.tipo === 'estagio_alterado' && d.de && d.para) return `${d.de} → ${d.para}`;
  if (i.tipo === 'automacao_retomada' && typeof d.passos_pulados === 'number' && d.passos_pulados > 0) {
    return `${d.passos_pulados} passo(s) vencido(s) pulado(s)`;
  }
  if (i.tipo === 'automacao_pausada' && typeof d.fila_cancelados === 'number' && d.fila_cancelados > 0) {
    return `${d.fila_cancelados} envio(s) da fila cancelado(s)`;
  }
  return null;
}

function IconeDirecao({ direcao }: { direcao: Interacao['direcao'] }) {
  if (direcao === 'entrada') return <ArrowDownLeft className="size-3.5 text-emerald-400" aria-hidden />;
  if (direcao === 'saida') return <ArrowUpRight className="size-3.5 text-sky-400" aria-hidden />;
  return <Info className="size-3.5 text-slate-400" aria-hidden />;
}

interface Props {
  contato: FunilContato;
  onClose: () => void;
  onChanged: () => void;
}

export function ContatoHistorico({ contato, onClose, onChanged }: Props) {
  const [interacoes, setInteracoes] = useState<Interacao[] | null>(null);
  const [acao, setAcao] = useState<'retomar' | 'concluir' | null>(null);

  const carregar = async () => {
    const res = await getInteracoesContato(contato.id);
    if (res.success) setInteracoes(res.interacoes || []);
    else toast.error(res.error || 'Erro ao carregar histórico');
  };

  useEffect(() => {
    queueMicrotask(carregar);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contato.id]);

  const executar = async (tipo: 'retomar' | 'concluir') => {
    setAcao(tipo);
    const res = tipo === 'retomar' ? await retomarAutomacao(contato.id) : await concluirAtendimento(contato.id);
    setAcao(null);
    if (!res.success) {
      toast.error(res.error || 'Erro');
      return;
    }
    toast.success(tipo === 'retomar' ? 'Automação retomada' : 'Atendimento concluído');
    onChanged();
    carregar();
  };

  const pausado = !!contato.automacao_pausada_em;
  const pendente = !!contato.atendimento_pendente_em;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="historico-titulo">
      <button type="button" aria-label="Fechar histórico" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-[#27272a] bg-[#0b1729]">
        <header className="flex items-start justify-between gap-3 border-b border-[#27272a] p-4">
          <div className="min-w-0">
            <h2 id="historico-titulo" className="truncate text-base font-semibold text-white">
              {contato.nome || 'Sem nome'}
            </h2>
            <p className="text-xs text-slate-400">{contato.telefone}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-slate-400 hover:bg-[#27272a] hover:text-white"
          >
            <X className="size-4" />
          </button>
        </header>

        {(pausado || pendente) && (
          <div className="space-y-3 border-b border-[#27272a] p-4">
            <p className="flex items-center gap-2 text-sm text-amber-300">
              <Pause className="size-4" aria-hidden />
              {pendente ? 'Respondeu e aguarda atendimento. Automação pausada.' : 'Automação pausada.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {pendente && (
                <button
                  type="button"
                  onClick={() => executar('concluir')}
                  disabled={acao !== null}
                  className="flex items-center gap-1.5 rounded-lg bg-[#27272a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2a4a6f] disabled:opacity-50"
                >
                  {acao === 'concluir' ? <MorphingInfinity className="size-3.5" /> : <CheckCheck className="size-3.5" />}
                  Marcar como atendido
                </button>
              )}
              {pausado && (
                <button
                  type="button"
                  onClick={() => executar('retomar')}
                  disabled={acao !== null}
                  className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {acao === 'retomar' ? <MorphingInfinity className="size-3.5" /> : <Play className="size-3.5" />}
                  Retomar automação
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {interacoes === null ? (
            <div className="flex justify-center py-10">
              <MorphingInfinity className="size-6 text-orange-500" />
            </div>
          ) : interacoes.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Nenhuma interação registrada ainda.</p>
          ) : (
            <ol className="space-y-3">
              {interacoes.map((i) => {
                const extra = descricaoExtra(i);
                return (
                  <li key={i.id} className="rounded-xl border border-[#27272a] bg-[#111113] p-3">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-slate-200">
                        <IconeDirecao direcao={i.direcao} />
                        {ROTULO_TIPO[i.tipo] || i.tipo}
                      </span>
                      <time dateTime={i.created_at} className="text-slate-500">
                        {formatarData(i.created_at)}
                      </time>
                    </div>
                    {i.conteudo && (
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-300">{i.conteudo}</p>
                    )}
                    {extra && <p className="mt-1 text-xs text-slate-400">{extra}</p>}
                    {i.autor && <p className="mt-1 text-[11px] text-slate-600">por {i.autor}</p>}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}
