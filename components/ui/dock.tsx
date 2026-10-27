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
        'relative flex items-center gap-1 rounded-[1.75rem] border border-border-dark bg-surface-dark/95 p-1.5 text-text-secondary shadow-2xl backdrop-blur-xl sm:gap-3 sm:rounded-[3rem] sm:px-4 sm:py-3',
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
  expandedIcon?: LucideIcon;
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
  expandedIcon: ExpandedIcon,
  label,
  active = false,
  href,
  onClick,
  onLinkClick,
  expanded,
  controls,
}: DockItemProps) {
  const reduceMotion = useReducedMotion();
  const highlighted = active || expanded;
  const DisplayIcon = expanded && ExpandedIcon ? ExpandedIcon : Icon;
  const className = cn(
    'group relative flex h-14 min-w-14 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 text-zinc-500 outline-none transition-colors hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-primary sm:h-auto sm:min-w-14 sm:p-0',
    highlighted && 'bg-emerald-500/10 text-emerald-500 hover:text-emerald-400 sm:bg-transparent',
  );
  const interactionTransition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 480, damping: 18, mass: 0.65 };

  const content = (
    <>
      <span
        className={cn(
          'relative grid place-items-center transition-colors sm:size-14 sm:rounded-2xl sm:border sm:border-border-dark sm:bg-surface-elevated sm:group-hover:border-emerald-500/40 sm:group-hover:bg-emerald-500/10',
          highlighted && 'sm:border-emerald-500/40 sm:bg-emerald-500/10',
        )}
      >
        <DisplayIcon className="size-5 sm:size-6" strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="max-w-16 truncate text-[10px] font-medium leading-none sm:hidden">{label}</span>
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
        whileHover={reduceMotion ? undefined : { y: -5, scale: 1.06 }}
        transition={interactionTransition}
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
      whileHover={reduceMotion ? undefined : { y: -5, scale: 1.06 }}
      transition={interactionTransition}
    >
      {content}
    </motion.button>
  );
}
