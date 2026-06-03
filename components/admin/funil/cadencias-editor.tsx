'use client';

import { useEffect, useState } from 'react';
import {
  Loader2,
  Plus,
  Trash2,
  Save,
  Zap,
  Hand,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getCadencias,
  upsertCadencia,
  deleteCadencia,
  getMensagensFunil,
} from '@/app/actions/funil';
import { type Cadencia, type FunilEstagio } from '@/lib/funil-config';

const ESTAGIO_LABEL: Record<FunilEstagio, string> = {
  lead_quente: 'Lead Quente',
  lead_morno: 'Lead Morno',
  lead_frio: 'Lead Frio',
  trial: 'Trial',
  cliente: 'Cliente',
  perdido: 'Perdido',
};

// estagios que de fato disparam cadencias
const ESTAGIOS_CADENCIA: FunilEstagio[] = [
  'lead_quente',
  'lead_morno',
  'lead_frio',
  'trial',
  'cliente',
];

interface Mensagem {
  id: number;
  nome: string;
  conteudo: string;
}

function formatarOffset(horas: number): string {
  if (horas < 24) return `${horas}h apos entrar`;
  return `${Math.round(horas / 24)}d apos entrar`;
}

export function CadenciasEditor() {
  const [cadencias, setCadencias] = useState<Cadencia[]>([]);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | string | null>(null);

  const load = async () => {
    setLoading(true);
    const [cRes, mRes] = await Promise.all([getCadencias(), getMensagensFunil()]);
    if (cRes.success && cRes.cadencias) setCadencias(cRes.cadencias);
    else toast.error(cRes.error || 'Erro ao carregar cadencias');
    if (mRes.success && mRes.mensagens) setMensagens(mRes.mensagens);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const salvar = async (cad: Cadencia) => {
    setSavingId(cad.id);
    const res = await upsertCadencia({
      id: cad.id,
      estagio: cad.estagio,
      passo_ordem: cad.passo_ordem,
      rotulo: cad.rotulo,
      offset_horas: cad.offset_horas,
      recorrente: cad.recorrente,
      intervalo_horas: cad.intervalo_horas,
      mensagem_id: cad.mensagem_id,
      modo: cad.modo,
      ativo: cad.ativo,
    });
    if (res.success) {
      toast.success('Cadencia salva');
      load();
    } else {
      toast.error(res.error || 'Erro ao salvar');
    }
    setSavingId(null);
  };

  const remover = async (id: number) => {
    setSavingId(id);
    const res = await deleteCadencia(id);
    if (res.success) {
      toast.success('Cadencia removida');
      setCadencias((prev) => prev.filter((c) => c.id !== id));
    } else {
      toast.error(res.error || 'Erro ao remover');
    }
    setSavingId(null);
  };

  const adicionarPasso = async (estagio: FunilEstagio) => {
    const doEstagio = cadencias.filter((c) => c.estagio === estagio);
    const proximaOrdem = doEstagio.length
      ? Math.max(...doEstagio.map((c) => c.passo_ordem)) + 1
      : 1;
    const modo = estagio === 'trial' || estagio === 'cliente' ? 'auto' : 'aprovacao';
    setSavingId(`novo-${estagio}`);
    const res = await upsertCadencia({
      estagio,
      passo_ordem: proximaOrdem,
      rotulo: `Passo ${proximaOrdem}`,
      offset_horas: 24,
      modo,
      ativo: true,
    });
    if (res.success) {
      toast.success('Passo adicionado');
      load();
    } else {
      toast.error(res.error || 'Erro ao adicionar passo');
    }
    setSavingId(null);
  };

  const atualizarLocal = (id: number, patch: Partial<Cadencia>) => {
    setCadencias((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">
        Defina os passos de follow-up de cada estagio. Trial e Cliente enviam automaticamente; os leads
        passam pela caixa de aprovacao.
      </p>

      {ESTAGIOS_CADENCIA.map((estagio) => {
        const passos = cadencias
          .filter((c) => c.estagio === estagio)
          .sort((a, b) => a.passo_ordem - b.passo_ordem);
        return (
          <section key={estagio} className="rounded-2xl border border-[#1e3a5f] bg-[#0b1729]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e3a5f]">
              <h3 className="font-semibold text-white">{ESTAGIO_LABEL[estagio]}</h3>
              <button
                onClick={() => adicionarPasso(estagio)}
                disabled={savingId === `novo-${estagio}`}
                className="flex items-center gap-1.5 text-sm bg-[#1e3a5f] hover:bg-[#2a4a6f] text-white px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
              >
                {savingId === `novo-${estagio}` ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Passo
              </button>
            </div>

            <div className="p-4 space-y-3">
              {passos.length === 0 ? (
                <p className="text-xs text-slate-600 py-2">Nenhum passo configurado.</p>
              ) : (
                passos.map((cad) => (
                  <div
                    key={cad.id}
                    className="rounded-xl border border-[#1e3a5f] bg-[#0f1f35] p-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
                  >
                    {/* Rotulo */}
                    <div className="md:col-span-3">
                      <label className="block text-xs text-slate-500 mb-1">Rotulo</label>
                      <input
                        value={cad.rotulo || ''}
                        onChange={(e) => atualizarLocal(cad.id, { rotulo: e.target.value })}
                        className="w-full bg-[#0b1729] border border-[#1e3a5f] rounded-lg text-sm text-white px-2.5 py-1.5 focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    {/* Quando (offset_horas) */}
                    <div className="md:col-span-2">
                      <label className="block text-xs text-slate-500 mb-1">Apos (horas)</label>
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-slate-500" />
                        <input
                          type="number"
                          min={0}
                          value={cad.offset_horas}
                          onChange={(e) =>
                            atualizarLocal(cad.id, { offset_horas: Number(e.target.value) })
                          }
                          className="w-full bg-[#0b1729] border border-[#1e3a5f] rounded-lg text-sm text-white px-2.5 py-1.5 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                      <p className="text-[10px] text-slate-600 mt-1">{formatarOffset(cad.offset_horas)}</p>
                    </div>

                    {/* Mensagem */}
                    <div className="md:col-span-3">
                      <label className="block text-xs text-slate-500 mb-1">Mensagem</label>
                      <select
                        value={cad.mensagem_id ?? ''}
                        onChange={(e) =>
                          atualizarLocal(cad.id, {
                            mensagem_id: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="w-full bg-[#0b1729] border border-[#1e3a5f] rounded-lg text-sm text-white px-2.5 py-1.5 focus:outline-none focus:border-orange-500"
                      >
                        <option value="">Selecione...</option>
                        {mensagens.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Modo */}
                    <div className="md:col-span-2">
                      <label className="block text-xs text-slate-500 mb-1">Modo</label>
                      <button
                        type="button"
                        onClick={() =>
                          atualizarLocal(cad.id, {
                            modo: cad.modo === 'auto' ? 'aprovacao' : 'auto',
                          })
                        }
                        className={`w-full flex items-center justify-center gap-1.5 rounded-lg text-xs px-2.5 py-1.5 font-medium transition-all ${
                          cad.modo === 'auto'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {cad.modo === 'auto' ? <Zap className="size-3.5" /> : <Hand className="size-3.5" />}
                        {cad.modo === 'auto' ? 'Automatico' : 'Aprovacao'}
                      </button>
                    </div>

                    {/* Acoes */}
                    <div className="md:col-span-2 flex items-center gap-2">
                      <button
                        onClick={() => salvar(cad)}
                        disabled={savingId === cad.id}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-orange-600 hover:bg-orange-500 text-white text-sm px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50"
                      >
                        {savingId === cad.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Save className="size-4" />
                        )}
                        Salvar
                      </button>
                      <button
                        onClick={() => remover(cad.id)}
                        disabled={savingId === cad.id}
                        aria-label="Remover passo"
                        className="flex items-center justify-center bg-[#1e3a5f] hover:bg-red-600/80 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
