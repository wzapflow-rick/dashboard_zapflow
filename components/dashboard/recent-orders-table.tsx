import { Eye } from 'lucide-react';
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
        <section className="bg-gradient-to-br from-white to-slate-50 rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden dark:from-slate-800 dark:to-slate-700 dark:border-slate-700/50">
            <div className="p-6 border-b border-slate-200/50 flex justify-between items-center dark:border-slate-700/50 bg-gradient-to-r from-transparent to-primary/5">
                <h4 className="font-bold text-lg text-slate-800 dark:text-white">Últimos Pedidos</h4>
                <button className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors hover:underline">Ver todos</button>
            </div>
            <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left min-w-[700px]">
                    <thead className="bg-gradient-to-r from-slate-50 to-slate-100 text-slate-600 text-xs uppercase tracking-wider font-semibold dark:from-slate-700/50 dark:to-slate-700 dark:text-slate-300">
                        <tr>
                            <th className="px-6 py-4">ID Pedido</th>
                            <th className="px-6 py-4">Cliente</th>
                            <th className="px-6 py-4">Data/Hora</th>
                            <th className="px-6 py-4">Valor</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {orders.map((order, index) => (
                            <motion.tr 
                                key={order.id} 
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="hover:bg-primary/5 transition-all group dark:hover:bg-primary/10 cursor-pointer"
                            >
                                <td className="px-6 py-4 text-sm font-bold text-primary dark:text-primary/80">{order.id}</td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{order.customer}</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">{order.phone}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 font-medium">{order.time}</td>
                                <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{order.value}</td>
                                <td className="px-6 py-4">
                                    <motion.span 
                                        whileHover={{ scale: 1.05 }}
                                        className={cn(
                                            "px-3 py-1.5 text-xs font-bold rounded-full inline-block border",
                                            order.statusColor === 'amber' ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50" :
                                                order.statusColor === 'emerald' ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50" :
                                                    order.statusColor === 'red' ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50" :
                                                        "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50"
                                        )}
                                    >
                                        {order.status}
                                    </motion.span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        onClick={() => onOpenModal(order)}
                                        className="text-slate-400 hover:text-primary hover:bg-primary/10 p-2 rounded-lg transition-all dark:text-slate-500 dark:hover:text-primary"
                                    >
                                        <Eye className="size-5" />
                                    </motion.button>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
