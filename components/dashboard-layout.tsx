'use client';

import React, { createContext, useContext, useState } from 'react';
import { Sidebar } from './layout/sidebar';
import { Header } from './layout/header';
import { cn } from '@/lib/utils';

interface SidebarContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <SidebarContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error('useSidebar must be used within SidebarProvider');
  return context;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isOpen, setIsOpen } = useSidebar();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  React.useEffect(() => {
    import('@/app/actions/auth').then(({ getMe }) => {
      getMe().then(setUser);
    });
  }, []);

  const isCozinheiro = user?.role === 'cozinheiro';

  return (
    <div className="flex min-h-screen bg-background-light dark:bg-slate-900">
      {!isCozinheiro && (
        <Sidebar
          isOpen={isOpen}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />
      )}

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300 min-w-0 flex flex-col min-h-screen",
        isCozinheiro ? "ml-0" : (isOpen ? "lg:ml-64" : "lg:ml-20"),
        "ml-0"
      )}>
        <Header
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />
        <div className="p-4 sm:p-6 lg:p-8 flex-1 dark:bg-slate-900">
          {children}
        </div>
      </main>
    </div>
  );
}
