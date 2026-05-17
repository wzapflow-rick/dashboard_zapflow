'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { TrendingUp, Crown } from 'lucide-react';

interface TopProductsListProps {
    products: {
        name: string;
        sales: number;
        price: string;
        image: string;
    }[];
}

export function TopProductsList({ products }: TopProductsListProps) {
    return (
        <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="relative bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-lg shadow-slate-200/50 dark:shadow-black/20 overflow-hidden"
        >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
            
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-amber-100/80 dark:bg-amber-900/30">
                            <Crown className="size-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h4 className="font-bold text-slate-800 dark:text-white">Top 5 Produtos</h4>
                    </div>
                    <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                        <TrendingUp className="size-3" />
                        Mais vendidos
                    </span>
                </div>
                
                <div className="space-y-3">
                    {products.map((product, index) => (
                        <motion.div 
                            key={product.name} 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.08 + 0.3 }}
                            whileHover={{ x: 4 }}
                            className="flex items-center gap-3 group cursor-pointer p-2 -mx-2 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-all duration-200"
                        >
                            {/* Ranking badge */}
                            <div className={`size-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                index === 0 
                                    ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-lg shadow-amber-500/30' 
                                    : index === 1 
                                        ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' 
                                        : index === 2 
                                            ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-white'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                            }`}>
                                {index + 1}
                            </div>
                            
                            <div className="relative size-11 rounded-xl overflow-hidden shrink-0 ring-2 ring-slate-100 dark:ring-slate-700 group-hover:ring-primary/30 transition-all">
                                <Image 
                                    src={product.image} 
                                    alt={product.name} 
                                    fill 
                                    className="object-cover transition-transform duration-300 group-hover:scale-110" 
                                    referrerPolicy="no-referrer" 
                                />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors">
                                    {product.name}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{product.sales}</span> vendas
                                </p>
                            </div>
                            
                            <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                                {product.price}
                            </span>
                        </motion.div>
                    ))}
                    
                    {products.length === 0 && (
                        <div className="text-center py-8 text-slate-400">
                            <p className="text-sm">Nenhum produto vendido ainda</p>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
