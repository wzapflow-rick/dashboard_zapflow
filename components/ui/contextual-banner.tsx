'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, AlertCircle, CreditCard, MessageCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContextualBannerProps {
  type: 'mercadopago' | 'whatsapp' | 'products' | 'custom';
  title?: string;
  description?: string;
  actionLabel?: string;
  actionUrl?: string;
  dismissKey?: string;
  dismissDuration?: number; // em horas, default 24
  variant?: 'warning' | 'info' | 'success';
}

export function ContextualBanner({
  type,
  title,
  description,
  actionLabel,
  actionUrl,
  dismissKey,
  dismissDuration = 24,
  variant = 'warning',
}: ContextualBannerProps) {
  const router = useRouter();
  const [isDismissed, setIsDismissed] = useState(true); // Comeca escondido para evitar flash

  const storageKey = dismissKey || `zapflow_banner_${type}`;

  // Configuracoes por tipo
  const configs = {
    mercadopago: {
      icon: CreditCard,
      title: 'Configure o Mercado Pago',
      description: 'Conecte sua conta para receber pagamentos online via PIX e cartao.',
      actionLabel: 'Configurar agora',
      actionUrl: '/dashboard/settings?tab=pagamentos',
      variant: 'warning' as const,
    },
    whatsapp: {
      icon: MessageCircle,
      title: 'Conecte o WhatsApp',
      description: 'Envie atualizacoes automaticas de pedidos para seus clientes.',
      actionLabel: 'Conectar WhatsApp',
      actionUrl: '/dashboard/settings?tab=whatsapp',
      variant: 'info' as const,
    },
    products: {
      icon: AlertCircle,
      title: 'Cadastre seus produtos',
      description: 'Adicione produtos ao cardapio para comecar a receber pedidos.',
      actionLabel: 'Adicionar produtos',
      actionUrl: '/dashboard/products',
      variant: 'warning' as const,
    },
    custom: {
      icon: AlertCircle,
      title: title || 'Aviso',
      description: description || '',
      actionLabel: actionLabel || 'Ver mais',
      actionUrl: actionUrl || '#',
      variant: variant,
    },
  };

  const config = type === 'custom' 
    ? { ...configs.custom, title, description, actionLabel, actionUrl, variant }
    : configs[type];

  const Icon = config.icon;

  useEffect(() => {
    const dismissedAt = localStorage.getItem(storageKey);
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt);
      const hoursElapsed = (Date.now() - dismissedTime) / (1000 * 60 * 60);
      if (hoursElapsed < dismissDuration) {
        setIsDismissed(true);
        return;
      }
    }
    setIsDismissed(false);
  }, [storageKey, dismissDuration]);

  const handleDismiss = () => {
    localStorage.setItem(storageKey, Date.now().toString());
    setIsDismissed(true);
  };

  const handleAction = () => {
    if (config.actionUrl) {
      router.push(config.actionUrl);
    }
  };

  if (isDismissed) {
    return null;
  }

  const variantStyles = {
    warning: {
      container: 'border-amber-500/30 bg-amber-500/10',
      icon: 'bg-amber-500/20 text-amber-400',
      title: 'text-amber-400',
      button: 'bg-amber-500 hover:bg-amber-600 text-black',
    },
    info: {
      container: 'border-blue-500/30 bg-blue-500/10',
      icon: 'bg-blue-500/20 text-blue-400',
      title: 'text-blue-400',
      button: 'bg-blue-500 hover:bg-blue-600 text-white',
    },
    success: {
      container: 'border-emerald-500/30 bg-emerald-500/10',
      icon: 'bg-emerald-500/20 text-emerald-400',
      title: 'text-emerald-400',
      button: 'bg-emerald-500 hover:bg-emerald-600 text-black',
    },
  };

  const styles = variantStyles[config.variant || 'warning'];

  return (
    <div className={cn(
      "mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-xl border p-3 sm:p-4",
      styles.container
    )}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn("flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl", styles.icon)}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0">
          <p className={cn("text-sm sm:text-base font-medium truncate", styles.title)}>{config.title}</p>
          <p className="text-xs sm:text-sm text-gray-400 line-clamp-2">{config.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end sm:justify-start shrink-0">
        <button
          onClick={handleAction}
          className={cn(
            "flex items-center gap-1.5 sm:gap-2 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors active:scale-95",
            styles.button
          )}
        >
          <span className="whitespace-nowrap">{config.actionLabel}</span>
          <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>
        <button
          onClick={handleDismiss}
          className="rounded-lg p-1.5 sm:p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
          title="Dispensar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
