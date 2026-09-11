import type { LucideIcon } from 'lucide-react';
import {
  CreditCard,
  DollarSign,
  Home,
  LayoutDashboard,
  LayoutGrid,
  Megaphone,
  Menu,
  PackageOpen,
  Settings,
  Star,
  Truck,
  Users,
  UtensilsCrossed,
} from 'lucide-react';

export interface DashboardNavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
}

export interface DashboardNavigationUser {
  role?: string | null;
  controle_estoque?: boolean | null;
}

export const dashboardNavigationItems: DashboardNavigationItem[] = [
  { name: 'Visão Geral', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'gerente'] },
  { name: 'Cardápio', href: '/dashboard/menu', icon: UtensilsCrossed, roles: ['admin'] },
  { name: 'Expedição', href: '/dashboard/expedition', icon: Truck, roles: ['admin', 'gerente', 'atendente', 'cozinheiro'] },
  { name: 'Mesas', href: '/dashboard/mesas', icon: LayoutGrid, roles: ['admin', 'gerente', 'atendente'] },
  { name: 'Clientes', href: '/dashboard/customers', icon: Users, roles: ['admin', 'gerente', 'atendente'] },
  { name: 'Marketing', href: '/dashboard/marketing?tab=divulgacao', icon: Megaphone, roles: ['admin'] },
  { name: 'Insumos', href: '/dashboard/insumos', icon: PackageOpen, roles: ['admin'] },
];

export const dashboardManagementItems: DashboardNavigationItem[] = [
  { name: 'Avaliações', href: '/dashboard/ratings', icon: Star, roles: ['admin', 'gerente'] },
  { name: 'Usuários', href: '/dashboard/users', icon: Users, roles: ['admin'] },
  { name: 'Acertos', href: '/dashboard/acertos', icon: DollarSign, roles: ['admin', 'gerente'] },
  { name: 'Relatórios', href: '/dashboard/reports', icon: DollarSign, roles: ['admin', 'gerente'] },
  { name: 'Configurações', href: '/dashboard/settings', icon: Settings, roles: ['admin'] },
  { name: 'Assinatura', href: '/dashboard/subscription', icon: CreditCard, roles: ['admin'] },
];

export const dashboardMobileNavigationItems = [
  { name: 'Início', href: '/dashboard', icon: Home },
  { name: 'Cardápio', href: '/dashboard/menu', icon: UtensilsCrossed },
  { name: 'Expedição', href: '/dashboard/expedition', icon: Truck },
  { name: 'Mesas', href: '/dashboard/mesas', icon: LayoutGrid },
  { name: 'Mais', href: '#menu', icon: Menu },
];

function canAccessItem(item: DashboardNavigationItem, user?: DashboardNavigationUser | null) {
  if (item.name === 'Insumos' && !user?.controle_estoque) return false;
  if (user?.role && user.role !== 'admin') return item.roles.includes(user.role);
  return true;
}

export function getDashboardNavigation(user?: DashboardNavigationUser | null) {
  return {
    main: dashboardNavigationItems.filter((item) => canAccessItem(item, user)),
    management: dashboardManagementItems.filter((item) => canAccessItem(item, user)),
  };
}

export function isDashboardRouteActive(pathname: string, href: string) {
  const hrefPathname = href.split('?')[0];

  return pathname === hrefPathname || (hrefPathname !== '/dashboard' && pathname.startsWith(`${hrefPathname}/`));
}
