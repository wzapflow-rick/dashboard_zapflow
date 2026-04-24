'use client';

import React from 'react';
import { X, Edit3, Trash2, Check } from 'lucide-react';
import { MobileDrawer } from '@/components/ui/mobile-drawer';
import { type Category } from '@/app/actions/products';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingCategory: Category | null;
  setEditingCategory: (category: Category | null) => void;
  categories: Category[];
  onSave: (data: Partial<Category>) => Promise<any>;
  onDelete: (id: number) => Promise<void>;
}

export default function CategoryModal({
  isOpen,
  onClose,
  editingCategory,
  setEditingCategory,
  categories,
  onSave,
  onDelete
}: CategoryModalProps) {
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Partial<Category> = {
      id: editingCategory?.id,
      nome: formData.get('nome') as string,
      ordem: Number(formData.get('ordem') || 0)
    };

    try {
      await onSave(data);
      onClose();
      setEditingCategory(null);
    } catch (error) {
      console.error('Erro ao salvar categoria:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <MobileDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Nome da Categoria</label>
            <input
              name="nome"
              defaultValue={editingCategory?.nome}
              required
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
              placeholder="Ex: Pizzas Salgadas"
              autoFocus
            />
        </div>

        <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Ordem de Exibição</label>
            <input
              name="ordem"
              type="number"
              defaultValue={editingCategory?.ordem || 0}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
        </div>

        <div className="pt-4">
            <button
              type="submit"
              className="w-full px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Check className="size-4" />
              Salvar Categoria
            </button>
        </div>

        {categories.length > 0 && (
          <div className="pt-6 border-t border-slate-200 dark:border-slate-700 overflow-y-auto">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wider">Categorias Existentes</h3>
            <div className="space-y-3">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <div>
                    <span className="font-medium text-slate-900 dark:text-white">{cat.nome}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">Ordem: {cat.ordem || 0}</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingCategory(cat)}
                      className="p-2 text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20 rounded-lg transition-all"
                    >
                      <Edit3 className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(cat.id)}
                      className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </form>
    </MobileDrawer>
  );
}
