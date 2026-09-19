'use client';

import Link from 'next/link';
import type { ElementType } from 'react';
import { ArrowRight } from 'lucide-react';

interface EmptyStateProps {
  icon: ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, actionHref, compact }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200/80 bg-white/40 px-6 text-center dark:border-white/[0.08] dark:bg-white/[0.01] ${
        compact ? 'py-8' : 'py-12'
      }`}
    >
      <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="max-w-xs">
        <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="group mt-1 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-slate-950 transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          {actionLabel}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
