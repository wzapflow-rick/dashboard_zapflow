'use client';

import { AlertTriangle, XCircle, Clock, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getBillingStatus, type BillingStatus } from '@/app/actions/billing';

interface PaymentAlertProps {
  empresaId: number;
}

export function PaymentAlert({ empresaId }: PaymentAlertProps) {
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBilling() {
      const status = await getBillingStatus(empresaId);
      setBilling(status);
      setLoading(false);
    }
    fetchBilling();
  }, [empresaId]);

  if (loading || !billing) return null;

  // Se pagamento por cartao, nao mostra alerta (cobranca automatica)
  if (billing.tipo_pagamento === 'cartao') return null;

  // Se nao tem vencimento definido, nao mostra
  if (!billing.data_vencimento) return null;

  const hoje = new Date();
  const vencimento = new Date(billing.data_vencimento);
  const diasParaVencer = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

  // Se falta mais de 5 dias, nao mostra
  if (diasParaVencer > 5 && !billing.bloqueado && billing.dias_inadimplente === 0) {
    return null;
  }

  // Determinar tipo de alerta
  let alertType: 'warning' | 'danger' | 'blocked' = 'warning';
  let message = '';
  let icon = Clock;

  if (billing.bloqueado) {
    alertType = 'blocked';
    message = 'Seu sistema esta bloqueado por inadimplencia. Regularize o pagamento para continuar usando.';
    icon = XCircle;
  } else if (billing.dias_inadimplente >= 4) {
    alertType = 'danger';
    message = `Urgente! Voce esta ${billing.dias_inadimplente} dias inadimplente. Seu sistema sera bloqueado em breve.`;
    icon = AlertTriangle;
  } else if (billing.dias_inadimplente > 0) {
    alertType = 'warning';
    message = `Sua assinatura esta ${billing.dias_inadimplente} dia(s) atrasada. Regularize para evitar o bloqueio.`;
    icon = AlertTriangle;
  } else if (diasParaVencer === 0) {
    alertType = 'warning';
    message = 'Sua assinatura vence hoje! Pague agora para continuar usando o sistema.';
    icon = Clock;
  } else if (diasParaVencer <= 3) {
    alertType = 'warning';
    message = `Sua assinatura vence em ${diasParaVencer} dia(s). Antecipe o pagamento!`;
    icon = Clock;
  } else {
    return null;
  }

  const bgColors = {
    warning: 'bg-amber-500/10 border-amber-500/30',
    danger: 'bg-red-500/10 border-red-500/30',
    blocked: 'bg-red-600/20 border-red-600/50',
  };

  const textColors = {
    warning: 'text-amber-400',
    danger: 'text-red-400',
    blocked: 'text-red-300',
  };

  const Icon = icon;

  return (
    <div className={`w-full px-4 py-3 ${bgColors[alertType]} border rounded-lg mb-4`}>
      <div className="flex items-center gap-3">
        <Icon className={`size-5 ${textColors[alertType]} shrink-0`} />
        <p className={`text-sm ${textColors[alertType]} flex-1`}>
          {message}
        </p>
        <Link
          href="/dashboard/subscription"
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            alertType === 'blocked'
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-amber-500 hover:bg-amber-600 text-black'
          }`}
        >
          <CreditCard className="size-4" />
          Pagar agora
        </Link>
      </div>
    </div>
  );
}
