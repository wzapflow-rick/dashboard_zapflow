'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
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

interface DashboardDockProps {
  user?: DashboardNavigationUser | null;
}

const preferredDockRoutes = [
  '/dashboard',
  '/dashboard/menu',
  '/dashboard/expedition',
  '/dashboard/mesas',
];

export function DashboardDock({ user }: DashboardDockProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
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
            initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            className="pointer-events-auto absolute bottom-[calc(100%+0.75rem)] w-[calc(100vw-2rem)] max-w-2xl overflow-hidden rounded-3xl border border-border-dark bg-surface-dark/95 text-text-primary shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between gap-4 border-b border-border-dark px-5 py-4">
              <div className="min-w-0">
                <h2 className="font-semibold text-text-primary">Navegação</h2>
                <p className="text-sm leading-5 text-text-secondary">Todos os atalhos disponíveis para sua conta.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                aria-label="Fechar navegação"
                className="grid size-10 shrink-0 place-items-center rounded-xl text-text-secondary outline-none transition-colors hover:bg-surface-elevated hover:text-text-primary focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="custom-scrollbar grid max-h-[min(60vh,32rem)] gap-5 overflow-y-auto p-4 sm:grid-cols-2 sm:p-5">
              <NavigationGroup title="Operação" items={moreMainItems} pathname={pathname} onNavigate={() => setIsMoreOpen(false)} />
              <NavigationGroup title="Gestão" items={moreManagementItems} pathname={pathname} onNavigate={() => setIsMoreOpen(false)} />
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <nav aria-label="Navegação principal do painel" className="pointer-events-auto">
        <Dock>
          {primaryItems.map((item) => (
            <DockItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.name}
              active={isDashboardRouteActive(pathname, item.href)}
            />
          ))}
          {moreItems.length > 0 && (
            <div ref={moreButtonRef}>
              <DockItem
                icon={Menu}
                label="Mais"
                active={isMoreOpen || isMoreActive}
                expanded={isMoreOpen}
                controls={panelId}
                onClick={() => setIsMoreOpen((open) => !open)}
              />
            </div>
          )}
        </Dock>
      </nav>
    </div>
  );
}

function NavigationGroup({
  title,
  items,
  pathname,
  onNavigate,
}: {
  title: string;
  items: DashboardNavigationItem[];
  pathname: string;
  onNavigate: () => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="px-2 text-xs font-semibold tracking-wider text-text-secondary uppercase">{title}</h3>
      <div className="flex flex-col gap-1">
        {items.map((item) => {
          const active = isDashboardRouteActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-text-secondary outline-none transition-colors hover:bg-surface-elevated hover:text-text-primary focus-visible:ring-2 focus-visible:ring-primary',
                active && 'bg-primary/15 text-primary',
              )}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-elevated">
                <item.icon className="size-[18px]" />
              </span>
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
