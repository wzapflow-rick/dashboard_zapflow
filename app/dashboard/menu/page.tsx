'use client';

import React, { useState } from 'react';
import MenuManagement from '@/components/menu/menu-management';
import { Folder } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useMenuData } from '@/hooks/use-menu-data';

const CategoryModal = dynamic(() => import('@/components/menu/category-modal'), {
  ssr: false,
});

export default function MenuPage() {
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const { categories, handleSaveCategory, handleDeleteCategory } = useMenuData();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-end gap-4 border-b border-slate-200 dark:border-zinc-800/60 pb-px">
        <button
          onClick={() => setIsCategoryModalOpen(true)}
          className="mb-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm flex items-center gap-2 transition-all active:scale-95 dark:bg-zinc-900/75 dark:text-zinc-200 dark:border-zinc-800/60"
        >
          <Folder className="size-4 text-amber-500" />
          Gerenciar Categorias
        </button>
      </div>

      <MenuManagement hideCategoryButton />

      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        editingCategory={editingCategory}
        setEditingCategory={setEditingCategory}
        categories={categories}
        onSave={handleSaveCategory}
        onDelete={handleDeleteCategory}
      />
    </>
  );
}