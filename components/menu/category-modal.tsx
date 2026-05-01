'use client';

import React, { useState, useEffect } from 'react';
import { X, Edit3, Trash2, Check, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
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
  const [orderedCategories, setOrderedCategories] = useState<Category[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // Ordenar categorias quando o modal abre ou categorias mudam
  useEffect(() => {
    const sorted = [...categories].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    setOrderedCategories(sorted);
  }, [categories]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Nova categoria recebe ordem = ultimo + 1
    const maxOrdem = orderedCategories.length > 0 
      ? Math.max(...orderedCategories.map(c => c.ordem || 0)) 
      : -1;
    
    const data: Partial<Category> = {
      id: editingCategory?.id,
      nome: formData.get('nome') as string,
      ordem: editingCategory?.ordem ?? (maxOrdem + 1)
    };

    try {
      await onSave(data);
      if (!editingCategory) {
        // Limpar formulario apos criar nova categoria
        (e.target as HTMLFormElement).reset();
      } else {
        setEditingCategory(null);
      }
    } catch (error) {
      console.error('Erro ao salvar categoria:', error);
    }
  };

  const moveCategory = async (index: number, direction: 'up' | 'down') => {
    if (isSavingOrder) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= orderedCategories.length) return;

    setIsSavingOrder(true);
    
    // Trocar posicoes no array
    const newOrder = [...orderedCategories];
    [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
    
    // Atualizar ordem de ambas categorias
    try {
      await Promise.all([
        onSave({ id: newOrder[index].id, nome: newOrder[index].nome, ordem: index }),
        onSave({ id: newOrder[newIndex].id, nome: newOrder[newIndex].nome, ordem: newIndex })
      ]);
      setOrderedCategories(newOrder);
    } catch (error) {
      console.error('Erro ao reordenar:', error);
    } finally {
      setIsSavingOrder(false);
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
      <div className="space-y-6">
        {/* Formulario de criar/editar */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Nome da Categoria</label>
            <input
              name="nome"
              key={editingCategory?.id || 'new'}
              defaultValue={editingCategory?.nome || ''}
              required
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
              placeholder="Ex: Pizzas Salgadas"
              autoFocus
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Check className="size-4" />
              {editingCategory ? 'Salvar' : 'Criar Categoria'}
            </button>
            {editingCategory && (
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="px-4 py-3 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-500 transition-all text-sm"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>

        {/* Lista de categorias com ordenacao */}
        {orderedCategories.length > 0 && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Ordenar Categorias
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Use as setas para reordenar
              </span>
            </div>
            <div className="space-y-2">
              {orderedCategories.map((cat, index) => (
                <div 
                  key={cat.id} 
                  className={`flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700 rounded-xl border-2 transition-all ${
                    editingCategory?.id === cat.id 
                      ? 'border-primary bg-primary/5 dark:bg-primary/10' 
                      : 'border-transparent'
                  }`}
                >
                  {/* Indicador de posicao */}
                  <div className="flex items-center justify-center size-6 bg-slate-200 dark:bg-slate-600 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300">
                    {index + 1}
                  </div>
                  
                  {/* Icone de arrastar (visual) */}
                  <GripVertical className="size-4 text-slate-400 dark:text-slate-500" />
                  
                  {/* Nome da categoria */}
                  <span className="flex-1 font-medium text-slate-900 dark:text-white truncate">
                    {cat.nome}
                  </span>
                  
                  {/* Botoes de ordenacao */}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => moveCategory(index, 'up')}
                      disabled={index === 0 || isSavingOrder}
                      className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Mover para cima"
                    >
                      <ChevronUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveCategory(index, 'down')}
                      disabled={index === orderedCategories.length - 1 || isSavingOrder}
                      className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Mover para baixo"
                    >
                      <ChevronDown className="size-4" />
                    </button>
                  </div>
                  
                  {/* Botoes de acao */}
                  <div className="flex gap-1 border-l border-slate-200 dark:border-slate-600 pl-2 ml-1">
                    <button
                      type="button"
                      onClick={() => setEditingCategory(cat)}
                      className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20 rounded-lg transition-all"
                      title="Editar"
                    >
                      <Edit3 className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(cat.id)}
                      className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                      title="Excluir"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 text-center">
              A ordem aqui sera a mesma exibida no cardapio
            </p>
          </div>
        )}
      </div>
    </MobileDrawer>
  );
}
