'use client';

import React, { useState } from 'react';
import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';
import MenuManagement from '@/components/menu/menu-management';
import SlotGroupsManagement from '@/components/management/slot-groups-management';
import { cn } from '@/lib/utils';
import { Package, PlusCircle, Folder } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useMenuData } from '@/hooks/use-menu-data';

const CategoryModal = dynamic(() => import('@/components/menu/category-modal'), {
  ssr: false,
});

export default function MenuPage() {
  const [activeTab, setActiveTab] = useState<'produtos' | 'compostos'>('produtos');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const { categories, handleSaveCategory, handleDeleteCategory } = useMenuData();

  return (
    <SidebarProvider>
      <DashboardLayout>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-px">
          <div className="flex space-x-2">
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

          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="mb-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm flex items-center gap-2 transition-all active:scale-95 dark:bg-slate-800/75 dark:text-zinc-200 dark:border-slate-700"
          >
            <Folder className="size-4 text-amber-500" />
            Gerenciar Categorias
          </button>
        </div>

        {activeTab === 'produtos' ? <MenuManagement hideCategoryButton /> : <SlotGroupsManagement />}

        <CategoryModal
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          editingCategory={editingCategory}
          setEditingCategory={setEditingCategory}
          categories={categories}
          onSave={handleSaveCategory}
          onDelete={handleDeleteCategory}
        />
      </DashboardLayout>
    </SidebarProvider>
  );
}
