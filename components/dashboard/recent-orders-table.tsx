'use client';

import { Eye, Clock, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

interface Order {
    id: string;
    customer: string;
    phone: string;
    time: string;
    value: string;
    status: string;
    statusColor: string;
}

interface RecentOrdersTableProps {
    orders: Order[];
    onOpenModal: (order: Order) => void;
}

export function RecentOrdersTable({ orders, onOpenModal }: RecentOrdersTableProps) {
    return (
        <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-lg shadow-slate-200/50 dark:shadow-black/20 overflow-hidden"
        >
            {/* Header */}
            <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50 flex justify-between items-center bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 dark:bg-primary/20">
                        <ShoppingBag className="size-4 text-primary" />
                    </div>
                    <div>
                        <h4 className="font-bold text-lg text-slate-800 dark:text-white">Ultimos Pedidos</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="size-3" />
                            Atualizacao em tempo real
                        </p>
                    </div>
                </div>
                <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors px-4 py-2 rounded-lg hover:bg-primary/10"
                >
                    Ver todos
                </motion.button>
            </div>
            
            {/* Table */}
            <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left min-w-[700px]">
                    <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider font-semibold">
                        <tr>
                            <th className="px-6 py-4">ID Pedido</th>
                            <th className="px-6 py-4">Cliente</th>
                            <th className="px-6 py-4">Data/Hora</th>
                            <th className="px-6 py-4">Valor</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Acoes</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {orders.map((order, index) => (
                            <motion.tr 
                                key={order.id} 
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.04 }}
                                whileHover={{ backgroundColor: 'rgba(var(--primary), 0.03)' }}
                                className="group cursor-pointer transition-colors"
                                onClick={() => onOpenModal(order)}
                            >
                                <td className="px-6 py-4">
                                    <span className="text-sm font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">
                                        {order.id}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                                            {order.customer}
                                        </span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">{order.phone}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 font-medium tabular-nums">
                                    {order.time}
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                                        {order.value}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <motion.span 
                                        whileHover={{ scale: 1.05 }}
                                        className={cn(
                                            "px-3 py-1.5 text-xs font-bold rounded-full inline-flex items-center gap-1.5 border backdrop-blur-sm",
                                            order.statusColor === 'amber' && "bg-amber-50/80 text-amber-700 border-amber-200/50 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700/50",
                                            order.statusColor === 'emerald' && "bg-emerald-50/80 text-emerald-700 border-emerald-200/50 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700/50",
                                            order.statusColor === 'red' && "bg-red-50/80 text-red-700 border-red-200/50 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700/50",
                                            order.statusColor === 'blue' && "bg-blue-50/80 text-blue-700 border-blue-200/50 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700/50"
                                        )}
                                    >
                                        {(order.statusColor === 'amber' || order.statusColor === 'blue') && (
                                            <span className="relative flex size-2">
                                                <span className={cn(
                                                    "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                                                    order.statusColor === 'amber' ? "bg-amber-400" : "bg-blue-400"
                                                )} />
                                                <span className={cn(
                                                    "relative inline-flex rounded-full size-2",
                                                    order.statusColor === 'amber' ? "bg-amber-500" : "bg-blue-500"
                                                )} />
                                            </span>
                                        )}
                                        {order.status}
                                    </motion.span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenModal(order);
                                        }}
                                        className="text-slate-400 hover:text-primary hover:bg-primary/10 p-2 rounded-lg transition-all"
                                    >
                                        <Eye className="size-5" />
                                    </motion.button>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
                
                {orders.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                        <ShoppingBag className="size-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Nenhum pedido encontrado</p>
                    </div>
                )}
            </div>
        </motion.section>
    );
}
