import Link from 'next/link';
import {
  UserPlus,
  Send,
  MessageCircleReply,
  Trophy,
  Headset,
  Inbox,
  Hourglass,
  Wallet,
  ShieldCheck,
} from 'lucide-react';
import type { ComercialStats } from '@/app/actions/comercial';
import { FUNIL_ESTAGIOS, type FunilEstagio } from '@/lib/funil-config';

const ESTAGIO_LABEL: Record<FunilEstagio, string> = {
  lead_quente: 'Lead Quente',
  lead_morno: 'Lead Morno',
  lead_frio: 'Lead Frio',
  trial: 'Trial',
  cliente: 'Cliente',
  perdido: 'Perdido',
};

const ESTAGIO_COR: Record<FunilEstagio, string> = {
  lead_quente: 'bg-orange-500',
  lead_morno: 'bg-amber-400',
  lead_frio: 'bg-sky-500',
  trial: 'bg-indigo-500',
  cliente: 'bg-emerald-500',
  perdido: 'bg-slate-500',
};

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dataCurta = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

function percentual(parte: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((parte / total) * 100)}%`;
}

export function ComercialOverview({ stats }: { stats: ComercialStats }) {
  const maiorEstagio = Math.max(1, ...FUNIL_ESTAGIOS.map((e) => stats.leadsPorEstagio[e]));

  return (
    <section aria-labelledby="comercial-titulo" className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="comercial-titulo" className="text-lg font-semibold text-white">
            Visão comercial
          </h2>
          <p className="text-sm text-slate-400">Últimos 7 dias, exceto onde indicado</p>
        </div>
        <Link
          href="/admin/remarketing"
          className="text-sm font-medium text-orange-400 hover:text-orange-300 transition-colors"
        >
          Abrir funil
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metrica icon={UserPlus} label="Novos leads" valor={stats.novosLeads7d} />
        <Metrica
          icon={Send}
          label="Contatados"
          valor={stats.contatados7d}
          detalhe={`${stats.mensagensEnviadas7d} mensagens enviadas`}
        />
        <Metrica
          icon={MessageCircleReply}
          label="Responderam"
          valor={stats.responderam7d}
          detalhe={`Taxa de resposta ${percentual(stats.responderam7d, stats.contatados7d)}`}
        />
        <Metrica
          icon={Trophy}
          label="Viraram cliente"
          valor={stats.conversoes30d}
          detalhe="Últimos 30 dias"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#111113] border border-[#27272a] rounded-xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Leads por estágio</h3>
            <span className="text-sm text-slate-400">{stats.totalLeads} ativos</span>
          </div>
          <ul className="flex flex-col gap-3">
            {FUNIL_ESTAGIOS.map((estagio) => {
              const total = stats.leadsPorEstagio[estagio];
              return (
                <li key={estagio} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-sm text-slate-300">{ESTAGIO_LABEL[estagio]}</span>
                  <div className="h-2 flex-1 rounded-full bg-[#18181b] overflow-hidden" aria-hidden="true">
                    <div
                      className={`h-full rounded-full ${ESTAGIO_COR[estagio]}`}
                      style={{ width: `${(total / maiorEstagio) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-sm font-medium text-white tabular-nums">{total}</span>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-[#27272a] pt-4 text-sm text-slate-400">
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-400" aria-hidden="true" />
              {stats.consentimento.concedido} com consentimento
            </span>
            <span>{stats.consentimento.pendente} aguardando 1ª resposta</span>
            <span>{stats.consentimento.optOut} opt-out</span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="font-semibold text-white">Precisa de você</h3>
          <Pendencia
            href="/admin/remarketing/contatos"
            icon={Headset}
            label="Conversas para atender"
            valor={stats.atendimentoPendente}
          />
          <Pendencia
            href="/admin/remarketing"
            icon={Inbox}
            label="Mensagens aguardando aprovação"
            valor={stats.aguardandoAprovacao}
          />
          <div className="bg-[#111113] border border-[#27272a] rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Hourglass className="size-5 text-indigo-400" aria-hidden="true" />
              <p className="flex-1 text-sm text-slate-300">Trials vencendo em 3 dias</p>
              <span className="text-lg font-bold text-white tabular-nums">{stats.trialsVencendo.length}</span>
            </div>
            {stats.trialsVencendo.length > 0 ? (
              <ul className="flex flex-col gap-1 text-sm">
                {stats.trialsVencendo.map((t) => (
                  <li key={t.empresa_id} className="flex justify-between gap-2 text-slate-400">
                    <span className="truncate text-slate-200">{t.nome}</span>
                    <span className="shrink-0 tabular-nums">{dataCurta.format(new Date(t.trial_end_date))}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">{stats.trialsAtivos} trials ativos, nenhum vencendo.</p>
            )}
          </div>
          <div className="bg-[#111113] border border-[#27272a] rounded-xl p-4 flex items-center gap-3">
            <Wallet className="size-5 text-emerald-400" aria-hidden="true" />
            <p className="flex-1 text-sm text-slate-300">MRR (assinaturas ativas)</p>
            <span className="text-lg font-bold text-white tabular-nums">{brl.format(stats.mrr)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metrica({
  icon: Icon,
  label,
  valor,
  detalhe,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  valor: number;
  detalhe?: string;
}) {
  return (
    <div className="bg-[#111113] border border-[#27272a] rounded-xl p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="size-4" aria-hidden="true" />
        <p className="text-sm">{label}</p>
      </div>
      <p className="text-3xl font-bold text-white tabular-nums">{valor}</p>
      {detalhe ? <p className="text-xs text-slate-500">{detalhe}</p> : null}
    </div>
  );
}

function Pendencia({
  href,
  icon: Icon,
  label,
  valor,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  valor: number;
}) {
  const ativo = valor > 0;
  return (
    <Link
      href={href}
      className={`rounded-xl border p-4 flex items-center gap-3 transition-colors ${
        ativo
          ? 'border-orange-500/40 bg-orange-500/5 hover:border-orange-500/70'
          : 'border-[#27272a] bg-[#111113] hover:border-[#3f3f46]'
      }`}
    >
      <Icon className={`size-5 ${ativo ? 'text-orange-400' : 'text-slate-500'}`} aria-hidden="true" />
      <p className="flex-1 text-sm text-slate-300">{label}</p>
      <span className={`text-lg font-bold tabular-nums ${ativo ? 'text-orange-400' : 'text-white'}`}>{valor}</span>
    </Link>
  );
}
