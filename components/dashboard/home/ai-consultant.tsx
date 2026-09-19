'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import {
  Sparkles,
  ArrowRight,
  Megaphone,
  Ticket,
  MessageCircle,
  UtensilsCrossed,
  Users,
  Share2,
} from 'lucide-react';
import {
  getZapflowInsights,
  type ZapflowInsightsResult,
  type TipoAcao,
} from '@/app/actions/zapflow-insights';
import { cn } from '@/lib/utils';

// Mapeia o tipo de ação sugerida pela IA para o ícone e a rota real da aplicação.
const ACAO_INFO: Record<TipoAcao, { icon: typeof Megaphone; href: string }> = {
  campanha: { icon: Megaphone, href: '/dashboard/campanhas' },
  cupom: { icon: Ticket, href: '/dashboard/campanhas' },
  whatsapp: { icon: MessageCircle, href: '/dashboard/customers' },
  cardapio: { icon: UtensilsCrossed, href: '/dashboard/menu' },
  clientes: { icon: Users, href: '/dashboard/customers' },
  geral: { icon: Sparkles, href: '/dashboard/growth' },
};

const NIVEL: Record<
  ZapflowInsightsResult['score']['nivel'],
  { label: string; color: string }
> = {
  critico: { label: 'Crítico', color: 'text-red-500 dark:text-red-400' },
  atencao: { label: 'Atenção', color: 'text-amber-500 dark:text-amber-400' },
  saudavel: { label: 'Saudável', color: 'text-primary' },
  excelente: { label: 'Excelente', color: 'text-primary' },
};

function executarAcao(router: ReturnType<typeof useRouter>, tipo: TipoAcao, descricao: string) {
  const info = ACAO_INFO[tipo] ?? ACAO_INFO.geral;
  try {
    sessionStorage.setItem('zapflow_acao_sugerida', JSON.stringify({ tipo, descricao, origem: 'consultor' }));
  } catch {
    /* ignore */
  }
  toast.success('Vamos lá!', { description: descricao });
  router.push(info.href);
}

function ConsultantShell({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-label="Consultor ZapFlow"
      className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] via-white/70 to-white/70 p-5 shadow-sm dark:from-primary/[0.08] dark:via-white/[0.02] dark:to-transparent sm:p-6"
    >
      {children}
    </section>
  );
}

function Eyebrow() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-6 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Sparkles className="size-3.5" aria-hidden="true" />
      </span>
      <span className="text-xs font-bold uppercase tracking-widest text-primary">Consultor ZapFlow</span>
    </div>
  );
}

export function AIConsultant() {
  const router = useRouter();
  const [data, setData] = useState<ZapflowInsightsResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    queueMicrotask(async () => {
      try {
        const result = await getZapflowInsights();
        if (active) setData(result);
      } catch (error) {
        console.error('[v0] Erro ao carregar consultor:', error);
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <ConsultantShell>
        <Eyebrow />
        <div className="mt-4 space-y-3">
          <div className="h-6 w-3/4 animate-pulse rounded-lg bg-slate-200/70 dark:bg-white/10" />
          <div className="h-4 w-full animate-pulse rounded-lg bg-slate-200/60 dark:bg-white/[0.06]" />
          <div className="h-4 w-2/3 animate-pulse rounded-lg bg-slate-200/60 dark:bg-white/[0.06]" />
          <div className="h-11 w-48 animate-pulse rounded-xl bg-slate-200/70 dark:bg-white/10" />
        </div>
      </ConsultantShell>
    );
  }

  const ai = data?.ai ?? null;
  const score = data?.score ?? null;
  const temDados = data?.metrics?.temDados ?? false;

  // Sem dados suficientes ou IA indisponível: orienta sem inventar números.
  if (!data?.success || !ai || !temDados) {
    return (
      <ConsultantShell>
        <Eyebrow />
        <h3 className="mt-4 text-balance text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
          Ainda estamos aprendendo sobre sua operação.
        </h3>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Assim que os primeiros pedidos entrarem, seu consultor mostra aqui o que está indo bem e o próximo passo
          para vender mais. Que tal começar divulgando seu cardápio?
        </p>
        <Link
          href="/dashboard/growth"
          className="group mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-slate-950 transition-transform hover:scale-[1.01] active:scale-[0.99]"
        >
          <Share2 className="size-4" aria-hidden="true" />
          Divulgar cardápio
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </ConsultantShell>
    );
  }

  const nivel = score ? NIVEL[score.nivel] : NIVEL.atencao;
  const sugestao = ai.sugestaoPrincipal;
  const AcaoIcon = (ACAO_INFO[sugestao.tipoAcao] ?? ACAO_INFO.geral).icon;

  return (
    <ConsultantShell>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
        <div className="min-w-0 flex-1">
          <Eyebrow />

          <h3 className="mt-4 text-balance text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            {score?.resumo || ai.resumoDia}
          </h3>
          {ai.resumoDia && ai.resumoDia !== score?.resumo && (
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">{ai.resumoDia}</p>
          )}

          <div className="mt-5 rounded-2xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/[0.07] dark:bg-white/[0.02]">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Recomendação</p>
            <p className="mt-1.5 font-semibold text-slate-900 dark:text-white">{sugestao.titulo}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{sugestao.descricao}</p>

            <motion.button
              type="button"
              onClick={() => executarAcao(router, sugestao.tipoAcao, sugestao.acaoSugerida)}
              whileTap={{ scale: 0.98 }}
              className="group mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-slate-950 transition-transform hover:scale-[1.01] active:scale-[0.99] sm:w-auto"
            >
              <AcaoIcon className="size-4" aria-hidden="true" />
              {sugestao.acaoSugerida}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </motion.button>
          </div>
        </div>

        {score && (
          <div className="flex shrink-0 flex-row items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/[0.07] dark:bg-white/[0.02] lg:w-48 lg:flex-col lg:justify-center lg:text-center">
            <div className="flex flex-col lg:items-center">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Saúde do negócio
              </span>
              <div className="mt-1 flex items-baseline gap-1 lg:mt-2 lg:flex-col lg:items-center">
                <span className={cn('text-4xl font-black tabular-nums leading-none', nivel.color)}>{score.valor}</span>
                <span className={cn('text-xs font-semibold', nivel.color)}>{nivel.label}</span>
              </div>
            </div>
            <Link
              href="/dashboard/insights"
              className="group inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary-hover"
            >
              Ver análise
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </ConsultantShell>
  );
}
