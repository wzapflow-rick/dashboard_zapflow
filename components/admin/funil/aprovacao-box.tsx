'use client';

import { useEffect, useState } from 'react';
import {
  Loader2,
  RefreshCw,
  Send,
  Trash2,
  Phone,
  MessageSquare,
  Inbox,
} from 'lucide-react';
import { toast } from 'sonner';
import { getFilaAprovacao, aprovarEnvio, rejeitarEnvio } from '@/app/actions/funil';
import { type FilaAprovacaoItem } from '@/lib/funil-config';

const ESTAGIO_LABEL: Record<string, string> = {
  lead_quente: 'Lead Quente',
  lead_morno: 'Lead Morno',
  lead_frio: 'Lead Frio',
  trial: 'Trial',
  cliente: 'Cliente',
  perdido: 'Perdido',
};

export function AprovacaoBox() {
  const [itens, setItens] = useState<FilaAprovacaoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acaoId, setAcaoId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await getFilaAprovacao();
    if (res.success && res.itens) {
      setItens(res.itens);
    } else {
      toast.error(res.error || 'Erro ao carregar aprovacoes');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const aprovar = async (item: FilaAprovacaoItem) => {
    setAcaoId(item.id);
    const res = await aprovarEnvio(item.id);
    if (res.success) {
      toast.success('Envio aprovado, sera disparado no proximo ciclo');
      setItens((prev) => prev.filter((i) => i.id !== item.id));
    } else {
      toast.error(res.error || 'Erro ao aprovar');
    }
    setAcaoId(null);
  };

  const rejeitar = async (item: FilaAprovacaoItem) => {
    setAcaoId(item.id);
    const res = await rejeitarEnvio(item.id);
    if (res.success) {
      toast.success('Envio descartado');
      setItens((prev) => prev.filter((i) => i.id !== item.id));
    } else {
      toast.error(res.error || 'Erro ao descartar');
    }
    setAcaoId(null);
  };

  if (loading && itens.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {itens.length} mensagem{itens.length === 1 ? '' : 's'} aguardando sua aprovacao.
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2a4a6f] text-white px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          <span className="hidden sm:inline">Atualizar</span>
        </button>
      </div>

      {itens.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 rounded-2xl bg-[#0f1f35] border border-[#1e3a5f] mb-4">
            <Inbox className="size-8 text-slate-500" />
          </div>
          <p className="text-white font-medium">Nenhuma mensagem pendente</p>
          <p className="text-sm text-slate-500 mt-1">
            Quando um lead atingir o momento da cadencia, ela aparece aqui para aprovacao.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {itens.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-[#1e3a5f] bg-[#0f1f35] p-4 flex flex-col"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {item.contato_nome || 'Sem nome'}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                    <Phone className="size-3" />
                    {item.contato_telefone}
                  </p>
                </div>
                {item.contato_estagio && (
                  <span className="shrink-0 text-xs rounded-full px-2 py-0.5 bg-[#1e3a5f] text-slate-300">
                    {ESTAGIO_LABEL[item.contato_estagio] || item.contato_estagio}
                  </span>
                )}
              </div>

              <div className="mt-3 rounded-xl bg-[#0b1729] border border-[#1e3a5f] p-3 flex-1">
                <p className="flex items-center gap-1 text-xs text-slate-500 mb-1.5">
                  <MessageSquare className="size-3" />
                  Previa da mensagem
                </p>
                <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {item.conteudo_final}
                </p>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => aprovar(item)}
                  disabled={acaoId === item.id}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                >
                  {acaoId === item.id ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Enviar agora
                </button>
                <button
                  onClick={() => rejeitar(item)}
                  disabled={acaoId === item.id}
                  className="flex items-center justify-center gap-2 bg-[#1e3a5f] hover:bg-red-600/80 text-slate-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                  <span className="hidden sm:inline">Descartar</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
