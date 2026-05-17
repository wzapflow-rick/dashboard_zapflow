'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lightbulb, 
  ChevronLeft, 
  ChevronRight, 
  Megaphone, 
  Tag, 
  TrendingUp, 
  Users, 
  Clock, 
  Star,
  Zap,
  Target,
  Gift,
  MessageCircle,
  Camera,
  Repeat,
  ShoppingBag,
  Heart
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Tip {
  id: number;
  icon: React.ElementType;
  title: string;
  description: string;
  category: 'marketing' | 'vendas' | 'operacao' | 'fidelizacao';
  actionLabel?: string;
  actionHref?: string;
}

const tips: Tip[] = [
  {
    id: 1,
    icon: Megaphone,
    title: 'Nao espere seu cliente lembrar de voce',
    description: 'Lembre dele primeiro! Crie uma campanha de WhatsApp para clientes que nao compram ha mais de 15 dias.',
    category: 'marketing',
    actionLabel: 'Criar Campanha',
    actionHref: '/dashboard/campanhas',
  },
  {
    id: 2,
    icon: Tag,
    title: 'Cupom no Story funciona!',
    description: 'Crie um cupom de desconto e poste no story: "Cupom disponivel para os 5 primeiros!" - Gera urgencia e engajamento.',
    category: 'marketing',
    actionLabel: 'Criar Cupom',
    actionHref: '/dashboard/growth',
  },
  {
    id: 3,
    icon: TrendingUp,
    title: 'Up-sell aumenta seu ticket medio',
    description: 'Adicione produtos complementares vinculados aos seus itens principais. "Adicionar batata frita por +R$5?" pode aumentar 20% do faturamento.',
    category: 'vendas',
  },
  {
    id: 4,
    icon: Users,
    title: 'Cliente VIP merece atencao especial',
    description: 'Identifique seus 10 melhores clientes e envie uma mensagem personalizada de agradecimento. Fidelizacao custa menos que aquisicao.',
    category: 'fidelizacao',
    actionLabel: 'Ver Clientes',
    actionHref: '/dashboard/customers',
  },
  {
    id: 5,
    icon: Clock,
    title: 'Horario de pico = preparacao',
    description: 'Se seu pico e as 20h, comece a preparar ingredientes as 19h. Reducao de 5 minutos no tempo de entrega = cliente mais feliz.',
    category: 'operacao',
  },
  {
    id: 6,
    icon: Star,
    title: 'Peca avaliacao no momento certo',
    description: 'Envie mensagem pedindo avaliacao 30 minutos apos a entrega - quando o cliente acabou de comer e esta satisfeito.',
    category: 'fidelizacao',
  },
  {
    id: 7,
    icon: Gift,
    title: 'Brinde surpresa gera indicacao',
    description: 'Inclua um brinde pequeno (bala, biscoito) com bilhete: "Obrigado pela preferencia!" - Custa centavos, gera memorias.',
    category: 'fidelizacao',
  },
  {
    id: 8,
    icon: Camera,
    title: 'Foto boa vende mais',
    description: 'Tire fotos dos seus pratos com luz natural. Produtos com foto profissional vendem ate 30% mais no cardapio digital.',
    category: 'vendas',
    actionLabel: 'Ver Cardapio',
    actionHref: '/dashboard/menu',
  },
  {
    id: 9,
    icon: Repeat,
    title: 'Cliente recorrente e ouro',
    description: 'Um cliente que compra 2x por mes vale mais que 10 clientes novos. Foque em fazer ele voltar com ofertas exclusivas.',
    category: 'fidelizacao',
  },
  {
    id: 10,
    icon: MessageCircle,
    title: 'Responda rapido no WhatsApp',
    description: 'Tempo de resposta abaixo de 2 minutos aumenta em 40% a chance de conversao. Configure respostas automaticas!',
    category: 'operacao',
  },
  {
    id: 11,
    icon: ShoppingBag,
    title: 'Combo e rei do ticket medio',
    description: 'Crie combos com margem maior. "Pizza + Refri + Sobremesa" por preco especial parece vantagem pro cliente e aumenta seu lucro.',
    category: 'vendas',
  },
  {
    id: 12,
    icon: Target,
    title: 'Meta diaria motiva a equipe',
    description: 'Defina uma meta de faturamento diario e compartilhe com a equipe. Metas claras aumentam produtividade em ate 25%.',
    category: 'operacao',
  },
  {
    id: 13,
    icon: Heart,
    title: 'Aniversario do cliente',
    description: 'Envie cupom especial no aniversario do cliente. "Parabens! Seu presente: 15% OFF hoje!" - Taxa de conversao altissima.',
    category: 'fidelizacao',
  },
  {
    id: 14,
    icon: Zap,
    title: 'Domingo a noite e estrategico',
    description: 'Domingo 18h-21h e pico de delivery. Prepare estoque extra e equipe refor cada para nao perder vendas.',
    category: 'operacao',
  },
];

