'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';
import MenuManagement from '@/components/menu/menu-management';
import SlotGroupsManagement from '@/components/management/slot-groups-management';
import { getMe } from '@/app/actions/auth';
import { cn } from '@/lib/utils';
import { Package, PlusCircle } from 'lucide-react';

export default function MenuPage() {
  const [activeTab, setActiveTab] = useState<'produtos' | 'compostos'>('produtos');

  return (
    <SidebarProvider>
      <DashboardLayout>
        <div className="mb-6 flex space-x-2 border-b border-slate-200 dark:border-slate-700 pb-px">
          <button
            onClick={() => setActiveTab('produtos')}
            className={cn(
              "flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors",
              activeTab === 'produtos' ? "border-primary text-primary" : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600"
            )}
          >
            <Package className="size-4" />
            Produtos
          </button>
          <button
            onClick={() => setActiveTab('compostos')}
            className={cn(
              "flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors",
              activeTab === 'compostos' ? "border-primary text-primary" : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600"
            )}
          >
            <PlusCircle className="size-4" />
            Produtos Compostos
          </button>
        </div>

        {activeTab === 'produtos' ? <MenuManagement /> : <SlotGroupsManagement />}
      </DashboardLayout>
    </SidebarProvider>
  );
}
