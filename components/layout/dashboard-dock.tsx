'use client';

import { AnimatePresence, LayoutGroup, motion, useReducedMotion, type Variants } from 'motion/react';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

import { Dock, DockItem } from '@/components/ui/dock';
import {
  type DashboardNavigationItem,
  type DashboardNavigationUser,
  getDashboardNavigation,
  isDashboardRouteActive,
} from '@/lib/dashboard-navigation';
import { cn } from '@/lib/utils';

const MotionLink = motion.create(Link);

interface DashboardDockProps {
  user?: DashboardNavigationUser | null;
}

const preferredDockRoutes = [
  '/dashboard',
  '/dashboard/menu',
  '/dashboard/expedition',
  '/dashboard/mesas',
];

const panelContentVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.07,
      staggerChildren: 0.07,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.025,
      staggerDirection: -1,
    },
  },
};

const navigationGroupVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 390,
      damping: 27,
      staggerChildren: 0.04,
      delayChildren: 0.025,
    },
  },
  exit: { opacity: 0, y: 6, transition: { duration: 0.1 } },
};

const navigationItemVariants: Variants = {
  hidden: { opacity: 0, x: -10, scale: 0.98 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 430, damping: 27 },
  },
  hover: { x: 3 },
  tap: { x: 5, scale: 0.975 },
};

const navigationGlowVariants: Variants = {
  hidden: { opacity: 0, x: -28 },
  visible: { opacity: 0, x: -28 },
  hover: { opacity: 0.42, x: 0 },
  tap: { opacity: 0.72, x: 52 },
};

export function DashboardDock({ user }: DashboardDockProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const { main, management } = getDashboardNavigation(user);
  const allItems = [...main, ...management];
  const prioritizedItems = preferredDockRoutes
    .map((href) => allItems.find((item) => item.href === href))
    .filter((item): item is DashboardNavigationItem => Boolean(item));
  const primaryItems = [
    ...prioritizedItems,
    ...allItems.filter((item) => !prioritizedItems.some((primary) => primary.href === item.href)),
  ].slice(0, 4);
  const primaryRoutes = new Set(primaryItems.map((item) => item.href));
  const moreMainItems = main.filter((item) => !primaryRoutes.has(item.href));
  const moreManagementItems = management.filter((item) => !primaryRoutes.has(item.href));
  const moreItems = [...moreMainItems, ...moreManagementItems];
  const isMoreActive = moreItems.some((item) => isDashboardRouteActive(pathname, item.href));

  const triggerDockPulse = () => {
    if (!reduceMotion) setPulseKey((key) => key + 1);
  };

  useEffect(() => {
    if (!isMoreOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsMoreOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMoreOpen(false);
        moreButtonRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMoreOpen]);

  if (user?.role === 'cozinheiro' || allItems.length === 0) return null;

  const panelTransition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 370, damping: 28, mass: 0.72 };

  return (
    <div
      ref={rootRef}
      className="dashboard-dock-safe pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center px-3"
    >
      <AnimatePresence>
        {isMoreOpen && moreItems.length > 0 && (
          <motion.section
            id={panelId}
            aria-label="Todos os atalhos do painel"
            initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.96 }}
            transition={panelTransition}
            style={{ transformOrigin: 'bottom center' }}
            className="pointer-events-auto absolute bottom-[calc(100%+0.75rem)] w-[calc(100vw-2rem)] max-w-2xl overflow-hidden rounded-3xl border border-border-dark bg-surface-dark/95 text-text-primary shadow-2xl backdrop-blur-xl"
          >
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.18, delay: reduceMotion ? 0 : 0.04 }}
              className="flex items-center justify-between gap-4 border-b border-border-dark px-5 py-4"
            >
              <div className="min-w-0">
                <h2 className="font-semibold text-text-primary">Navegação</h2>
                <p className="text-sm leading-5 text-text-secondary">Todos os atalhos disponíveis para sua conta.</p>
              </div>
              <motion.button
                type="button"
                onClick={() => {
                  setIsMoreOpen(false);
                  moreButtonRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
                }}
                aria-label="Fechar navegação"
                className="grid size-10 shrink-0 place-items-center rounded-xl text-text-secondary outline-none transition-colors hover:bg-surface-elevated hover:text-text-primary focus-visible:ring-2 focus-visible:ring-primary"
                whileHover={reduceMotion ? undefined : { rotate: 4, scale: 1.04 }}
                whileTap={reduceMotion ? undefined : { rotate: -9, scale: 0.86 }}
                transition={{ type: 'spring', stiffness: 480, damping: 18 }}
              >
                <X className="size-5" />
              </motion.button>
            </motion.div>
            <motion.div
              variants={reduceMotion ? undefined : panelContentVariants}
              initial={reduceMotion ? false : 'hidden'}
              animate="visible"
              exit="exit"
              className="custom-scrollbar grid max-h-[min(60vh,32rem)] gap-5 overflow-y-auto p-4 sm:grid-cols-2 sm:p-5"
            >
              <NavigationGroup
                title="Operação"
                items={moreMainItems}
                pathname={pathname}
                reduceMotion={Boolean(reduceMotion)}
                onActivate={triggerDockPulse}
                onNavigate={() => setIsMoreOpen(false)}
              />
              <NavigationGroup
                title="Gestão"
                items={moreManagementItems}
                pathname={pathname}
                reduceMotion={Boolean(reduceMotion)}
                onActivate={triggerDockPulse}
                onNavigate={() => setIsMoreOpen(false)}
              />
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>

      <nav aria-label="Navegação principal do painel" className="pointer-events-auto">
        <LayoutGroup id="dashboard-dock-navigation">
          <Dock pulseKey={pulseKey}>
            {primaryItems.map((item) => (
              <DockItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.name}
                active={isDashboardRouteActive(pathname, item.href)}
                onActivate={triggerDockPulse}
                onLinkClick={() => setIsMoreOpen(false)}
              />
            ))}
            {moreItems.length > 0 && (
              <div ref={moreButtonRef}>
                <DockItem
                  icon={Menu}
                  expandedIcon={X}
                  label="Mais"
                  active={isMoreActive}
                  expanded={isMoreOpen}
                  controls={panelId}
                  onActivate={triggerDockPulse}
                  onClick={() => setIsMoreOpen((open) => !open)}
                />
              </div>
            )}
          </Dock>
        </LayoutGroup>
      </nav>
    </div>
  );
}

