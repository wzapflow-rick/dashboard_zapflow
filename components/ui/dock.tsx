'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { HTMLAttributes, MouseEventHandler, ReactNode } from 'react';

import { cn } from '@/lib/utils';

const MotionLink = motion.create(Link);

interface DockProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Dock({ children, className, ...props }: DockProps) {
  return (
    <div
      className={cn(
        'flex items-end gap-1.5 rounded-[1.75rem] border border-border-dark bg-surface-dark/95 p-2 text-text-secondary shadow-2xl backdrop-blur-xl sm:gap-3 sm:rounded-[3rem] sm:px-4 sm:py-3',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface DockItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  onLinkClick?: MouseEventHandler<HTMLAnchorElement>;
  expanded?: boolean;
  controls?: string;
}

export function DockItem({
  icon: Icon,
  label,
  active = false,
  href,
  onClick,
  onLinkClick,
  expanded,
  controls,
}: DockItemProps) {
  const reduceMotion = useReducedMotion();
  const className = cn(
    'group relative flex min-w-12 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 py-1 text-text-secondary outline-none transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-dark sm:min-w-14 sm:p-0',
    active && 'text-primary',
  );
  const motionProps = reduceMotion
    ? {}
    : {
        whileHover: { y: -4, scale: 1.05 },
        whileTap: { scale: 0.94 },
        transition: { duration: 0.18 },
      };
  const content = (
    <>
      <span
        className={cn(
          'relative grid size-10 place-items-center rounded-xl border border-border-dark bg-surface-elevated shadow-lg transition-colors group-hover:border-primary/40 group-hover:bg-primary/10 sm:size-14 sm:rounded-2xl',
          active && 'border-primary/40 bg-primary/15 shadow-primary/10',
        )}
      >
        <Icon className="size-5 transition-transform duration-200 group-hover:scale-110 sm:size-6" strokeWidth={2.1} />
        {active && <span className="absolute -bottom-1 size-1.5 rounded-full bg-primary" aria-hidden="true" />}
      </span>
      <span className="max-w-14 truncate text-[10px] font-medium leading-4 sm:hidden">{label}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+0.75rem)] hidden rounded-lg border border-border-dark bg-surface-dark px-2 py-1 text-xs font-medium whitespace-nowrap text-text-primary opacity-0 shadow-lg transition-all group-hover:-translate-y-1 group-hover:opacity-100 group-focus-visible:-translate-y-1 group-focus-visible:opacity-100 sm:block"
      >
        {label}
      </span>
    </>
  );

  if (href) {
    return (
      <MotionLink
        href={href}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className={className}
        onClick={onLinkClick}
        {...motionProps}
      >
        {content}
      </MotionLink>
    );
  }

  return (
    <motion.button
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={controls}
      className={className}
      onClick={onClick}
      {...motionProps}
    >
      {content}
    </motion.button>
  );
}
