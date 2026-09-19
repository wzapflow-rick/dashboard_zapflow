'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface SectionHeaderProps {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}

export function SectionHeader({ title, description, actionLabel, actionHref }: SectionHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-balance text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="group inline-flex shrink-0 items-center gap-1 rounded-lg px-1 py-0.5 text-sm font-medium text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {actionLabel}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
