'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, Zap, Activity } from 'lucide-react';
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

// Animated counter for financial values
function AnimatedValue({ value }: { value: string }) {
    const [displayValue, setDisplayValue] = useState(value);
    
    useEffect(() => {
        setDisplayValue(value);
    }, [value]);
    
    return (
        <motion.span
            key={value}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
            {displayValue}
        </motion.span>
    );
}

export function StatCard({ stat, index }: StatCardProps) {
    const isPrimary = stat.color === 'primary';
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, type: 'spring', stiffness: 100 }}
            whileHover={{ scale: 1.02, translateY: -4 }}
            className={cn(
                "relative p-6 rounded-2xl border backdrop-blur-xl transition-all duration-300 cursor-pointer group overflow-hidden",
                isPrimary 
                    ? "bg-gradient-to-br from-emerald-500/90 to-emerald-600/90 text-white border-emerald-400/30 shadow-xl shadow-emerald-500/20" 
                    : "bg-white/70 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-700/50 shadow-lg shadow-slate-200/50 dark:shadow-black/20"
            )}
        >
            {/* Subtle gradient overlay */}
            <div className={cn(
                "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                isPrimary 
                    ? "bg-gradient-to-tr from-white/10 to-transparent" 
                    : "bg-gradient-to-tr from-primary/5 to-transparent"
            )} />
            
            {/* Glow effect on hover */}
            <div className={cn(
                "absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm",
                isPrimary 
                    ? "bg-gradient-to-r from-emerald-400/50 to-emerald-500/50" 
                    : "bg-gradient-to-r from-primary/20 to-primary/10"
            )} />
            
            {/* Content */}
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <motion.div 
                        whileHover={{ rotate: [0, -10, 10, 0] }}
                        transition={{ duration: 0.5 }}
                        className={cn(
                            "p-3 rounded-xl transition-all duration-300",
                            isPrimary 
                                ? "bg-white/20 backdrop-blur-sm" 
                                : "bg-slate-100/80 dark:bg-slate-800/80 group-hover:bg-primary/10 dark:group-hover:bg-primary/20"
                        )}
                    >
                        <stat.icon className={cn(
                            "size-5 transition-all duration-300",
                            isPrimary 
                                ? "text-white" 
                                : "text-slate-600 dark:text-slate-300 group-hover:text-primary group-hover:scale-110"
                        )} />
                    </motion.div>
                    
                    {stat.trend === 'up' && (
                        <motion.span 
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: index * 0.1 + 0.3, type: 'spring' }}
                            className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-50/80 dark:bg-emerald-900/40 px-3 py-1.5 rounded-full backdrop-blur-sm border border-emerald-200/50 dark:border-emerald-700/50"
                        >
                            {stat.change} <ArrowUpRight className="size-3 ml-1" />
                        </motion.span>
                    )}
                    
                    {stat.trend === 'special' && (
                        <motion.span 
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/30"
                        >
                            <Activity className="size-3" />
                            {stat.change}
                        </motion.span>
                    )}
                </div>
                
                <p className={cn(
                    "text-sm font-medium transition-colors",
                    isPrimary 
                        ? "text-white/80" 
                        : "text-slate-500 dark:text-slate-400"
                )}>
                    {stat.label}
                </p>
                
                <h3 className={cn(
                    "text-3xl font-bold mt-2 tracking-tight",
                    isPrimary ? "text-white" : "text-slate-900 dark:text-white"
                )}>
                    <AnimatedValue value={stat.value} />
                </h3>
                
                {stat.trend === 'special' && (
                    <motion.p 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="text-xs text-white/70 mt-3 flex items-center gap-1.5"
                    >
                        <motion.span
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                        >
                            <Zap className="size-3 fill-current" />
                        </motion.span>
                        Recuperado automaticamente
                    </motion.p>
                )}
            </div>
        </motion.div>
    );
}
