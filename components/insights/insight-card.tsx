'use client';

import React from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Star, 
  Clock, 
  Users, 
  Zap, 
  Receipt, 
  BarChart3, 
  XCircle,
  Trophy,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Insight } from '@/app/actions/insights';

const iconMap: { [key: string]: any } = {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Star,
  Clock,
  Users,
  Zap,
  Receipt,
  BarChart3,
  XCircle,
  Trophy,
  Target,
};

const colorConfig: { [key: string]: { bg: string; text: string; glow: string; border: string } } = {
  emerald: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    glow: 'shadow-emerald-500/20',
    border: 'border-emerald-500/20',
  },
  red: {
    bg: 'bg-red-500/10',
    text: 'text-red-500',
    glow: 'shadow-red-500/20',
    border: 'border-red-500/20',
  },
  amber: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-500',
    glow: 'shadow-amber-500/20',
    border: 'border-amber-500/20',
  },
  blue: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    glow: 'shadow-blue-500/20',
    border: 'border-blue-500/20',
  },
  violet: {
    bg: 'bg-violet-500/10',
    text: 'text-violet-500',
    glow: 'shadow-violet-500/20',
    border: 'border-violet-500/20',
  },
  orange: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-500',
    glow: 'shadow-orange-500/20',
    border: 'border-orange-500/20',
  },
};

interface InsightCardProps {
  insight: Insight;
  index: number;
}

export function InsightCard({ insight, index }: InsightCardProps) {
  const IconComponent = iconMap[insight.icon] || TrendingUp;
  const colors = colorConfig[insight.color] || colorConfig.emerald;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.4, 
        delay: index * 0.1,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      whileHover={{ 
        scale: 1.02, 
        y: -4,
        transition: { duration: 0.2 }
      }}
      className={cn(
        "relative p-5 rounded-2xl border backdrop-blur-sm",
        "bg-white/80 dark:bg-slate-800/80",
        "shadow-lg hover:shadow-xl transition-shadow duration-300",
        colors.border,
        colors.glow
      )}
    >
      {/* Glow effect */}
      <div className={cn(
        "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300",
        colors.bg
      )} />

      <div className="relative flex items-start gap-4">
        {/* Icon */}
        <motion.div 
          className={cn(
            "flex-shrink-0 size-12 rounded-xl flex items-center justify-center",
            colors.bg
          )}
          animate={insight.trend === 'up' ? {
            scale: [1, 1.05, 1],
          } : undefined}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <IconComponent className={cn("size-6", colors.text)} />
        </motion.div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {insight.title}
            </span>
            {insight.priority === 1 && (
              <span className="size-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </div>
          
          {/* Value com animacao de contador */}
          <motion.div 
            className={cn("text-2xl font-bold", colors.text)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.1 + 0.3 }}
          >
            {insight.value}
          </motion.div>
          
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
            {insight.description}
          </p>
        </div>

        {/* Trend indicator */}
        {insight.trend && insight.trend !== 'neutral' && (
          <div className={cn(
            "flex-shrink-0 size-8 rounded-full flex items-center justify-center",
            insight.trend === 'up' ? 'bg-emerald-500/10' : 'bg-red-500/10'
          )}>
            {insight.trend === 'up' ? (
              <TrendingUp className="size-4 text-emerald-500" />
            ) : (
              <TrendingDown className="size-4 text-red-500" />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Componente de loading skeleton
export function InsightCardSkeleton({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      className="relative p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80"
    >
      <div className="flex items-start gap-4">
        <div className="size-12 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-7 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
}

// Componente de lista de insights
interface InsightsListProps {
  insights: Insight[];
  isLoading?: boolean;
}

export function InsightsList({ insights, isLoading }: InsightsListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <InsightCardSkeleton key={i} index={i} />
        ))}
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-16 px-4"
      >
        <div className="size-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <BarChart3 className="size-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
          Nenhum insight disponivel
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm">
          Quando voce tiver mais pedidos, insights inteligentes aparecerão aqui automaticamente.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {insights.map((insight, index) => (
        <InsightCard key={insight.id} insight={insight} index={index} />
      ))}
    </div>
  );
}
