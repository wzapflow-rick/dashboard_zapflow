'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  RefreshCw,
  Phone,
  Clock,
  ArrowRight,
  GripVertical,
  Flame,
  Thermometer,
  Snowflake,
  Rocket,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { getFunilContatos, moverContatoEstagio } from '@/app/actions/funil';
import { FUNIL_ESTAGIOS, type FunilContato, type FunilEstagio } from '@/lib/funil-config';

interface EstagioMeta {
  label: string;
  icon: typeof Flame;
  dot: string;
  ring: string;
  chip: string;
}

const ESTAGIO_META: Record<FunilEstagio, EstagioMeta> = {
  lead_quente: { label: 'Lead Quente', icon: Flame, dot: 'bg-orange-500', ring: 'border-orange-500/30', chip: 'bg-orange-500/15 text-orange-300' },
  lead_morno: { label: 'Lead Morno', icon: Thermometer, dot: 'bg-amber-500', ring: 'border-amber-500/30', chip: 'bg-amber-500/15 text-amber-300' },
  lead_frio: { label: 'Lead Frio', icon: Snowflake, dot: 'bg-sky-500', ring: 'border-sky-500/30', chip: 'bg-sky-500/15 text-sky-300' },
  trial: { label: 'Trial', icon: Rocket, dot: 'bg-indigo-500', ring: 'border-indigo-500/30', chip: 'bg-indigo-500/15 text-indigo-300' },
  cliente: { label: 'Cliente', icon: CheckCircle2, dot: 'bg-emerald-500', ring: 'border-emerald-500/30', chip: 'bg-emerald-500/15 text-emerald-300' },
  perdido: { label: 'Perdido', icon: XCircle, dot: 'bg-slate-500', ring: 'border-slate-500/30', chip: 'bg-slate-500/15 text-slate-300' },
};

function formatarTempo(horas?: number): string {
  if (horas == null) return '-';
  if (horas < 1) return 'agora';
  if (horas < 24) return `${horas}h`;
  const dias = Math.floor(horas / 24);
  return `${dias}d`;
}

function formatarProxima(iso?: string | null): string {
  if (!iso) return 'sem proxima acao';
  const alvo = new Date(iso).getTime();
  const diff = alvo - Date.now();
  if (diff <= 0) return 'pendente agora';
  const horas = Math.round(diff / (1000 * 60 * 60));
  if (horas < 24) return `em ${horas}h`;
  return `em ${Math.round(horas / 24)}d`;
}

export function FunilBoard() {
  const [estagios, setEstagios] = useState<Record<FunilEstagio, FunilContato[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<FunilEstagio | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await getFunilContatos();
    if (res.success && res.estagios) {
      setEstagios(res.estagios);
    } else {
      toast.error(res.error || 'Erro ao carregar funil');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const totalContatos = useMemo(() => {
    if (!estagios) return 0;
    return Object.values(estagios).reduce((acc, arr) => acc + arr.length, 0);
  }, [estagios]);

  const mover = async (contato: FunilContato, destino: FunilEstagio) => {
    if (contato.estagio === destino || !estagios) return;

    const origem = contato.estagio;
    // Atualizacao otimista
    setEstagios((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      next[origem] = next[origem].filter((c) => c.id !== contato.id);
      next[destino] = [{ ...contato, estagio: destino, horas_no_estagio: 0 }, ...next[destino]];
      return next;
    });

    const res = await moverContatoEstagio(contato.id, destino, 0);
    if (!res.success) {
      toast.error(res.error || 'Erro ao mover contato');
      load(); // reverte recarregando
    } else {
      toast.success(`${contato.nome || contato.telefone} -> ${ESTAGIO_META[destino].label}`);
      load(); // recalcula proxima acao
    }
  };

  if (loading && !estagios) {
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
          {totalContatos} contato{totalContatos === 1 ? '' : 's'} no funil. Arraste os cards para mudar o estagio.
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

      <div className="flex gap-4 overflow-x-auto pb-4">
        {FUNIL_ESTAGIOS.map((estagio) => {
          const meta = ESTAGIO_META[estagio];
          const cards = estagios?.[estagio] || [];
          const isOver = dragOver === estagio;
          return (
            <div
              key={estagio}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(estagio);
              }}
              onDragLeave={() => setDragOver((cur) => (cur === estagio ? null : cur))}
              onDrop={() => {
                setDragOver(null);
                if (dragId == null || !estagios) return;
                const contato = Object.values(estagios)
                  .flat()
                  .find((c) => c.id === dragId);
                if (contato) mover(contato, estagio);
                setDragId(null);
              }}
              className={`flex-shrink-0 w-72 rounded-2xl border bg-[#0b1729] transition-colors ${
                isOver ? `${meta.ring} bg-[#0f1f35]` : 'border-[#1e3a5f]'
              }`}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e3a5f]">
                <div className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${meta.dot}`} />
                  <meta.icon className="size-4 text-slate-300" />
                  <span className="font-semibold text-white text-sm">{meta.label}</span>
                </div>
                <span className="text-xs text-slate-400 bg-[#1e3a5f] rounded-full px-2 py-0.5">
                  {cards.length}
                </span>
              </div>

              <div className="p-3 space-y-2 min-h-32 max-h-[60vh] overflow-y-auto">
                {cards.length === 0 ? (
                  <p className="text-xs text-slate-600 text-center py-6">Vazio</p>
                ) : (
                  cards.map((contato) => (
                    <article
                      key={contato.id}
                      draggable
                      onDragStart={() => setDragId(contato.id)}
                      onDragEnd={() => setDragId(null)}
                      className={`group rounded-xl border border-[#1e3a5f] bg-[#0f1f35] p-3 cursor-grab active:cursor-grabbing hover:border-[#2a4a6f] transition-all ${
                        dragId === contato.id ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="size-4 text-slate-600 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white truncate">
                            {contato.nome || 'Sem nome'}
                          </p>
                          <p className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                            <Phone className="size-3" />
                            {contato.telefone}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 text-slate-500">
                          <Clock className="size-3" />
                          {formatarTempo(contato.horas_no_estagio)} no estagio
                        </span>
                        <span className={`rounded-full px-2 py-0.5 ${meta.chip}`}>
                          {formatarProxima(contato.proxima_acao_em)}
                        </span>
                      </div>

                      {/* Fallback de mover (mobile / acessibilidade) */}
                      <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <ArrowRight className="size-3 text-slate-600" />
                        <select
                          aria-label={`Mover ${contato.nome || contato.telefone} para outro estagio`}
                          value={contato.estagio}
                          onChange={(e) => mover(contato, e.target.value as FunilEstagio)}
                          className="flex-1 bg-[#0b1729] border border-[#1e3a5f] rounded-md text-xs text-slate-300 px-2 py-1 focus:outline-none focus:border-orange-500"
                        >
                          {FUNIL_ESTAGIOS.map((e) => (
                            <option key={e} value={e}>
                              {ESTAGIO_META[e].label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
