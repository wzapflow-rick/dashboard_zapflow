'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from 'motion/react';
import { useState, type HTMLAttributes, type MouseEventHandler, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

const MotionLink = motion.create(Link);

const burstParticles = [
  { x: -22, y: -18, delay: 0 },
  { x: 0, y: -26, delay: 0.015 },
  { x: 22, y: -17, delay: 0.03 },
  { x: 25, y: 10, delay: 0.045 },
  { x: 0, y: 25, delay: 0.06 },
  { x: -24, y: 11, delay: 0.075 },
] as const;

interface DockProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  pulseKey?: number;
}

export function Dock({ children, className, pulseKey = 0, ...props }: DockProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        'relative flex items-end gap-1.5 rounded-[1.75rem] border border-border-dark bg-surface-dark/95 p-2 text-text-secondary shadow-2xl backdrop-blur-xl sm:gap-3 sm:rounded-[3rem] sm:px-4 sm:py-3',
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden="true">
        {pulseKey > 0 && !reduceMotion && (
          <>
            <motion.span
              key={`dock-sweep-${pulseKey}`}
              className="absolute inset-y-0 left-0 w-20 -skew-x-12 bg-primary/20 blur-xl"
              initial={{ x: '-160%', opacity: 0 }}
              animate={{ x: ['-160%', '560%'], opacity: [0, 0.8, 0] }}
              transition={{ duration: 0.68, ease: 'easeOut', times: [0, 0.35, 1] }}
            />
            <motion.span
              key={`dock-ring-${pulseKey}`}
              className="absolute inset-0 rounded-[inherit] border border-primary/60"
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: [0, 0.7, 0], scale: [0.985, 1.01, 1.018] }}
              transition={{ duration: 0.52, ease: 'easeOut' }}
            />
          </>
        )}
      </span>
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
  onActivate?: () => void;
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
  onActivate,
  expanded,
  controls,
}: DockItemProps) {
  const reduceMotion = useReducedMotion();
  const iconControls = useAnimationControls();
  const [burstKey, setBurstKey] = useState(0);
  const highlighted = active || expanded;
  const DisplayIcon = expanded && ExpandedIcon ? ExpandedIcon : Icon;
  const iconKey = expanded && ExpandedIcon ? 'expanded' : 'default';
  const className = cn(
    'group relative flex min-w-12 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 py-1 text-text-secondary outline-none transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-dark sm:min-w-14 sm:p-0',
    highlighted && 'text-primary',
  );
  const interactionTransition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 480, damping: 18, mass: 0.65 };
  const activeTransition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 430, damping: 28, mass: 0.75 };

  const triggerActivation = () => {
    onActivate?.();
    if (reduceMotion) return;

    setBurstKey((key) => key + 1);
    iconControls.stop();
    iconControls.set({ y: 0, rotate: 0, scale: 1 });
    void (async () => {
      await iconControls.start(
        { y: -8, rotate: -9, scale: 0.86 },
        { duration: 0.1, ease: 'easeOut' },
      );
      await iconControls.start(
        { y: 0, rotate: 0, scale: 1 },
        { type: 'spring', stiffness: 520, damping: 13, mass: 0.65 },
      );
    })();
  };

  const handleLinkClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
    triggerActivation();
    onLinkClick?.(event);
  };

  const handleButtonClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    triggerActivation();
    onClick?.(event);
  };

  const content = (
    <>
      <span
        className={cn(
          'relative grid size-10 place-items-center rounded-xl border border-border-dark bg-surface-elevated shadow-lg transition-colors group-hover:border-primary/40 group-hover:bg-primary/10 sm:size-14 sm:rounded-2xl',
          highlighted && 'border-primary/40',
          expanded && !active && 'bg-primary/15',
        )}
      >
        {active && (
          <motion.span
            layoutId="dashboard-dock-active-surface"
            className="absolute inset-0 rounded-[inherit] border border-primary/40 bg-primary/15 shadow-lg shadow-primary/10"
            transition={activeTransition}
            aria-hidden="true"
          />
        )}

        {burstKey > 0 && !reduceMotion && (
          <span key={burstKey} className="pointer-events-none absolute inset-0" aria-hidden="true">
            <motion.span
              className="absolute inset-0 rounded-[inherit] border border-primary/70"
              initial={{ opacity: 0.9, scale: 0.72 }}
              animate={{ opacity: 0, scale: 1.52 }}
              transition={{ duration: 0.46, ease: 'easeOut' }}
            />
            {burstParticles.map((particle, index) => (
              <motion.span
                key={`${burstKey}-${particle.x}-${particle.y}`}
                className={cn(
                  'absolute top-1/2 left-1/2 size-1 rounded-full bg-primary shadow-sm shadow-primary/50',
                  index % 2 === 0 && 'bg-primary/70',
                )}
                initial={{ x: -2, y: -2, opacity: 0, scale: 0.4 }}
                animate={{
                  x: particle.x,
                  y: particle.y,
                  opacity: [0, 1, 0],
                  scale: [0.4, 1, 0.15],
                }}
                transition={{ duration: 0.5, delay: particle.delay, ease: 'easeOut' }}
              />
            ))}
          </span>
        )}

        <motion.span animate={iconControls} className="relative grid place-items-center">
          <AnimatePresence initial={false} mode="wait">
            <motion.span
              key={iconKey}
              className="grid place-items-center"
              initial={reduceMotion ? false : { opacity: 0, rotate: -75, scale: 0.55 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: 75, scale: 0.55 }}
              transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
            >
              <DisplayIcon className="size-5 sm:size-6" strokeWidth={2.1} />
            </motion.span>
          </AnimatePresence>
        </motion.span>

        {active && (
          <motion.span
            layoutId="dashboard-dock-active-dot"
            className="absolute -bottom-1 size-1.5 rounded-full bg-primary"
            transition={activeTransition}
            aria-hidden="true"
          />
        )}
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
        onClick={handleLinkClick}
        whileHover={reduceMotion ? undefined : { y: -5, scale: 1.06 }}
        whileTap={reduceMotion ? undefined : { y: 2, scale: 0.86 }}
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
      onClick={handleButtonClick}
      whileHover={reduceMotion ? undefined : { y: -5, scale: 1.06 }}
      whileTap={reduceMotion ? undefined : { y: 2, scale: 0.86 }}
      transition={interactionTransition}
    >
      {content}
    </motion.button>
  );
}
