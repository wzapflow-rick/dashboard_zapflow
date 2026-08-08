'use client';

import { useEffect, useState } from 'react';
import { Lock, CreditCard, LogOut, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getBillingStatus, generateCheckoutLink } from '@/app/actions/billing';
import { logout } from '@/app/actions/auth';

interface BlockScreenProps {
  empresaId: number;
  nome?: string | null;
}

/**
 * Tela de bloqueio total exibida quando a empresa esta inadimplente
 * (2+ dias apos o vencimento). Cobre todo o dashboard. As unicas acoes
 * possiveis sao pagar (checkout Mercado Pago) ou sair da conta.
 */
export function BlockScreen({ empresaId, nome }: BlockScreenProps) {
  const [paying, setPaying] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [valor, setValor] = useState<number | null>(null);

  useEffect(() => {
    let ativo = true;
    getBillingStatus(empresaId)
      .then((status) => {
        if (ativo && status?.valor != null && status.valor > 0) {
          setValor(status.valor);
        }
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [empresaId]);

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

  const valorFmt =
    valor != null ? `R$ ${valor.toFixed(2).replace('.', ',')}` : null;
  const primeiroNome = nome ? String(nome).split(' ')[0] : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-full bg-amber-500/15">
          <Lock className="size-7 text-amber-500" aria-hidden="true" />
        </div>

        <h1 className="text-center text-xl font-bold text-balance text-card-foreground">
          {primeiroNome ? `Ei, ${primeiroNome}!` : 'Sua assinatura venceu'}
        </h1>

        <p className="mt-3 text-center text-sm leading-relaxed text-muted-foreground text-pretty">
          Notamos que o pagamento da sua assinatura está em atraso e, por isso, o
          acesso ao sistema foi pausado temporariamente. Regularize agora e volte a
          usar tudo na mesma hora — seus dados continuam salvos e seguros.
        </p>

        {valorFmt && (
          <div className="mt-6 flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3">
            <span className="text-sm text-muted-foreground">Valor da assinatura</span>
            <span className="text-base font-bold text-card-foreground">{valorFmt}</span>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={handlePagar}
            disabled={paying || leaving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-3 text-sm font-bold text-black transition-colors hover:bg-amber-600 disabled:opacity-60"
          >
            {paying ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <CreditCard className="size-4" aria-hidden="true" />
            )}
            Pagar agora
          </button>

          <button
            onClick={handleSair}
            disabled={paying || leaving}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            {leaving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="size-4" aria-hidden="true" />
            )}
            Sair da conta
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Já pagou? O acesso é liberado automaticamente em instantes após a
          confirmação. Se precisar de ajuda, fale com o suporte.
        </p>
      </div>
    </div>
  );
}
