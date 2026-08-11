'use client';

import { useEffect, useState } from 'react';
import { Zap, CreditCard, LogOut, Loader2, ShieldCheck, Check } from 'lucide-react';
import { toast } from 'sonner';
import { getBillingStatus, generateCheckoutLink, type BillingStatus } from '@/app/actions/billing';
import { logout } from '@/app/actions/auth';
import { SUBSCRIPTION_PLANS, normalizePlanName } from '@/lib/constants';

interface BlockScreenProps {
  empresaId: number;
  nome?: string | null;
  /** Estado inicial opcional (usado para preview/testes visuais). */
  initialStatus?: BillingStatus | null;
}

/** O que o cliente recupera ao regularizar — reforca o valor, nao a punicao. */
const RECURSOS_LIBERADOS = [
  'Cardápio digital',
  'Gestão de pedidos',
  'Clientes e histórico',
  'Campanhas e cupons',
  'Relatórios e insights',
];

/** Nome de exibicao do plano a partir do id/codigo salvo no banco. */
function nomePlano(plano: string | null): string | null {
  if (!plano) return null;
  const id = normalizePlanName(plano).toUpperCase() as keyof typeof SUBSCRIPTION_PLANS;
  return SUBSCRIPTION_PLANS[id]?.name ?? null;
}

/** Formata uma data ISO/date para dd/mm/aaaa (pt-BR), com seguranca. */
function formatarData(valor: string | null): string | null {
  if (!valor) return null;
  const d = new Date(valor);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Tela de "regularizacao" exibida quando a empresa esta inadimplente e foi
 * bloqueada. Cobre todo o dashboard. O tom e comercial (voltar a vender), nao
 * punitivo: mostra o plano, o valor, o que o cliente recupera e um CTA verde.
 * As unicas acoes possiveis sao regularizar (checkout Mercado Pago) ou sair.
 */
export function BlockScreen({ empresaId, nome, initialStatus = null }: BlockScreenProps) {
  const [paying, setPaying] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [status, setStatus] = useState<BillingStatus | null>(initialStatus);

  useEffect(() => {
    if (initialStatus) return; // preview/estado ja fornecido
    let ativo = true;
    getBillingStatus(empresaId)
      .then((s) => {
        if (ativo && s) setStatus(s);
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [empresaId, initialStatus]);

  async function handlePagar() {
    setPaying(true);
    try {
      const result = await generateCheckoutLink(empresaId);
      if (result.success && result.initPoint) {
        window.location.href = result.initPoint;
      } else {
        toast.error(result.error || 'Erro ao abrir o checkout de pagamento');
        setPaying(false);
      }
    } catch {
      toast.error('Erro ao abrir o checkout de pagamento');
      setPaying(false);
    }
  }

  async function handleSair() {
    setLeaving(true);
    try {
      await logout();
    } finally {
      window.location.href = '/login';
    }
  }

  const valor = status?.valor != null && status.valor > 0 ? status.valor : null;
  const valorFmt = valor != null ? `R$ ${valor.toFixed(2).replace('.', ',')}` : null;
  const planoNome = nomePlano(status?.plano_assinatura ?? status?.plano ?? null);
  const vencimentoFmt = formatarData(status?.data_proxima_cobranca ?? status?.data_vencimento ?? null);
  const dias = status?.dias_inadimplente ?? 0;
  const primeiroNome = nome ? String(nome).split(' ')[0] : null;
  // Atraso recente: reforco emocional de "quase la".
  const atrasoRecente = dias > 0 && dias <= 7;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="block-title"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-background-dark/95 p-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-md">
        {/* Glow verde discreto atras do card */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-primary/20 blur-3xl"
        />

        <div className="rounded-2xl border border-border-dark bg-surface-dark p-7 shadow-2xl sm:p-8">
          {/* Marca */}
          <div className="flex items-center justify-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary">
              <Zap className="size-5 text-background-dark" aria-hidden="true" fill="currentColor" />
            </span>
            <span className="text-lg font-bold tracking-tight text-white">ZapFlow</span>
          </div>

          {/* Status */}
          <div className="mt-6 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-400">
              <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />
              Assinatura pausada
            </span>
          </div>

          {/* Titulo + subtitulo */}
          <h1
            id="block-title"
            className="mt-4 text-center text-2xl font-bold text-balance text-white"
          >
            {atrasoRecente && primeiroNome
              ? `${primeiroNome}, você está a um passo de voltar`
              : 'Sua assinatura está pausada'}
          </h1>

          <p className="mt-3 text-center text-sm leading-relaxed text-text-secondary text-pretty">
            Seu ZapFlow está pausado. Regularize sua assinatura e volte a receber
            pedidos normalmente — seu cardápio continua aqui, seus dados também.
          </p>

          {/* Card do plano */}
          {(planoNome || valorFmt) && (
            <div className="mt-6 rounded-xl border border-border-dark bg-surface-elevated p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-text-secondary">
                  Plano atual
                </span>
                {planoNome && (
                  <span className="text-sm font-semibold text-primary">{planoNome}</span>
                )}
              </div>
              {valorFmt && (
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">{valorFmt}</span>
                  <span className="text-sm text-text-secondary">/mês</span>
                </div>
              )}
              {vencimentoFmt && (
                <p className="mt-1 text-xs text-text-secondary">
                  {dias > 0 ? 'Venceu em' : 'Vencimento'}: {vencimentoFmt}
                </p>
              )}
            </div>
          )}

          {/* Reforco de seguranca */}
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-text-secondary">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            Seus dados e pedidos continuam salvos e seguros.
          </div>

          {/* CTA principal */}
          <button
            onClick={handlePagar}
            disabled={paying || leaving}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3.5 text-sm font-bold text-background-dark transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            {paying ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <CreditCard className="size-4" aria-hidden="true" />
            )}
            Regularizar agora
          </button>

          {/* O que recupera */}
          <div className="mt-5 rounded-xl border border-border-dark bg-surface-elevated/50 p-4">
            <p className="text-xs font-medium text-text-secondary">
              Ao regularizar, você recupera imediatamente:
            </p>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {RECURSOS_LIBERADOS.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-slate-200">
                  <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Sair */}
          <button
            onClick={handleSair}
            disabled={paying || leaving}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:text-white disabled:opacity-60"
          >
            {leaving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="size-4" aria-hidden="true" />
            )}
            Sair da conta
          </button>

          <p className="mt-4 text-center text-xs text-text-secondary">
            Pagamento confirmado? Seu acesso é restaurado automaticamente em
            instantes.
          </p>
        </div>
      </div>
    </div>
  );
}
