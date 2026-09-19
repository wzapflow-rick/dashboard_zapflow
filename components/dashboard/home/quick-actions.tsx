'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowRight, MessageCircle, Tag, Share2 } from 'lucide-react';
import type { ElementType } from 'react';

interface QuickAction {
  icon: ElementType;
  title: string;
  description: string;
  href: string;
}

const ACTIONS: QuickAction[] = [
  {
    icon: MessageCircle,
    title: 'Recuperar clientes',
    description: 'Clientes inativos há mais de 30 dias.',
    href: '/dashboard/customers',
  },
  {
    icon: Tag,
    title: 'Criar promoção',
    description: 'Monte um combo e aumente seu ticket.',
    href: '/dashboard/campanhas',
  },
  {
    icon: Share2,
    title: 'Divulgar cardápio',
    description: 'Compartilhe e receba novos pedidos.',
    href: '/dashboard/growth',
  },
];

export function QuickActions({ lowPower }: { lowPower?: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {ACTIONS.map((action, index) => {
        const Icon = action.icon;

        return (
          <motion.div
            key={action.title}
            initial={lowPower ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={lowPower ? { duration: 0 } : { delay: index * 0.05 }}
          >
            <Link
              href={action.href}
              className="group flex h-full items-center gap-4 rounded-2xl border border-slate-200/70 bg-white/70 p-4 transition-all hover:border-primary/40 hover:bg-white dark:border-white/[0.07] dark:bg-white/[0.02] dark:hover:border-primary/40 dark:hover:bg-white/[0.04]"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 dark:text-white">{action.title}</p>
                <p className="truncate text-sm text-slate-500 dark:text-slate-400">{action.description}</p>
              </div>
              <ArrowRight
                className="size-4 shrink-0 text-slate-400 transition-all group-hover:translate-x-0.5 group-hover:text-primary dark:text-slate-500"
                aria-hidden="true"
              />
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
