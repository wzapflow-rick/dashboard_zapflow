'use client';

import React from 'react';
import { X, Edit3, Trash2, Check } from 'lucide-react';
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-900">{editingCategory ? 'Editar' : 'Nova'} Categoria</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X className="size-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider">Nome</label>
            <input
              name="nome"
              defaultValue={editingCategory?.nome}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              placeholder="Ex: Pizzas Salgadas"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider">Ordem de Exibição</label>
            <input
              name="ordem"
              type="number"
              defaultValue={editingCategory?.ordem || 0}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Check className="size-4" />
              Salvar Categoria
            </button>
          </div>
        </form>

        {categories.length > 0 && (
          <div className="p-4 sm:p-6 border-t border-slate-100 overflow-y-auto">
            <h3 className="text-sm font-bold text-slate-700 mb-3">Categorias Existentes</h3>
            <div className="space-y-2">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <span className="font-medium text-slate-900">{cat.nome}</span>
                    <span className="text-xs text-slate-500 ml-2">Ordem: {cat.ordem || 0}</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingCategory(cat)}
                      className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                    >
                      <Edit3 className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(cat.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
