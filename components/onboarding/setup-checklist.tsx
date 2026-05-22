'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, ChevronRight, Store, Package, CreditCard, MessageCircle, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OnboardingStatus } from '@/app/actions/onboarding-status';

interface SetupChecklistProps {
  initialStatus: OnboardingStatus;
}

const STORAGE_KEY = 'zapflow_checklist_minimized';
const COMPLETED_KEY = 'zapflow_checklist_completed';

export function SetupChecklist({ initialStatus }: SetupChecklistProps) {
  const router = useRouter();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    // Verificar se ja foi completado permanentemente
    const completed = localStorage.getItem(COMPLETED_KEY);
    if (completed === 'true') {
      setIsHidden(true);
      return;
    }

    // Verificar se esta minimizado
    const minimized = localStorage.getItem(STORAGE_KEY);
    if (minimized === 'true') {
      setIsMinimized(true);
    }
  }, []);

  useEffect(() => {
    // Se completou todas as etapas, esconder permanentemente
    if (status.completedSteps === status.totalSteps) {
      localStorage.setItem(COMPLETED_KEY, 'true');
      // Pequeno delay para mostrar o estado completo antes de esconder
      setTimeout(() => {
        setIsHidden(true);
      }, 2000);
    }
  }, [status.completedSteps, status.totalSteps]);

  const handleMinimize = () => {
    setIsMinimized(true);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  const handleExpand = () => {
    setIsMinimized(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleStepClick = (step: string) => {
    switch (step) {
      case 'company':
        router.push('/dashboard/settings?tab=loja');
        break;
      case 'products':
        router.push('/dashboard/menu');
        break;
      case 'mercadopago':
        router.push('/dashboard/settings?tab=pagamentos');
        break;
      case 'whatsapp':
        router.push('/dashboard/settings?tab=whatsapp');
        break;
    }
  };

  if (isHidden) {
    return null;
  }

  const progressPercent = Math.round((status.completedSteps / status.totalSteps) * 100);
  const isComplete = status.completedSteps === status.totalSteps;

  const steps = [
    {
      id: 'company',
      label: 'Dados da loja',
      description: 'Nome, endereco e telefone',
      completed: status.hasCompanyData,
      icon: Store,
    },
    {
      id: 'products',
      label: 'Cadastrar produtos',
      description: 'Adicione seu cardapio',
      completed: status.hasProducts,
      icon: Package,
    },
    {
      id: 'mercadopago',
      label: 'Mercado Pago',
      description: 'Receba pagamentos online',
      completed: status.hasMercadoPago,
      icon: CreditCard,
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      description: 'Automacoes e notificacoes',
      completed: status.hasWhatsApp,
      icon: MessageCircle,
    },
  ];

  // Versao minimizada
  if (isMinimized) {
    return (
      <button
        onClick={handleExpand}
        className="mb-4 w-full flex items-center justify-between gap-2 sm:gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 sm:px-4 py-3 text-left transition-all hover:bg-emerald-500/10"
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20">
            <Rocket className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              Configure sua loja
            </p>
            <p className="text-xs text-gray-400">
              {status.completedSteps}/{status.totalSteps} etapas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="h-2 w-16 sm:w-24 overflow-hidden rounded-full bg-gray-700">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-sm font-medium text-emerald-400">{progressPercent}%</span>
          <ChevronRight className="h-4 w-4 text-gray-400 hidden sm:block" />
        </div>
      </button>
    );
  }

  // Versao expandida
  return (
    <div className="mb-4 sm:mb-6 overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/10 px-4 sm:px-5 py-3 sm:py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20">
            <Rocket className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-semibold text-white">
              {isComplete ? 'Configuracao completa!' : 'Configure sua loja'}
            </h3>
            <p className="text-xs sm:text-sm text-gray-400">
              {isComplete
                ? 'Pronta para receber pedidos'
                : `${status.completedSteps} de ${status.totalSteps} etapas`}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
          {/* Barra de progresso */}
          <div className="flex items-center gap-2">
            <div className="h-2 w-28 sm:w-32 overflow-hidden rounded-full bg-gray-700">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  isComplete ? "bg-emerald-400" : "bg-emerald-500"
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-emerald-400">{progressPercent}%</span>
          </div>
          {/* Botao minimizar */}
          {!isComplete && (
            <button
              onClick={handleMinimize}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
              title="Minimizar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="grid gap-2 p-3 sm:p-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <button
              key={step.id}
              onClick={() => !step.completed && handleStepClick(step.id)}
              disabled={step.completed}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl border p-3 sm:p-4 text-left transition-all",
                step.completed
                  ? "border-emerald-500/30 bg-emerald-500/10 cursor-default"
                  : "border-gray-700 bg-gray-800/50 hover:border-emerald-500/50 hover:bg-gray-800 active:scale-[0.98]"
              )}
            >
              {/* Icone de status */}
              <div
                className={cn(
                  "flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                  step.completed
                    ? "bg-emerald-500/20"
                    : "bg-gray-700 group-hover:bg-emerald-500/20"
                )}
              >
                {step.completed ? (
                  <Check className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
                ) : (
                  <Icon className={cn(
                    "h-4 w-4 sm:h-5 sm:w-5 transition-colors",
                    "text-gray-400 group-hover:text-emerald-400"
                  )} />
                )}
              </div>

              {/* Texto */}
              <div className="min-w-0 flex-1">
                <p className={cn(
                  "font-medium truncate",
                  step.completed ? "text-emerald-400" : "text-white"
                )}>
                  {step.label}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {step.completed ? 'Concluido' : step.description}
                </p>
              </div>

              {/* Seta para itens nao completos */}
              {!step.completed && (
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
