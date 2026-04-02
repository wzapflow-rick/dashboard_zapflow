import React from 'react';
import { cn } from '@/lib/utils';
import { OrderCard } from './order-card';

interface KanbanColumnProps {
    col: { id: string; title: string; color: string };
    columnOrders: any[];
    onOpenPrintModal: (order: any) => void;
    onMoveOrder: (orderId: number, currentStatus: string) => void;
    onRegisterCustomer: (order: any) => void;
    onOpenDetails: (order: any) => void;
}

export function KanbanColumn({ col, columnOrders, onOpenPrintModal, onMoveOrder, onRegisterCustomer, onOpenDetails }: KanbanColumnProps) {
    return (
        <div className="min-w-[320px] flex flex-col h-full bg-slate-100/50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className={cn(
                "p-4 flex items-center justify-between border-b rounded-t-xl",
                col.color === 'red' ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30" :
                    col.color === 'amber' ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30" :
                        col.color === 'blue' ? "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30" :
                            col.color === 'orange' ? "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/30" :
                                "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30"
            )}>
                <div className="flex items-center gap-2">
                    <span className={cn("size-2.5 rounded-full",
                        col.color === 'red' ? "bg-red-500" :
                            col.color === 'amber' ? "bg-amber-500" :
                                col.color === 'blue' ? "bg-blue-500" :
                                    col.color === 'orange' ? "bg-orange-500" :
                                        "bg-green-500"
                    )}></span>
                    <h3 className={cn("font-bold text-sm uppercase tracking-wide",
                        col.color === 'red' ? "text-red-900 dark:text-red-200" :
                            col.color === 'amber' ? "text-amber-900 dark:text-amber-200" :
                                col.color === 'blue' ? "text-blue-900 dark:text-blue-200" :
                                    col.color === 'orange' ? "text-orange-900 dark:text-orange-200" :
                                        "text-green-900 dark:text-green-200"
                    )}>{col.title}</h3>
                </div>
                <span className={cn("text-xs font-bold px-2 py-0.5 rounded",
                    col.color === 'red' ? "bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200" :
                        col.color === 'amber' ? "bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200" :
                            col.color === 'blue' ? "bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200" :
                                col.color === 'orange' ? "bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200" :
                                    "bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200"
                )}>
                    {columnOrders.length}
                </span>
            </div>

            <div className="p-3 space-y-4 overflow-y-auto custom-scrollbar">
                {columnOrders.map((order) => (
                    <OrderCard
                        key={order.id}
                        order={order}
                        columnId={col.id}
                        onOpenPrintModal={onOpenPrintModal}
                        onMoveOrder={onMoveOrder as any}
                        onRegisterCustomer={onRegisterCustomer}
                        onOpenDetails={onOpenDetails}
                    />
                ))}
            </div>
        </div>
    );
}
