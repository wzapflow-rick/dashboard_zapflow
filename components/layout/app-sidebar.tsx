'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type DashboardNavigationItem,
  type DashboardNavigationUser,
  getDashboardNavigation,
  isDashboardRouteActive,
} from '@/lib/dashboard-navigation';

interface AppSidebarProps {
  user?: DashboardNavigationUser | null;
  collapsed: boolean;
  onToggle: () => void;
}

function NavGroup({
  label,
  items,
  pathname,
  collapsed,
}: {
  label: string;
  items: DashboardNavigationItem[];
  pathname: string;
  collapsed: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <p
        className={cn(
          'px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500',
          collapsed && 'sr-only',
        )}
      >
        {label}
      </p>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = isDashboardRouteActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                title={collapsed ? item.name : undefined}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  collapsed && 'justify-center px-0',
                  active
                    ? 'bg-zinc-900 text-white dark:bg-white/[0.06]'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.04] dark:hover:text-zinc-100',
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary"
                  />
                )}
                <item.icon
                  aria-hidden="true"
                  className={cn(
                    'size-4 shrink-0 transition-colors',
                    active ? 'text-primary' : 'text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-200',
                  )}
                />
                <span className={cn('truncate', collapsed && 'sr-only')}>{item.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AppSidebar({ user, collapsed, onToggle }: AppSidebarProps) {
  const pathname = usePathname();
  const { main, management } = getDashboardNavigation(user);

  return (
    <aside
      aria-label="Navegação principal"
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-zinc-200 bg-white transition-[width] duration-200 ease-out lg:flex dark:border-zinc-800/60 dark:bg-[#09090b]',
        collapsed ? 'w-[68px]' : 'w-60',
      )}
    >
      <div className={cn('flex h-16 items-center gap-2.5 border-b border-zinc-200 px-4 dark:border-zinc-800/60', collapsed && 'justify-center px-0')}>
        <Link
          href="/dashboard"
          aria-label="ZapFlash, ir para a visão geral"
          className="flex min-w-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <span className="relative size-8 shrink-0 overflow-hidden rounded-lg ring-1 ring-zinc-200 dark:ring-zinc-800">
            <Image src="/logo-zapflow.png" alt="" fill sizes="32px" className="scale-125 object-cover" />
          </span>
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-white">
              ZapFlash
            </span>
          )}
        </Link>
      </div>

      <nav className="custom-scrollbar flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
        <NavGroup label="Operação" items={main} pathname={pathname} collapsed={collapsed} />
        <NavGroup label="Gestão" items={management} pathname={pathname} collapsed={collapsed} />
      </nav>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800/60">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          aria-expanded={!collapsed}
          className={cn(
            'flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-zinc-500 transition-colors outline-none hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-primary/50 dark:hover:bg-white/[0.04] dark:hover:text-zinc-100',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" aria-hidden="true" />
          ) : (
            <>
              <PanelLeftClose className="size-4" aria-hidden="true" />
              <span>Recolher</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
