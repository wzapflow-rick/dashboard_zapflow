'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import {
  Sparkles,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Receipt,
  ShoppingBag,
  Clock,
  AlertTriangle,
  Lightbulb,
  Trophy,
  Users,
  Megaphone,
  Ticket,
  MessageCircle,
  UtensilsCrossed,
  ArrowRight,
  Flame,
  Star,
} from 'lucide-react';
import {
  getZapflowInsights,
  type ZapflowInsightsResult,
  type TipoAcao,
} from '@/app/actions/zapflow-insights';
import { ScoreRing } from './score-ring';
import { CompareBars } from './compare-bars';
import { ZapflowChat } from './zapflow-chat';

const fmtMoeda = (v: number) => `R$ ${(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

// Canvas escuro full-bleed: cancela o padding do layout e garante o visual
// "dark premium" independentemente do tema (system/light/dark) do usuario.
const CANVAS = '-m-4 sm:-m-6 lg:-m-8 min-h-screen bg-[#0a1628] text-slate-100';

const ACAO_INFO: Record<TipoAcao, { label: string; icon: typeof Megaphone; toastMsg: string; href?: string }> = {
  campanha: { label: 'Criar Campanha', icon: Megaphone, toastMsg: 'Abrindo suas campanhas...', href: '/dashboard/campanhas' },
  cupom: { label: 'Criar Cupom', icon: Ticket, toastMsg: 'Abrindo a gestao de cupons...', href: '/dashboard/settings?section=coupons' },
  whatsapp: { label: 'Enviar WhatsApp', icon: MessageCircle, toastMsg: 'Abrindo campanhas de WhatsApp...', href: '/dashboard/campanhas' },
  cardapio: { label: 'Ajustar Cardapio', icon: UtensilsCrossed, toastMsg: 'Abrindo seu cardapio...', href: '/dashboard/menu' },
  clientes: { label: 'Recuperar Clientes', icon: Users, toastMsg: 'Abrindo sua base de clientes...', href: '/dashboard/customers' },
  geral: { label: 'Ver Detalhes', icon: ArrowRight, toastMsg: 'Acao registrada.' },
};

// Executa a acao sugerida pela IA levando o lojista direto para a ferramenta
// real correspondente (deep-link). Guarda a dica no sessionStorage para que a
// tela de destino possa exibi-la como contexto, se quiser usar futuramente.
function executarAcao(router: ReturnType<typeof useRouter>, tipo: TipoAcao, descricao: string) {
  const info = ACAO_INFO[tipo] ?? ACAO_INFO.geral;
  if (info.href) {
    try {
      sessionStorage.setItem('zapflow_insight_acao', JSON.stringify({ tipo, descricao, em: Date.now() }));
    } catch {
      /* sessionStorage pode falhar em modo privado; a navegacao continua normalmente */
    }
    toast.success(info.toastMsg, { description: descricao });
    router.push(info.href);
  } else {
    toast.info(descricao || info.toastMsg);
  }
}

function saudacaoHora(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// ---------------------------------------------------------------------------
// Cartao de metrica rapida
// ---------------------------------------------------------------------------
function MetricCard({
  icon: Icon,
  label,
  valor,
  variacao,
  destaque,
}: {
  icon: typeof TrendingUp;
  label: string;
  valor: string;
  variacao?: number;
  destaque?: boolean;
}) {
  const positivo = (variacao ?? 0) >= 0;
  return (
    <div className={`rounded-2xl border p-4 ${destaque ? 'border-primary/30 bg-primary/[0.06]' : 'border-white/10 bg-white/[0.03]'}`}>
      <div className="mb-2 flex items-center gap-2">
        <div className={`flex size-8 items-center justify-center rounded-lg ${destaque ? 'bg-primary/15' : 'bg-white/5'}`}>
          <Icon className={`size-4 ${destaque ? 'text-primary' : 'text-slate-300'}`} />
        </div>
        <span className="text-xs font-medium text-slate-400">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-xl font-bold text-white">{valor}</span>
        {variacao !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-bold ${positivo ? 'text-primary' : 'text-red-400'}`}>
            {positivo ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {positivo ? '+' : ''}
            {variacao}%
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton de carregamento
// ---------------------------------------------------------------------------
function Skeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-48 rounded-3xl bg-white/[0.04]" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-white/[0.04]" />
        ))}
      </div>
      <div className="h-40 rounded-3xl bg-white/[0.04]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export function ZapflowInsightsClient({ initialData }: { initialData?: ZapflowInsightsResult }) {
  const router = useRouter();
  const [data, setData] = useState<ZapflowInsightsResult | null>(initialData ?? null);
  const [carregando, setCarregando] = useState(!initialData);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = async (force = false) => {
    if (force) setAtualizando(true);
    else setCarregando(true);
    try {
      const res = await getZapflowInsights(force);
      setData(res);
      if (force) toast.success('Analise atualizada!');
    } catch {
      toast.error('Nao foi possivel carregar os insights.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  };

  useEffect(() => {
    if (!initialData) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (carregando) {
    return (
      <div className={CANVAS}>
        <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
          <Skeleton />
        </div>
      </div>
    );
  }

  if (!data?.success || !data.ai) {
    return (
      <div className={CANVAS}>
        <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 size-8 text-amber-400" />
          <p className="text-slate-200">Nao foi possivel carregar os insights agora.</p>
          <p className="mt-1 text-sm text-slate-400">{data?.error || 'Tente atualizar em instantes.'}</p>
          <button
            onClick={() => carregar(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-slate-900"
          >
            <RefreshCw className="size-4" />
            Tentar de novo
          </button>
        </div>
        </div>
      </div>
    );
  }

  const { ai, score, metrics } = data;
  const primeiroNome = data.nome?.split(' ')[0] || 'lojista';

  return (
    <div className={CANVAS}>
    <div className="mx-auto max-w-6xl p-4 pb-24 sm:p-6 lg:p-8">
      {/* ============ HERO ============ */}
      <motion.section
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.10] via-white/[0.02] to-transparent p-6 sm:p-8"
      >
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" />
              Consultor ZapFlow
            </div>
            <h1 className="text-2xl font-black text-white sm:text-3xl text-balance">
              {saudacaoHora()}, {primeiroNome}!
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">{ai.resumoDia}</p>
            <p className="mt-3 text-sm font-medium text-primary">{score.resumo}</p>
          </div>

          {/* Score */}
          <div className="flex flex-col items-center">
            <span className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-400">Saude do Negocio</span>
            <ScoreRing valor={score.valor} nivel={score.nivel} />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <Sparkles className="size-3.5 text-primary" />
            {data.doCache ? 'Analise de hoje' : 'Analise recem gerada'}
            {data.aiError ? ' (modo simplificado)' : ''}
          </span>
          <button
            onClick={() => carregar(true)}
            disabled={atualizando}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${atualizando ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </motion.section>

      {/* ============ METRICAS RAPIDAS ============ */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard icon={TrendingUp} label="Faturamento hoje" valor={fmtMoeda(metrics.faturamentoHoje)} variacao={metrics.variacaoFaturamento} destaque />
        <MetricCard icon={ShoppingBag} label="Pedidos hoje" valor={String(metrics.pedidosHoje)} />
        <MetricCard icon={Receipt} label="Ticket medio" valor={fmtMoeda(metrics.ticketHoje)} variacao={metrics.variacaoTicket} />
        <MetricCard icon={Clock} label="Pendentes" valor={String(metrics.pedidosPendentes)} />
      </div>

      {/* ============ DESTAQUE + SUGESTAO PRINCIPAL ============ */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Destaque positivo */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-primary/20 bg-primary/[0.06] p-6"
        >
          <div className="mb-2 flex items-center gap-2">
            <Trophy className="size-5 text-primary" />
            <h3 className="font-bold text-white">Pra comemorar</h3>
          </div>
          <p className="text-sm leading-relaxed text-slate-200">{ai.destaquePositivo}</p>
        </motion.div>

        {/* Sugestao principal */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6"
        >
          <div className="mb-2 flex items-center gap-2">
            <Flame className="size-5 text-amber-400" />
            <h3 className="font-bold text-white">Sua jogada de hoje</h3>
          </div>
          <p className="font-semibold text-slate-100">{ai.sugestaoPrincipal.titulo}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">{ai.sugestaoPrincipal.descricao}</p>
          <button
            onClick={() => executarAcao(router, ai.sugestaoPrincipal.tipoAcao, ai.sugestaoPrincipal.acaoSugerida)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-slate-900 transition-transform hover:scale-[1.02]"
          >
            {(() => {
              const Icon = ACAO_INFO[ai.sugestaoPrincipal.tipoAcao]?.icon ?? ArrowRight;
              return <Icon className="size-4" />;
            })()}
            {ai.sugestaoPrincipal.acaoSugerida}
          </button>
        </motion.div>
      </div>

      {/* ============ ALERTAS ============ */}
      {ai.alertas.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">Precisa de atencao</h2>
          </div>
          <div className="space-y-3">
            {ai.alertas.map((a, i) => {
              const cor =
                a.gravidade === 'alta'
                  ? 'border-red-500/30 bg-red-500/[0.06]'
                  : a.gravidade === 'media'
                    ? 'border-amber-500/30 bg-amber-500/[0.06]'
                    : 'border-white/10 bg-white/[0.03]';
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`rounded-2xl border p-4 ${cor}`}
                >
                  <p className="font-semibold text-white">{a.titulo}</p>
                  <p className="mt-0.5 text-sm text-slate-300">{a.descricao}</p>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* ============ OPORTUNIDADES ============ */}
      {ai.oportunidades.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="size-5 text-primary" />
            <h2 className="text-lg font-bold text-white">Oportunidades pra vender mais</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {ai.oportunidades.map((o, i) => {
              const info = ACAO_INFO[o.tipoAcao] ?? ACAO_INFO.geral;
              const Icon = info.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15">
                      <Icon className="size-4 text-primary" />
                    </div>
                    <h3 className="font-semibold text-white">{o.titulo}</h3>
                  </div>
                  <p className="flex-1 text-sm leading-relaxed text-slate-300">{o.descricao}</p>
                  <button
                    onClick={() => executarAcao(router, o.tipoAcao, o.acaoSugerida)}
                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
                  >
                    <Icon className="size-4" />
                    {info.label}
                  </button>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* ============ PRODUTOS + CLIENTES ============ */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Top produtos */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="mb-4 flex items-center gap-2">
            <Star className="size-5 text-amber-400" />
            <h3 className="font-bold text-white">Campeoes da semana</h3>
          </div>
          {metrics.topProdutos.length === 0 ? (
            <p className="text-sm text-slate-400">Ainda sem vendas suficientes nesta semana.</p>
          ) : (
            <ul className="space-y-3">
              {metrics.topProdutos.map((p, i) => (
                <li key={p.nome} className="flex items-center gap-3">
                  <span
                    className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                      i === 0 ? 'bg-amber-400/20 text-amber-400' : 'bg-white/5 text-slate-400'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-sm text-slate-200">{p.nome}</span>
                  <span className="text-sm font-semibold text-slate-400">{p.qtd} un</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Clientes */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="mb-4 flex items-center gap-2">
            <Users className="size-5 text-primary" />
            <h3 className="font-bold text-white">Seus clientes</h3>
          </div>
          <p className="text-sm leading-relaxed text-slate-300">{ai.analiseClientes}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/[0.03] p-4 text-center">
              <p className="text-2xl font-black text-white">{metrics.clientesUnicosSemana}</p>
              <p className="text-xs text-slate-400">Clientes na semana</p>
            </div>
            <div className="rounded-2xl bg-primary/[0.06] p-4 text-center">
              <p className="text-2xl font-black text-primary">{metrics.clientesRecorrentes}</p>
              <p className="text-xs text-slate-400">Voltaram a comprar</p>
            </div>
          </div>
        </div>
      </div>

      {/* ============ COMPARATIVOS ============ */}
      <section className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="size-5 text-primary" />
          <h2 className="text-lg font-bold text-white">Comparativos</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <CompareBars
            titulo="Faturamento (semana)"
            atualLabel="Esta semana"
            anteriorLabel="Semana anterior"
            atual={metrics.faturamentoSemana}
            anterior={metrics.faturamentoSemanaAnterior}
            variacao={metrics.variacaoSemana}
            formato="moeda"
          />
          <CompareBars
            titulo="Ticket medio"
            atualLabel="Hoje"
            anteriorLabel="Ontem"
            atual={metrics.ticketHoje}
            anterior={metrics.ticketOntem}
            variacao={metrics.variacaoTicket}
            formato="moeda"
          />
          <CompareBars
            titulo="Pedidos"
            atualLabel="Hoje"
            anteriorLabel="Ontem"
            atual={metrics.pedidosHoje}
            anterior={metrics.pedidosOntem}
            variacao={metrics.pedidosOntem > 0 ? Math.round(((metrics.pedidosHoje - metrics.pedidosOntem) / metrics.pedidosOntem) * 100) : 0}
            formato="numero"
          />
        </div>
      </section>

      {/* ============ SAUDE DO NEGOCIO (fatores) ============ */}
      {score.fatores.length > 0 && (
        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-4 text-lg font-bold text-white">O que compoe seu score</h2>
          <div className="space-y-2">
            {score.fatores.map((f, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-white/[0.02] px-4 py-2.5">
                <span className="text-sm text-slate-300">{f.label}</span>
                <span className={`text-sm font-bold ${f.impacto >= 0 ? 'text-primary' : 'text-red-400'}`}>
                  {f.impacto >= 0 ? '+' : ''}
                  {f.impacto}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============ FRASE MOTIVACIONAL ============ */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 text-center text-sm italic text-slate-400"
      >
        &ldquo;{ai.fraseMotivacional}&rdquo;
      </motion.p>

      {/* Chat flutuante */}
      <ZapflowChat />
    </div>
    </div>
  );
}