function NavigationGroup({
  title,
  items,
  pathname,
  reduceMotion,
  onActivate,
  onNavigate,
}: {
  title: string;
  items: DashboardNavigationItem[];
  pathname: string;
  reduceMotion: boolean;
  onActivate: () => void;
  onNavigate: () => void;
}) {
  if (items.length === 0) return null;

  return (
    <motion.div variants={reduceMotion ? undefined : navigationGroupVariants} className="flex flex-col gap-2">
      <h3 className="px-2 text-xs font-semibold tracking-wider text-text-secondary uppercase">{title}</h3>
      <div className="flex flex-col gap-1">
        {items.map((item) => {
          const active = isDashboardRouteActive(pathname, item.href);
          return (
            <MotionLink
              key={item.href}
              href={item.href}
              onClick={() => {
                onActivate();
                onNavigate();
              }}
              aria-current={active ? 'page' : undefined}
              variants={reduceMotion ? undefined : navigationItemVariants}
              whileHover={reduceMotion ? undefined : 'hover'}
              whileTap={reduceMotion ? undefined : 'tap'}
              className={cn(
                'group relative flex items-center gap-3 overflow-hidden rounded-2xl px-3 py-2.5 text-sm font-medium text-text-secondary outline-none transition-colors hover:bg-surface-elevated hover:text-text-primary focus-visible:ring-2 focus-visible:ring-primary',
                active && 'bg-primary/15 text-primary',
              )}
            >
              <motion.span
                variants={reduceMotion ? undefined : navigationGlowVariants}
                className="pointer-events-none absolute inset-y-1 left-1 w-20 rounded-xl bg-primary/20 blur-lg"
                aria-hidden="true"
              />
              <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-surface-elevated transition-colors group-hover:bg-primary/10">
                <item.icon className="size-[18px]" />
              </span>
              <span className="relative truncate">{item.name}</span>
            </MotionLink>
          );
        })}
      </div>
    </motion.div>
  );
}
