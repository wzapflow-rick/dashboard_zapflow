'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Bolt, 
  LayoutDashboard, 
  Building2, 
  CreditCard, 
  LogOut,
  Shield,
  Menu,
  X,
  Target,
  Users,
  KanbanSquare,
  Tag,
  MessageSquare,
  ListTodo,
  History,
  Settings,
  HelpCircle,
  Activity,
  UtensilsCrossed,
  Radar,
} from 'lucide-react';
import { logoutAdmin } from '@/app/actions/admin-auth';
import { cn } from '@/lib/utils';
import { MorphingInfinity } from '@/components/ui/morphing-infinity';

interface AdminSidebarProps {
  username: string;
}

interface MenuItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MenuGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
}

const comercialMenu: MenuGroup = {
  label: 'Comercial',
  icon: Target,
  items: [
    { href: '/admin/dashboard', label: 'Visão geral', icon: LayoutDashboard },
    { href: '/admin/remarketing', label: 'Funil', icon: KanbanSquare },
    { href: '/admin/remarketing/contatos', label: 'Leads', icon: Users },
    { href: '/admin/captacao', label: 'Captação de Leads', icon: Radar },
    { href: '/admin/demo', label: 'Demo de Cardápio', icon: UtensilsCrossed },
  ],
};

const automacaoMenu: MenuGroup = {
  label: 'Automação',
  icon: MessageSquare,
  items: [
    { href: '/admin/remarketing/mensagens', label: 'Mensagens', icon: MessageSquare },
    { href: '/admin/remarketing/etiquetas', label: 'Etiquetas', icon: Tag },
    { href: '/admin/remarketing/fila', label: 'Fila', icon: ListTodo },
    { href: '/admin/remarketing/historico', label: 'Histórico', icon: History },
    { href: '/admin/remarketing/config', label: 'Configurações', icon: Settings },
    { href: '/admin/remarketing/ajuda', label: 'Ajuda', icon: HelpCircle },
  ],
};

const sistemaMenu: MenuGroup = {
  label: 'Sistema',
  icon: Building2,
  items: [
    { href: '/admin/empresas', label: 'Empresas', icon: Building2 },
    { href: '/admin/assinaturas', label: 'Assinaturas', icon: CreditCard },
    { href: '/admin/monitoramento', label: 'Monitoramento', icon: Activity },
  ],
};

const menuGroups: MenuGroup[] = [comercialMenu, automacaoMenu, sistemaMenu];

export default function AdminSidebar({ username }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      await logoutAdmin();
      router.push('/admin');
    } catch (error) {
      console.error('Erro ao sair da administração:', error);
      setIsLoggingOut(false);
    }
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#111113] border-b border-[#27272a]/50 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="size-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            <Bolt className="size-6" />
          </div>
          <div>
            <h1 className="font-bold text-white">ZapFlash</h1>
            <div className="flex items-center gap-1 text-xs text-orange-400">
              <Shield className="size-3" />
              <span>Admin</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-400 hover:text-white transition-colors"
        >
          {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-[#111113] to-[#09090b] border-r border-[#27272a]/50 flex flex-col z-50 transition-transform duration-300",
        "lg:translate-x-0",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Header */}
        <div className="p-6 border-b border-[#27272a]/50">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
              <Bolt className="size-6" />
            </div>
            <div>
              <h1 className="font-bold text-white">ZapFlash</h1>
              <div className="flex items-center gap-1 text-xs text-orange-400">
                <Shield className="size-3" />
                <span>Admin</span>
              </div>
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav aria-label="Menu do admin" className="flex-1 p-4 flex flex-col gap-6 overflow-y-auto">
          {menuGroups.map((group) => (
            <div key={group.label} className="flex flex-col gap-1">
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {group.label}
              </p>
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobileMenu}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm',
                      isActive
                        ? 'bg-orange-500/10 text-orange-400 font-medium'
                        : 'text-slate-400 hover:bg-[#18181b] hover:text-white'
                    )}
                  >
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[#27272a]/50">
          <div className="flex items-center gap-3 px-4 py-2 mb-2">
            <div className="size-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
              {username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{username}</p>
              <p className="text-xs text-slate-500">Administrador</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            aria-busy={isLoggingOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:cursor-wait disabled:opacity-60"
          >
            {isLoggingOut ? (
              <MorphingInfinity className="size-5" aria-hidden="true" />
            ) : (
              <LogOut className="size-5" aria-hidden="true" />
            )}
            <span className="font-medium">{isLoggingOut ? 'Saindo...' : 'Sair'}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
