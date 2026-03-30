'use client';

import React, { useState } from 'react';
import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';
import MenuManagement from '@/components/menu-management';
import ComplementsManagement from '@/components/complements-management';
import { cn } from '@/lib/utils';
import { PackageSearch, Layers } from 'lucide-react';

export default function MenuPage() {
  const [activeTab, setActiveTab] = useState<'produtos' | 'complementos'>('produtos');

  return (
    <SidebarProvider>
      <DashboardLayout>
        <div className="mb-6 flex space-x-2 border-b border-slate-200 pb-px">
          <button
            onClick={() => setActiveTab('produtos')}
            className={cn(
              "flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors",
              activeTab === 'produtos' ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            <PackageSearch className="size-4" />
            Produtos do Cardápio
          </button>
          <button
            onClick={() => setActiveTab('complementos')}
            className={cn(
              "flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors",
              activeTab === 'complementos' ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            <Layers className="size-4" />
            Grupos e Opcionais
          </button>
        </div>

        {activeTab === 'produtos' ? <MenuManagement /> : <ComplementsManagement />}
      </DashboardLayout>
    </SidebarProvider>
  );
}
