'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Clock,
  Flame,
  Lightbulb,
  Megaphone,
  MessageCircle,
  Receipt,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Star,
  Ticket,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import {
  getZapflowInsights,
  type ZapflowInsightsResult,
  type TipoAcao,
} from '@/app/actions/zapflow-insights';
import { cn } from '@/lib/utils';
import { ScoreRing } from './score-ring';
import { ComparativosSection } from './comparativos-section';
import { ZapflowChat } from './zapflow-chat';

const fmtMoeda = (value: number) => `R$ ${(value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const ACAO_INFO: Record<TipoAcao, { label: string; icon: typeof Megaphone; toastMsg: string; href?: string }> = {
  campanha: { label: 'Criar campanha', icon: Megaphone, toastMsg: 'Abrindo suas campanhas...', href: '/dashboard/marketing?tab=campanhas' },
  cupom: { label: 'Criar cupom', icon: Ticket, toastMsg: 'Abrindo a gestão de cupons...', href: '/dashboard/settings?section=coupons' },
  whatsapp: { label: 'Enviar WhatsApp', icon: MessageCircle, toastMsg: 'Abrindo campanhas de WhatsApp...', href: '/dashboard/marketing?tab=campanhas' },
  cardapio: { label: 'Ajustar cardápio', icon: UtensilsCrossed, toastMsg: 'Abrindo seu cardápio...', href: '/dashboard/menu' },
  clientes: { label: 'Recuperar clientes', icon: Users, toastMsg: 'Abrindo sua base de clientes...', href: '/dashboard/customers' },
  geral: { label: 'Ver detalhes', icon: ArrowRight, toastMsg: 'Ação registrada.' },
};

function executarAcao(router: ReturnType<typeof useRouter>, tipo: TipoAcao, descricao: string) {
  const info = ACAO_INFO[tipo] ?? ACAO_INFO.geral;
  if (info.href) {
    try {
      sessionStorage.setItem('zapflow_insight_acao', JSON.stringify({ tipo, descricao, em: Date.now() }));
    } catch {
      // A navegação continua normalmente quando o armazenamento da sessão não está disponível.
    }
    toast.success(info.toastMsg, { description: descricao });
    router.push(info.href);
  } else {
    toast.info(descricao || info.toastMsg);
  }
}

function saudacaoHora(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function InsightsHeading({
  id,
  eyebrow,
  title,
  description,
  icon: Icon,
  scope,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof Sparkles;
  scope: string;
}) {
  return (
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">{eyebrow}</p>
          <h2 id={id} className="mt-1 text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      <span className="w-fit rounded-full border border-slate-200/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/50 dark:text-slate-300">
        {scope}
      </span>
    </header>
  );
}

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
    <div
      className={cn(
        'rounded-2xl border p-4 shadow-sm backdrop-blur-xl',
        destaque
          ? 'border-primary/30 bg-primary/[0.07] shadow-primary/5'
          : 'border-slate-200/70 bg-white/75 shadow-slate-200/30 dark:border-slate-700/50 dark:bg-slate-900/50 dark:shadow-black/20',
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <div
          className={cn(
            'flex size-8 items-center justify-center rounded-lg',
            destaque ? 'bg-primary/15 text-primary' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300',
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-xl font-bold text-slate-900 dark:text-white">{valor}</span>
        {variacao !== undefined && (
          <span className={cn('flex items-center gap-0.5 text-xs font-bold', positivo ? 'text-primary' : 'text-red-500 dark:text-red-400')}>
            {positivo ? <TrendingUp className="size-3" aria-hidden="true" /> : <TrendingDown className="size-3" aria-hidden="true" />}
            {positivo ? '+' : ''}
            {variacao}%
          </span>
        )}
      </div>
    </div>
  );
}

function InsightsSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true" aria-label="Carregando inteligência ZapFlow">
      <div className="h-52 rounded-3xl bg-slate-200/50 dark:bg-slate-800/50" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-24 rounded-2xl bg-slate-200/50 dark:bg-slate-800/50" />
        ))}
      </div>
      <div className="h-40 rounded-3xl bg-slate-200/50 dark:bg-slate-800/50" />
    </div>
  );
}

interface ZapflowInsightsClientProps {
  initialData?: ZapflowInsightsResult;
  operationContent?: ReactNode;
}

export function ZapflowInsightsClient({ initialData, operationContent }: ZapflowInsightsClientProps) {
  const router = useRouter();
  const { mutate: mutateComparativosCache } = useSWRConfig();
  const [data, setData] = useState<ZapflowInsightsResult | null>(initialData ?? null);
  const [carregando, setCarregando] = useState(!initialData);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = async (force = false) => {
    if (force) setAtualizando(true);
    else setCarregando(true);

    try {
      const result = await getZapflowInsights(force);
      setData(result);
      if (force && result.success) {
        await mutateComparativosCache(
          (key) => Array.isArray(key) && key[0] === 'zapflow-comparativos',
          undefined,
          { revalidate: false },
        );
        toast.success('Análise atualizada!');
      }
    } catch {
      toast.error('Não foi possível carregar os insights.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  };

  useEffect(() => {
    if (!initialData) queueMicrotask(() => carregar());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (carregando) {
    return (
      <>
        <section id="inteligencia" className="scroll-mt-32 flex flex-col gap-6" aria-labelledby="inteligencia-title">
          <InsightsHeading
            id="inteligencia-title"
            eyebrow="Inteligência IA"
            title="Consultor ZapFlow"
            description="Uma leitura diária do que merece atenção e das melhores próximas ações para sua loja."
            icon={Sparkles}
            scope="Hoje + últimos 7 dias"
          />
          <InsightsSkeleton />
        </section>
        {operationContent}
        <section id="desempenho" className="scroll-mt-32 flex flex-col gap-6" aria-labelledby="desempenho-title">
          <InsightsHeading
            id="desempenho-title"
            eyebrow="Desempenho"
            title="Tendências do negócio"
            description="Produtos, clientes, comparativos e fatores que formam a saúde da operação."
            icon={BarChart3}
            scope="Hoje + semana"
          />
          <div className="h-52 animate-pulse rounded-3xl bg-slate-200/50 dark:bg-slate-800/50" />
        </section>
      </>
    );
  }

  if (!data?.success || !data.ai) {
    return (
      <>
        <section id="inteligencia" className="scroll-mt-32 flex flex-col gap-6" aria-labelledby="inteligencia-title">
          <InsightsHeading
            id="inteligencia-title"
            eyebrow="Inteligência IA"
            title="Consultor ZapFlow"
            description="Uma leitura diária do que merece atenção e das melhores próximas ações para sua loja."
            icon={Sparkles}
            scope="Hoje + últimos 7 dias"
          />
          <div className="rounded-3xl border border-slate-200/70 bg-white/75 p-8 text-center shadow-sm dark:border-slate-700/50 dark:bg-slate-900/50">
            <AlertTriangle className="mx-auto mb-3 size-8 text-amber-500 dark:text-amber-400" aria-hidden="true" />
            <p className="text-slate-800 dark:text-slate-200">Não foi possível carregar os insights agora.</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{data?.error || 'Tente atualizar em instantes.'}</p>
            <button
              type="button"
              onClick={() => carregar(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Tentar de novo
            </button>
          </div>
        </section>
        {operationContent}
      </>
    );
  }

  const { ai, score, metrics } = data;
  const primeiroNome = data.nome?.split(' ')[0] || 'lojista';
  const geradoEm = new Date(data.geradoEm);
  const horarioGeracao = Number.isNaN(geradoEm.getTime())
    ? null
    : geradoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <section id="inteligencia" className="scroll-mt-32 flex flex-col gap-6" aria-labelledby="inteligencia-title">
        <InsightsHeading
          id="inteligencia-title"
          eyebrow="Inteligência IA"
          title="Consultor ZapFlow"
          description="Uma leitura diária do que merece atenção e das melhores próximas ações para sua loja."
          icon={Sparkles}
          scope="Hoje + últimos 7 dias"
        />

        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.10] via-white/80 to-slate-50/60 p-6 shadow-lg shadow-primary/5 dark:via-slate-900/60 dark:to-slate-900/20 sm:p-8"
        >
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                <Sparkles className="size-3.5" aria-hidden="true" />
                Análise inteligente
              </div>
              <h3 className="text-balance text-2xl font-black text-slate-900 dark:text-white sm:text-3xl">
                {saudacaoHora()}, {primeiroNome}!
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">{ai.resumoDia}</p>
              <p className="mt-3 text-sm font-semibold text-primary">{score.resumo}</p>
            </div>

            <div className="flex flex-col items-center self-center">
              <span className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Saúde do negócio</span>
              <ScoreRing valor={score.valor} nivel={score.nivel} />
            </div>
          </div>

          <div className="mt-6 flex flex-col justify-between gap-3 border-t border-slate-200/70 pt-4 dark:border-slate-700/50 sm:flex-row sm:items-center">
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
              {data.doCache ? 'Análise diária em cache' : 'Análise recém-gerada'}
              {horarioGeracao ? ` às ${horarioGeracao}` : ''}
              {data.aiError ? ' · modo simplificado' : ''}
            </span>
            <button
              type="button"
              onClick={() => carregar(true)}
              disabled={atualizando}
              className="flex w-fit items-center gap-2 rounded-xl border border-slate-200/70 bg-white/60 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-primary/30 hover:text-primary disabled:opacity-50 dark:border-slate-700/50 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:text-primary"
            >
              <RefreshCw className={cn('size-4', atualizando && 'animate-spin')} aria-hidden="true" />
              Atualizar IA
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard icon={TrendingUp} label="Faturamento hoje" valor={fmtMoeda(metrics.faturamentoHoje)} variacao={metrics.variacaoFaturamento} destaque />
          <MetricCard icon={ShoppingBag} label="Pedidos hoje" valor={String(metrics.pedidosHoje)} />
          <MetricCard icon={Receipt} label="Ticket médio hoje" valor={fmtMoeda(metrics.ticketHoje)} variacao={metrics.variacaoTicket} />
          <MetricCard icon={Clock} label="Pendentes agora" valor={String(metrics.pedidosPendentes)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <motion.article
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-primary/20 bg-primary/[0.07] p-6"
          >
            <div className="mb-2 flex items-center gap-2">
              <Trophy className="size-5 text-primary" aria-hidden="true" />
              <h3 className="font-bold text-slate-900 dark:text-white">Para comemorar</h3>
            </div>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{ai.destaquePositivo}</p>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/75 p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/50"
          >
            <div className="mb-2 flex items-center gap-2">
              <Flame className="size-5 text-amber-500 dark:text-amber-400" aria-hidden="true" />
              <h3 className="font-bold text-slate-900 dark:text-white">Sua jogada de hoje</h3>
            </div>
            <p className="font-semibold text-slate-800 dark:text-slate-100">{ai.sugestaoPrincipal.titulo}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{ai.sugestaoPrincipal.descricao}</p>
            <button
              type="button"
              onClick={() => executarAcao(router, ai.sugestaoPrincipal.tipoAcao, ai.sugestaoPrincipal.acaoSugerida)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-slate-950 transition-transform hover:scale-[1.02]"
            >
              {(() => {
                const Icon = ACAO_INFO[ai.sugestaoPrincipal.tipoAcao]?.icon ?? ArrowRight;
                return <Icon className="size-4" aria-hidden="true" />;
              })()}
              {ai.sugestaoPrincipal.acaoSugerida}
            </button>
          </motion.article>
        </div>

        {ai.alertas.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500 dark:text-amber-400" aria-hidden="true" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Precisa de atenção</h3>
            </div>
            <div className="flex flex-col gap-3">
              {ai.alertas.map((alerta, index) => (
                <motion.article
                  key={`${alerta.titulo}-${index}`}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    'rounded-2xl border p-4',
                    alerta.gravidade === 'alta'
                      ? 'border-red-300/60 bg-red-50/80 dark:border-red-500/30 dark:bg-red-500/[0.06]'
                      : alerta.gravidade === 'media'
                        ? 'border-amber-300/60 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/[0.06]'
                        : 'border-slate-200/70 bg-white/75 dark:border-slate-700/50 dark:bg-slate-900/50',
                  )}
                >
                  <p className="font-semibold text-slate-900 dark:text-white">{alerta.titulo}</p>
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{alerta.descricao}</p>
                </motion.article>
              ))}
            </div>
          </div>
        )}

        {ai.oportunidades.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="size-5 text-primary" aria-hidden="true" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Oportunidades para vender mais</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {ai.oportunidades.map((oportunidade, index) => {
                const info = ACAO_INFO[oportunidade.tipoAcao] ?? ACAO_INFO.geral;
                const Icon = info.icon;

                return (
                  <motion.article
                    key={`${oportunidade.titulo}-${index}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex flex-col rounded-2xl border border-slate-200/70 bg-white/75 p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/50"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                        <Icon className="size-4" aria-hidden="true" />
                      </div>
                      <h4 className="font-semibold text-slate-900 dark:text-white">{oportunidade.titulo}</h4>
                    </div>
                    <p className="flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{oportunidade.descricao}</p>
                    <button
                      type="button"
                      onClick={() => executarAcao(router, oportunidade.tipoAcao, oportunidade.acaoSugerida)}
                      className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {info.label}
                    </button>
                  </motion.article>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {operationContent}

      <section id="desempenho" className="scroll-mt-32 flex flex-col gap-6" aria-labelledby="desempenho-title">
        <InsightsHeading
          id="desempenho-title"
          eyebrow="Desempenho"
          title="Tendências do negócio"
          description="Produtos, clientes, comparativos e fatores que formam a saúde da operação."
          icon={BarChart3}
          scope="Hoje + semana"
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-3xl border border-slate-200/70 bg-white/75 p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/50">
            <div className="mb-4 flex items-center gap-2">
              <Star className="size-5 text-amber-500 dark:text-amber-400" aria-hidden="true" />
              <h3 className="font-bold text-slate-900 dark:text-white">Campeões da semana</h3>
            </div>
            {metrics.topProdutos.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Ainda sem vendas suficientes nesta semana.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {metrics.topProdutos.map((produto, index) => (
                  <li key={produto.nome} className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex size-6 items-center justify-center rounded-full text-xs font-bold',
                        index === 0
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-400/20 dark:text-amber-400'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                      )}
                    >
                      {index + 1}
                    </span>
                    <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{produto.nome}</span>
                    <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{produto.qtd} un</span>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="rounded-3xl border border-slate-200/70 bg-white/75 p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/50">
            <div className="mb-4 flex items-center gap-2">
              <Users className="size-5 text-primary" aria-hidden="true" />
              <h3 className="font-bold text-slate-900 dark:text-white">Seus clientes</h3>
            </div>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{ai.analiseClientes}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-100/80 p-4 text-center dark:bg-slate-800/60">
                <p className="text-2xl font-black text-slate-900 dark:text-white">{metrics.clientesUnicosSemana}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Clientes na semana</p>
              </div>
              <div className="rounded-2xl bg-primary/[0.08] p-4 text-center">
                <p className="text-2xl font-black text-primary">{metrics.clientesRecorrentes}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Voltaram a comprar</p>
              </div>
            </div>
          </article>
        </div>

        <ComparativosSection initialData={data.comparativos} cacheScope={data.geradoEm} />

        {score.fatores.length > 0 && (
          <article className="rounded-3xl border border-slate-200/70 bg-white/75 p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/50">
            <h3 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">O que compõe seu score</h3>
            <div className="flex flex-col gap-2">
              {score.fatores.map((fator, index) => (
                <div key={`${fator.label}-${index}`} className="flex items-center justify-between rounded-xl bg-slate-100/70 px-4 py-2.5 dark:bg-slate-800/50">
                  <span className="text-sm text-slate-600 dark:text-slate-300">{fator.label}</span>
                  <span className={cn('text-sm font-bold', fator.impacto >= 0 ? 'text-primary' : 'text-red-500 dark:text-red-400')}>
                    {fator.impacto >= 0 ? '+' : ''}
                    {fator.impacto}
                  </span>
                </div>
              ))}
            </div>
          </article>
        )}

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-sm italic text-slate-500 dark:text-slate-400"
        >
          &ldquo;{ai.fraseMotivacional}&rdquo;
        </motion.p>
      </section>

      <ZapflowChat />
    </>
  );
}
