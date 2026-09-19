'use client';

import { ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionHeader } from './section-header';
import { EmptyState } from './empty-state';

interface Order {
  id: string;
  customer: string;
  phone: string;
  time: string;
  value: string;
  status: string;
  statusColor: string;
  raw?: any;
}

const STATUS_STYLES: Record<string, string> = {
  amber: 'bg-amber-50/80 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  emerald: 'bg-emerald-50/80 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  red: 'bg-red-50/80 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  blue: 'bg-blue-50/80 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
};

function StatusPill({ status, statusColor }: { status: string; statusColor: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        STATUS_STYLES[statusColor] ?? STATUS_STYLES.emerald,
      )}
    >
      {(statusColor === 'amber' || statusColor === 'blue') && (
        <span className="relative flex size-1.5" aria-hidden="true">
          <span
            className={cn(
              'absolute inline-flex size-full animate-ping rounded-full opacity-75',
              statusColor === 'amber' ? 'bg-amber-400' : 'bg-blue-400',
            )}
          />
          <span
            className={cn(
              'relative inline-flex size-1.5 rounded-full',
              statusColor === 'amber' ? 'bg-amber-500' : 'bg-blue-500',
            )}
          />
        </span>
      )}
      {status}
    </span>
  );
}

export function RecentOrders({ orders, onOpenModal }: { orders: Order[]; onOpenModal: (order: Order) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Últimos pedidos"
        description="Os pedidos mais recentes da sua loja."
        actionLabel="Ver todos"
        actionHref="/dashboard/expedition"
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Nenhum pedido ainda"
          description="Seus pedidos aparecerão aqui assim que os clientes começarem a comprar."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/70 dark:border-white/[0.07] dark:bg-white/[0.02]">
          {/* Desktop */}
          <table className="hidden w-full text-left sm:table">
            <thead className="border-b border-slate-200/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-white/[0.07] dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-semibold">Pedido</th>
                <th className="px-5 py-3 font-semibold">Cliente</th>
                <th className="px-5 py-3 font-semibold">Horário</th>
                <th className="px-5 py-3 font-semibold">Valor</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
              {orders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => onOpenModal(order)}
                  className="cursor-pointer transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.03]"
                >
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-bold text-primary">{order.id}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{order.customer}</p>
                    {order.phone && <p className="text-xs text-slate-500 dark:text-slate-400">{order.phone}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-sm tabular-nums text-slate-600 dark:text-slate-300">{order.time}</td>
                  <td className="px-5 py-3.5 text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                    {order.value}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusPill status={order.status} statusColor={order.statusColor} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile */}
          <ul className="divide-y divide-slate-100 dark:divide-white/[0.05] sm:hidden">
            {orders.map((order) => (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => onOpenModal(order)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-slate-50 dark:active:bg-white/[0.03]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary">{order.id}</span>
                      <span className="truncate text-sm font-medium text-slate-900 dark:text-white">
                        {order.customer}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{order.time}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                      {order.value}
                    </span>
                    <StatusPill status={order.status} statusColor={order.statusColor} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
