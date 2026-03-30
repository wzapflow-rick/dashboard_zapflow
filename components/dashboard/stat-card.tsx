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
            className={cn(
                "p-6 rounded-xl border shadow-sm",
                stat.color === 'primary' ? "bg-primary text-white border-primary" : "bg-white border-slate-200"
            )}
        >
            <div className="flex justify-between items-start mb-4">
                <div className={cn(
                    "p-2 rounded-lg",
                    stat.color === 'primary' ? "bg-white/20" : "bg-slate-50"
                )}>
                    <stat.icon className={cn("size-5", stat.color === 'primary' ? "text-white" : "text-slate-600")} />
                </div>
                {stat.trend === 'up' && (
                    <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                        {stat.change} <ArrowUpRight className="size-3 ml-0.5" />
                    </span>
                )}
                {stat.trend === 'special' && (
                    <span className="text-[10px] uppercase font-bold tracking-wider bg-white/20 px-2 py-1 rounded">
                        {stat.change}
                    </span>
                )}
            </div>
            <p className={cn("text-sm font-medium", stat.color === 'primary' ? "text-white/80" : "text-slate-500")}>
                {stat.label}
            </p>
            <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
            {stat.trend === 'special' && (
                <p className="text-xs text-white/70 mt-3 flex items-center gap-1">
                    <Zap className="size-3 fill-current" />
                    Recuperado automaticamente
                </p>
            )}
        </motion.div>
    );
}
