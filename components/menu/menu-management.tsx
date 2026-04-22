'use client';

import React, { useState } from 'react';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  Filter,
  X,
  Check,
  Loader2,
  Sparkles,
  Folder
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { type Category } from '@/app/actions/products';
import { getReceitaDoProduto, getTodasReceitas, type Insumo } from '@/app/actions/insumos';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import ProductTable from '@/components/menu/product-table';
import { useMenuData } from '@/hooks/use-menu-data';
import { useMenuFilters } from '@/hooks/use-menu-filters';
import { useDriverTour } from '@/hooks/use-driver-tour';
import { saveProduct } from '@/lib/menu-utils';

const ProductFormModal = dynamic(() => import('@/components/menu/product-form-modal'), {
  ssr: false,
});

const BulkComplementModal = dynamic(() => import('@/components/menu/bulk-complement-modal'), {
  ssr: false,
});

const CategoryModal = dynamic(() => import('@/components/menu/category-modal'), {
  ssr: false,
});

export default function MenuManagement({ hideCategoryButton }: { hideCategoryButton?: boolean }) {
  const {
    products,
    setProducts,
    categories,
    setCategories,
    user,
    loading,
    insumosList,
    productRecipes,
    fetchData,
    toggleDisponibilidade,
    handleDelete,
    handleSaveCategory,
    handleDeleteCategory
  } = useMenuData();

  const {
    searchQuery,
    setSearchQuery,
    selectedCategoryId,
    setSelectedCategoryId,
    currentPage,
    setCurrentPage,
    isFilterOpen,
    setIsFilterOpen,
    sortBy,
    setSortBy,
    availabilityFilter,
    setAvailabilityFilter,
    itemsPerPage,
    filteredProducts,
    paginatedProducts,
    totalPages
  } = useMenuFilters(products);

  const { startTour } = useDriverTour();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editingProductInsumos, setEditingProductInsumos] = useState<{ insumo_id: number; quantidade_necessaria: number }[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const handleEditInit = async (product: any) => {
    setEditingProduct(product);
    try {
      const receita = await getReceitaDoProduto(product.id);
      setEditingProductInsumos(receita);
    } catch {
      setEditingProductInsumos([]);
    }
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (formData: FormData, isCreatingCategory: boolean, selectedInsumos?: { insumo_id: string | number; quantidade_necessaria: number }[]) => {
    try {
      const savedProduct = await saveProduct(
        formData,
        editingProduct,
        isCreatingCategory,
        selectedInsumos
      );

      if (editingProduct) {
        setProducts(products.map(p => p.id === editingProduct.id ? savedProduct : p));
        toast.success('Produto atualizado com sucesso!');
      } else {
        setProducts([savedProduct, ...products]);
        toast.success('Produto criado com sucesso!');
      }

      const categoriesData = await getTodasReceitas();
      setCategories(categoriesData);

      setIsModalOpen(false);
      setEditingProduct(null);
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      toast.error('Erro ao salvar produto no servidor.');
    }
  };

  const handleCategorySave = async (data: Partial<Category>) => {
    const saved = await handleSaveCategory(data);
    return saved;
  };

  const getCategoryName = (id: number) => {
    const cat = categories.find(c => c.id === id);
    return cat ? cat.nome : 'Sem Categoria';
  };

  return (
    <div className="space-y-8">
      <header id="menu-header" className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight dark:text-zinc-200">Produtos</h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Gerencie seus produtos industrializados (bebidas, royalties, etc).</p>
        </div>
        <div className="flex items-center gap-3">
          {!hideCategoryButton && (
            <button
              onClick={() => { setEditingCategory(null); setIsCategoryModalOpen(true); }}
              className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm flex items-center gap-2 transition-all active:scale-95 dark:bg-slate-800/75 dark:text-zinc-200 dark:border-slate-700"
            >
              <Folder className="size-4 text-amber-500" />
              Gerenciar Categorias
            </button>
          )}
          <button
            onClick={startTour}
            className="bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 dark:bg-amber-900 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-800"
          >
            <Sparkles className="size-4 text-amber-500 dark:text-amber-100" />
            Tour
          </button>
          {/* <button
            id="btn-cadastro-massa"
            onClick={() => setIsBulkModalOpen(true)}
            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm flex items-center gap-2 transition-all active:scale-95"
          >
            <Check className="size-4 text-violet-500" />
            Cadastrar em Massa
          </button> */}
          <button
            id="btn-novo-produto"
            onClick={() => { setEditingProduct(null); setEditingProductInsumos([]); setIsModalOpen(true); }}
            className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-primary/20 flex items-center gap-2 transition-all active:scale-95"
          >
            <Plus className="size-4" />
            Novo Produto
          </button>
        </div>
      </header>

      {/* Filters & Search */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 dark:bg-slate-800/75 dark:border-slate-700">
        <div id="search-bar" className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-slate-400 transition-all outline-none dark:bg-slate-800"
            placeholder="Buscar por nome ou código..."
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          />
        </div>
        <div id="category-filters" className="flex items-center gap-1 overflow-x-auto pb-2 md:pb-0 no-scrollbar flex-1">
          <button
            onClick={() => { setSelectedCategoryId(0); setCurrentPage(1); }}
            className={cn(
              "px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap",
              selectedCategoryId === 0 ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-50 dark:text-zinc-200 dark:border-slate-700"
            )}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => { setSelectedCategoryId(cat.id); setCurrentPage(1); }}
              className={cn(
                "px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap",
                selectedCategoryId === cat.id ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-50 dark:text-zinc-200 dark:border-slate-700 dark:hover:bg-slate-700"
              )}
            >
              {cat.nome}
            </button>
          ))}
        </div>

        <div className="flex items-center shrink-0">
          <div className="w-px h-6 bg-slate-200 mx-2"></div>
          <div id="filter-dropdown" className="relative">
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={cn("p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors", isFilterOpen && "bg-slate-100 text-slate-900")}
            >
              <Filter className="size-5" />
            </button>
            <AnimatePresence>
              {isFilterOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsFilterOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 p-4 space-y-4"
                  >
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Disponibilidade</label>
                      <select
                        value={availabilityFilter}
                        onChange={(e) => { setAvailabilityFilter(e.target.value); setCurrentPage(1); }}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      >
                        <option value="all">Todos</option>
                        <option value="available">Apenas Disponíveis</option>
                        <option value="unavailable">Apenas Esgotados</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ordenar por</label>
                      <select
                        value={sortBy}
                        onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      >
                        <option value="recent">Mais Recentes</option>
                        <option value="id_asc">Mais Antigos</option>
                        <option value="name_asc">Nome (A - Z)</option>
                        <option value="name_desc">Nome (Z - A)</option>
                        <option value="price_asc">Menor Preço</option>
                        <option value="price_desc">Maior Preço</option>
                      </select>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Product Table */}
      <ProductTable
        loading={loading}
        products={products}
        paginatedProducts={paginatedProducts}
        categories={categories}
        insumosList={insumosList}
        productRecipes={productRecipes}
        totalFiltered={filteredProducts.length}
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onEdit={handleEditInit}
        onDelete={handleDelete}
        onToggleAvailability={toggleDisponibilidade}
        user={user}
      />

      {isModalOpen && (
        <ProductFormModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingProduct(null); setEditingProductInsumos([]); }}
          editingProduct={editingProduct}
          categories={categories}
          insumosList={insumosList}
          productInsumos={editingProductInsumos}
          onSubmit={handleSaveProduct}
        />
      )}

      {/* Category Modal */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => { setIsCategoryModalOpen(false); setEditingCategory(null); }}
        editingCategory={editingCategory}
        setEditingCategory={setEditingCategory}
        categories={categories}
        onSave={handleCategorySave}
        onDelete={handleDeleteCategory}
      />

      {/* Bulk Complement Modal */}
      {isBulkModalOpen && (
        <BulkComplementModal
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          products={products}
          grupos={[]}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
