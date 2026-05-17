'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Lightbulb, RefreshCw, Sparkles } from 'lucide-react';
import { InsightsList } from '@/components/insights/insight-card';
import { TipsCarousel } from '@/components/insights/tips-carousel';
import { getInsights, type Insight } from '@/app/actions/insights';

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const loadInsights = async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const data = await getInsights();
      setInsights(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('[Insights] Erro ao carregar:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadInsights();
    
    // Auto-refresh a cada 5 minutos
    const interval = setInterval(() => loadInsights(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Lightbulb className="size-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                  Insights Inteligentes
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  O que esta acontecendo no seu negocio agora
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {lastUpdate && (
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  Atualizado {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <button
                onClick={() => loadInsights(true)}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 shadow-sm"
              >
                <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
          </div>
        </motion.div>

        {/* Tips Carousel */}
        <TipsCarousel />

        {/* Insights Grid */}
        <InsightsList insights={insights} isLoading={isLoading} />

        {/* Footer info */}
        {!isLoading && insights.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-400 dark:text-slate-500"
          >
            <Sparkles className="size-4" />
            <span>Insights gerados automaticamente com base nos seus dados</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
