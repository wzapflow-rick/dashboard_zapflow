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
  Ticket
} from 'lucide-react';
import { logoutAdmin } from '@/app/actions/admin-auth';
import { cn } from '@/lib/utils';

interface AdminSidebarProps {
  username: string;
}

const menuItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/empresas', label: 'Empresas', icon: Building2 },
  { href: '/admin/assinaturas', label: 'Assinaturas', icon: CreditCard },
  { href: '/admin/cupons', label: 'Cupons', icon: Ticket },
];

export default function AdminSidebar({ username }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logoutAdmin();
    router.push('/admin');
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#0f1f35] border-b border-[#1e3a5f]/50 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="size-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            <Bolt className="size-6" />
          </div>
          <div>
            <h1 className="font-bold text-white">ZapFlow</h1>
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
        "fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-[#0f1f35] to-[#0a1628] border-r border-[#1e3a5f]/50 flex flex-col z-50 transition-transform duration-300",
        "lg:translate-x-0",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Header */}
        <div className="p-6 border-b border-[#1e3a5f]/50">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
              <Bolt className="size-6" />
            </div>
            <div>
              <h1 className="font-bold text-white">ZapFlow</h1>
              <div className="flex items-center gap-1 text-xs text-orange-400">
                <Shield className="size-3" />
                <span>Admin</span>
              </div>
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobileMenu}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                  isActive
                    ? 'bg-orange-500/10 text-orange-400 border-l-4 border-orange-500'
                    : 'text-slate-400 hover:bg-[#162438] hover:text-white'
                )}
              >
                <item.icon className="size-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[#1e3a5f]/50">
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
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <LogOut className="size-5" />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}
