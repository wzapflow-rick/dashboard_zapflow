'use client';

import { useState, useEffect } from 'react';
import { X, Clock, Sparkles, ArrowRight } from 'lucide-react';
import { getTrialDaysRemaining, shouldShowTrialWarning, SUBSCRIPTION_PLANS } from '@/lib/constants';
import Link from 'next/link';

interface TrialWarningBannerProps {
  plano: string | null | undefined;
  dataInicio: string | Date | null | undefined;
  empresaId?: number;
}

export function TrialWarningBanner({ plano, dataInicio, empresaId }: TrialWarningBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Verificar se ja foi dispensado hoje
    const dismissedDate = localStorage.getItem(`trial_warning_dismissed_${empresaId}`);
    if (dismissedDate === new Date().toDateString()) {
      setDismissed(true);
    }
  }, [empresaId]);

  if (!mounted) return null;
  
  // So mostrar para plano parceria
  if (plano !== 'parceria') return null;
  
  // So mostrar se estiver no dia 6 ou 7
  if (!shouldShowTrialWarning(dataInicio)) return null;
  
  // Ja foi dispensado hoje
  if (dismissed) return null;

  const diasRestantes = getTrialDaysRemaining(dataInicio);
  const precoPromocional = SUBSCRIPTION_PLANS.PARCERIA.convertPrice;

  const handleDismiss = () => {
    localStorage.setItem(`trial_warning_dismissed_${empresaId}`, new Date().toDateString());
    setDismissed(true);
  };

  return (
    <div className="relative bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white rounded-xl p-4 mb-6 shadow-lg overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
      </div>
      
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 hover:bg-white/20 rounded-full transition-colors"
        aria-label="Fechar"
      >
        <X className="size-5" />
      </button>

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/20 rounded-full">
            <Clock className="size-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Sparkles className="size-5" />
              {diasRestantes === 0 
                ? 'Ultimo dia do seu teste gratis!' 
                : `Falta apenas ${diasRestantes} dia para o fim do teste!`}
            </h3>
            <p className="text-white/90 text-sm mt-1">
              Continue usando todas as funcoes por apenas{' '}
              <span className="font-bold text-yellow-200">R$ {precoPromocional?.toFixed(2).replace('.', ',')}/mes</span>
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/settings?tab=assinatura"
          className="sm:ml-auto flex items-center gap-2 bg-white text-orange-600 font-bold px-5 py-2.5 rounded-lg hover:bg-orange-50 transition-colors shadow-md whitespace-nowrap"
        >
          Assinar Agora
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
