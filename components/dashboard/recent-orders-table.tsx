import React from 'react';
import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

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
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center dark:border-slate-700">
                <h4 className="font-bold text-slate-800 dark:text-white">Últimos Pedidos</h4>
                <button className="text-sm font-semibold text-primary hover:underline">Ver todos</button>
            </div>
            <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left min-w-[700px]">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold dark:bg-slate-700 dark:text-slate-400">
                        <tr>
                            <th className="px-6 py-4">ID Pedido</th>
                            <th className="px-6 py-4">Cliente</th>
                            <th className="px-6 py-4">Data/Hora</th>
                            <th className="px-6 py-4">Valor</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {orders.map((order) => (
                            <tr key={order.id} className="hover:bg-slate-50 transition-colors group dark:hover:bg-slate-700/50">
                                <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{order.id}</td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-slate-900 dark:text-white">{order.customer}</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">{order.phone}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{order.time}</td>
                                <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{order.value}</td>
                                <td className="px-6 py-4">
                                    <span className={cn(
                                        "px-3 py-1 text-xs font-semibold rounded-full",
                                        order.statusColor === 'amber' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                                            order.statusColor === 'emerald' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                                "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                    )}>
                                        {order.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => onOpenModal(order)}
                                        className="text-slate-400 hover:text-primary transition-colors dark:text-slate-500"
                                    >
                                        <Eye className="size-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
