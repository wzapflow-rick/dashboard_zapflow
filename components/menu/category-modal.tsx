'use client';

import React, { useState, useEffect } from 'react';
import { X, Edit3, Trash2, Check, GripVertical, ChevronUp, ChevronDown, ImageIcon, UploadCloud, Loader2 } from 'lucide-react';
import { MobileDrawer } from '@/components/ui/mobile-drawer';
import { uploadImageAction, applyImageToCategory, type Category } from '@/app/actions/products';
import { toast } from 'sonner';

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

  // Modal "aplicar foto a categoria"
  const [imageCategory, setImageCategory] = useState<Category | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [somenteVazios, setSomenteVazios] = useState(false);
  const [applyingImage, setApplyingImage] = useState(false);

  const openImageModal = (cat: Category) => {
    setImageCategory(cat);
    setSelectedFile(null);
    setPreviewUrl(null);
    setSomenteVazios(false);
  };

  const closeImageModal = () => {
    setImageCategory(null);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleApplyImage = async () => {
    if (!imageCategory || !selectedFile) {
      toast.error('Selecione uma imagem primeiro.');
      return;
    }
    setApplyingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      const url = await uploadImageAction(formData);
      if (!url) throw new Error('Falha no upload da imagem.');

      const result = await applyImageToCategory(imageCategory.id, url, { somenteVazios });
      toast.success(`Imagem aplicada a ${result.updated} produto(s) de "${imageCategory.nome}".`);
      closeImageModal();
    } catch (error: any) {
      console.error('Erro ao aplicar imagem:', error);
      toast.error(error?.message || 'Erro ao aplicar imagem à categoria.');
    } finally {
      setApplyingImage(false);
    }
  };

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
                      onClick={() => openImageModal(cat)}
                      className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20 rounded-lg transition-all"
                      title="Aplicar uma foto a todos os produtos desta categoria"
                    >
                      <ImageIcon className="size-4" />
                    </button>
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

      {/* Sub-modal: aplicar foto a todos os produtos da categoria */}
      {imageCategory && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div
            onClick={closeImageModal}
            className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-700/50">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Foto da categoria</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{imageCategory.nome}</p>
              </div>
              <button type="button" onClick={closeImageModal} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors">
                <X className="size-5 text-slate-500 dark:text-slate-400" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                A imagem escolhida será aplicada a <strong>todos os produtos</strong> desta categoria.
              </p>

              <label className="group relative flex flex-col items-center justify-center gap-2 w-full aspect-video rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-primary cursor-pointer overflow-hidden transition-colors bg-slate-50 dark:bg-slate-700/50">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl || "/placeholder.svg"} alt="Pré-visualização" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <>
                    <UploadCloud className="size-7 text-slate-400 group-hover:text-primary transition-colors" />
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Clique para escolher uma imagem</span>
                  </>
                )}
                <input type="file" accept="image/*" onChange={handleFileChange} className="sr-only" />
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={somenteVazios}
                  onChange={(e) => setSomenteVazios(e.target.checked)}
                  className="size-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                />
                <span className="text-sm text-slate-600 dark:text-slate-300">Aplicar apenas em produtos sem foto</span>
              </label>

              <button
                type="button"
                onClick={handleApplyImage}
                disabled={!selectedFile || applyingImage}
                className="w-full px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {applyingImage ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
                {applyingImage ? 'Aplicando...' : 'Aplicar a todos os produtos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileDrawer>
  );
}
