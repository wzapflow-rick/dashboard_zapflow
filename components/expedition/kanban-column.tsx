import React from 'react';
import { cn } from '@/lib/utils';
import { OrderCard } from './order-card';

interface KanbanColumnProps {
    col: { id: string; title: string; color: string };
    columnOrders: any[];
    onOpenPrintModal: (order: any) => void;
    onMoveOrder: (orderId: number, currentStatus: string) => void;
    onRegisterCustomer: (order: any) => void;
}

export function KanbanColumn({ col, columnOrders, onOpenPrintModal, onMoveOrder, onRegisterCustomer }: KanbanColumnProps) {
    return (
        <div className="min-w-[320px] flex flex-col h-full bg-slate-100/50 rounded-xl border border-slate-200">
            <div className={cn(
                "p-4 flex items-center justify-between border-b rounded-t-xl",
                col.color === 'red' ? "border-red-200 bg-red-50" :
                    col.color === 'amber' ? "border-amber-200 bg-amber-50" :
                        col.color === 'blue' ? "border-blue-200 bg-blue-50" :
                            "border-green-200 bg-green-50"
            )}>
                <div className="flex items-center gap-2">
                    <span className={cn("size-2.5 rounded-full",
                        col.color === 'red' ? "bg-red-500" :
                            col.color === 'amber' ? "bg-amber-500" :
                                col.color === 'blue' ? "bg-blue-500" :
                                    "bg-green-500"
                    )}></span>
                    <h3 className={cn("font-bold text-sm uppercase tracking-wide",
                        col.color === 'red' ? "text-red-900" :
                            col.color === 'amber' ? "text-amber-900" :
                                col.color === 'blue' ? "text-blue-900" :
                                    "text-green-900"
                    )}>{col.title}</h3>
                </div>
                <span className={cn("text-xs font-bold px-2 py-0.5 rounded",
                    col.color === 'red' ? "bg-red-200 text-red-800" :
                        col.color === 'amber' ? "bg-amber-200 text-amber-800" :
                            col.color === 'blue' ? "bg-blue-200 text-blue-800" :
                                "bg-green-200 text-green-800"
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
                    />
                ))}
            </div>
        </div>
    );
}