const categoryConfig = {
  marketing: { 
    color: 'from-violet-500/20 to-violet-500/5', 
    border: 'border-violet-500/30',
    text: 'text-violet-500',
    label: 'Marketing' 
  },
  vendas: { 
    color: 'from-emerald-500/20 to-emerald-500/5', 
    border: 'border-emerald-500/30',
    text: 'text-emerald-500',
    label: 'Vendas' 
  },
  operacao: { 
    color: 'from-amber-500/20 to-amber-500/5', 
    border: 'border-amber-500/30',
    text: 'text-amber-500',
    label: 'Operacao' 
  },
  fidelizacao: { 
    color: 'from-rose-500/20 to-rose-500/5', 
    border: 'border-rose-500/30',
    text: 'text-rose-500',
    label: 'Fidelizacao' 
  },
};

export function TipsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Embaralhar dicas no carregamento
  const [shuffledTips] = useState(() => {
    return [...tips].sort(() => Math.random() - 0.5);
  });

  // Auto-play a cada 8 segundos
  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % shuffledTips.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, shuffledTips.length]);

  const goToPrevious = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev - 1 + shuffledTips.length) % shuffledTips.length);
  };

  const goToNext = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev + 1) % shuffledTips.length);
  };

  const currentTip = shuffledTips[currentIndex];
  const config = categoryConfig[currentTip.category];
  const Icon = currentTip.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mb-8"
    >
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="size-5 text-amber-500" />
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          Dica do Dia
        </h2>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          ({currentIndex + 1}/{shuffledTips.length})
        </span>
      </div>

      <div 
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6",
          "bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm",
          config.border
        )}
        onMouseEnter={() => setIsAutoPlaying(false)}
        onMouseLeave={() => setIsAutoPlaying(true)}
      >
        {/* Background gradient */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-50",
          config.color
        )} />

        {/* Content */}
        <div className="relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTip.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              {/* Icon */}
              <div className={cn(
                "size-12 rounded-xl flex items-center justify-center shrink-0",
                "bg-white/80 dark:bg-slate-900/80 shadow-sm"
              )}>
                <Icon className={cn("size-6", config.text)} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    "bg-white/80 dark:bg-slate-900/80",
                    config.text
                  )}>
                    {config.label}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
                  {currentTip.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {currentTip.description}
                </p>

                {currentTip.actionLabel && currentTip.actionHref && (
                  <a
                    href={currentTip.actionHref}
                    className={cn(
                      "inline-flex items-center gap-1 mt-3 text-sm font-medium",
                      "hover:underline transition-colors",
                      config.text
                    )}
                  >
                    {currentTip.actionLabel}
                    <ChevronRight className="size-4" />
                  </a>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2">
          <button
            onClick={goToPrevious}
            className="size-8 rounded-lg bg-white/80 dark:bg-slate-900/80 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900 transition-colors shadow-sm"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={goToNext}
            className="size-8 rounded-lg bg-white/80 dark:bg-slate-900/80 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900 transition-colors shadow-sm"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="absolute bottom-4 left-4 flex items-center gap-1">
          {shuffledTips.slice(0, 5).map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setIsAutoPlaying(false);
                setCurrentIndex(idx);
              }}
              className={cn(
                "size-1.5 rounded-full transition-all",
                idx === currentIndex % 5
                  ? "w-4 bg-primary"
                  : "bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500"
              )}
            />
          ))}
          {shuffledTips.length > 5 && (
            <span className="text-xs text-slate-400 ml-1">...</span>
          )}
        </div>

        {/* Auto-play indicator */}
        {isAutoPlaying && (
          <div className="absolute top-4 right-4">
            <motion.div
              className="size-2 rounded-full bg-primary"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
