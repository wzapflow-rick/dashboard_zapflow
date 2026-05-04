import React from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
    stat: {
        label: string;
        value: string;
        change: string;
        trend: string;
        icon: React.ElementType;
        color: string;
    };
    index: number;
}

export function StatCard({ stat, index }: StatCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02, translateY: -4 }}
            className={cn(
                "p-6 rounded-2xl border backdrop-blur-sm transition-all cursor-pointer group",
                stat.color === 'primary' 
                    ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white border-orange-500/50 shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/30" 
                    : "bg-gradient-to-br from-white to-slate-50 border-slate-200/50 dark:from-[#0f1f35] dark:to-[#0a1628] dark:border-[#1e3a5f]/50 shadow-sm hover:shadow-lg dark:shadow-lg/10"
            )}
        >
            <div className="flex justify-between items-start mb-4">
                <div className={cn(
                    "p-3 rounded-xl transition-all group-hover:scale-110",
                    stat.color === 'primary' 
                        ? "bg-white/20 backdrop-blur-sm" 
                        : "bg-slate-100 dark:bg-[#162438] group-hover:bg-primary/10"
                )}>
                    <stat.icon className={cn(
                        "size-5 transition-colors",
                        stat.color === 'primary' 
                            ? "text-white" 
                            : "text-slate-600 dark:text-slate-300 group-hover:text-primary"
                    )} />
                </div>
                {stat.trend === 'up' && (
                    <motion.span 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50"
                    >
                        {stat.change} <ArrowUpRight className="size-3 ml-1" />
                    </motion.span>
                )}
                {stat.trend === 'special' && (
                    <span className="text-[10px] uppercase font-bold tracking-wider bg-white/20 px-3 py-1.5 rounded-full border border-white/30">
                        {stat.change}
                    </span>
                )}
            </div>
            <p className={cn(
                "text-sm font-medium transition-colors",
                stat.color === 'primary' 
                    ? "text-white/80" 
                    : "text-slate-500 dark:text-slate-400"
            )}>
                {stat.label}
            </p>
            <h3 className="text-3xl font-bold mt-2 dark:text-white">{stat.value}</h3>
            {stat.trend === 'special' && (
                <p className="text-xs text-white/70 mt-3 flex items-center gap-1">
                    <Zap className="size-3 fill-current" />
                    Recuperado automaticamente
                </p>
            )}
        </motion.div>
    );
}
