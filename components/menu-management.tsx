'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  Image as ImageIcon,
  Check,
  Loader2,
  CheckCircle2,
  Sparkles,
  Folder
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import {
  getProducts,
  getCategories,
  updateProductAvailability,
  deleteProduct,
  upsertProduct,
  upsertCategory,
  deleteCategory,
  uploadImageAction,
  type Category
} from '@/app/actions/products';
import { getGruposComplementos, getGruposDoProduto, updateGruposDoProduto } from '@/app/actions/complements';
import { getInsumos, getReceitaDoProduto, getTodasReceitas, type Insumo } from '@/app/actions/insumos';
import { getGruposSlots, getGruposDoProduto as getGruposSlotsDoProduto, updateGruposDoProduto as atualizarGruposSlotsDoProduto } from '@/app/actions/grupos-slots';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import ProductTable from './menu/product-table';

const ProductFormModal = dynamic(() => import('./menu/product-form-modal'), {
  ssr: false,
});

const BulkComplementModal = dynamic(() => import('./menu/bulk-complement-modal'), {
  ssr: false,
});


export default function MenuManagement() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const driverRef = useRef<any>(null);

  // Initialize Driver.js tour
  useEffect(() => {
    driverRef.current = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayOpacity: 0.7,
      smoothScroll: true,
      steps: [
        {
          element: '#menu-header',
          popover: {
            title: '🍽️ Gestão de Cardápio',
            description: 'Aqui você gerencia TODOS os produtos do seu restaurante. Esta é a parte mais importante do sistema!',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '#btn-novo-produto',
          popover: {
            title: '➕ Novo Produto',
            description: 'Clique aqui para criar um novo produto. Você pode definir nome, preço, foto, categoria, estoque e complementos.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#btn-cadastro-massa',
          popover: {
            title: '⚡ Cadastro em Massa',
            description: 'Atribua complementos a vários produtos de uma vez só. Economize tempo!',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#search-bar',
          popover: {
            title: '🔍 Busca Rápida',
            description: 'Pesquise produtos por nome ou código. Útil quando você tem muitos itens no cardápio.',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '#category-filters',
          popover: {
            title: '📂 Filtro por Categorias',
            description: 'Filtre os produtos por categoria (Lanches, Bebidas, Sobremesas, etc). Clique em "Todos" para ver tudo.',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '#filter-dropdown',
          popover: {
            title: '⚙️ Filtros Avançados',
            description: 'Filtre por disponibilidade (disponível/esgotado) e ordene por nome, preço ou data de criação.',
            side: 'left',
            align: 'start'
          }
        },
        {
          element: '#product-table',
          popover: {
            title: '📋 Tabela de Produtos',
            description: 'Aqui estão todos os seus produtos. Cada linha mostra nome, preço, categoria, estoque e disponibilidade.',
            side: 'top',
            align: 'start'
          }
        },
        {
          element: '#product-availability',
          popover: {
            title: '✅ Disponibilidade',
            description: 'Clique no botão para ativar/desativar um produto. Produtos desativados não aparecem no cardápio público.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#product-actions',
          popover: {
            title: '✏️ Ações do Produto',
            description: 'Edite, exclua ou configure estoque/insumos de cada produto. O ícone de estoque mostra quanto de cada ingrediente você tem.',
            side: 'top',
            align: 'end'
          }
        },
        {
          element: '#pagination',
          popover: {
            title: '📄 Paginação',
            description: 'Navegue entre as páginas para ver todos os produtos. Você pode ajustar quantos itens por página.',
            side: 'top',
            align: 'center'
          }
        },
        {
          popover: {
            title: '🎉 Pronto!',
            description: 'Agora você conhece a Gestão de Cardápio! Dica: use "Produtos em Slot" na aba ao lado para criar combos e montáveis (pizzas meio a meio, etc).',
            side: 'top',
            align: 'center'
          }
        }
      ],
      onNextClick: (element, step) => {
        driverRef.current.moveNext();
      },
      onPrevClick: (element, step) => {
        driverRef.current.movePrevious();
      },
      onCloseClick: () => {
        driverRef.current.destroy();
      }
    });
  }, []);

  const startTour = () => {
    if (driverRef.current) {
      driverRef.current.drive();
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | string>(0); // 0 means 'Todos'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [insumosList, setInsumosList] = useState<Insumo[]>([]);
  const [productRecipes, setProductRecipes] = useState<any[]>([]);
  const [editingProductInsumos, setEditingProductInsumos] = useState<{ insumo_id: number; quantidade_necessaria: number }[]>([]);
  const [gruposComplemento, setGruposComplemento] = useState<any[]>([]);
  const [editingProductGrupos, setEditingProductGrupos] = useState<number[]>([]);
  const [gruposSlots, setGruposSlots] = useState<any[]>([]);
  const [editingProductSlots, setEditingProductSlots] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState('recent');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const itemsPerPage = 5;


  // Helper to get category name by id
  const getCategoryName = (id: number) => {
    const cat = categories.find(c => c.id === id);
    return cat ? cat.nome : 'Sem Categoria';
  };

  // Fetch products and categories from Postgres via Server Actions
  const fetchData = async () => {
    try {
      setLoading(true);
      const [productsData, categoriesData, insumosData, receitasData, gruposData, slotsData] = await Promise.all([
        getProducts(),
        getCategories(),
        getInsumos(),
        getTodasReceitas(),
        getGruposComplementos(),
        getGruposSlots()
      ]);
      setProducts(productsData);
      setCategories(categoriesData);
      setInsumosList(insumosData);
      setProductRecipes(receitasData);
      setGruposComplemento(gruposData);
      setGruposSlots(slotsData);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar dados do banco de dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    import('@/app/actions/auth').then(({ getMe }) => {
      getMe().then(setUser);
    });
    fetchData();
  }, []);

  // Toggle availability with Optimistic UI
  const toggleDisponibilidade = async (produtoId: number | string, statusAtual: boolean) => {
    const novoStatus = !statusAtual;

    // Optimistic Update
    const previousProducts = [...products];
    setProducts(products.map(p => p.id === produtoId ? { ...p, disponivel: novoStatus } : p));

    try {
      await updateProductAvailability(produtoId, novoStatus);
      toast.success(novoStatus ? 'Produto ativado com sucesso!' : 'Produto esgotado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar disponibilidade:', error);
      // Rollback
      setProducts(previousProducts);
      toast.error('Erro ao atualizar disponibilidade no servidor.');
    }
  };

  // Filtered and Sorted products
  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      const name = p.nome || '';
      const id = String(p.id || '');
      const catId = p.categoria_id || 0;

      const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) || id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategoryId === 0 || catId === selectedCategoryId;
      const matchesAvailability = availabilityFilter === 'all' ? true : availabilityFilter === 'available' ? p.disponivel : !p.disponivel;

      return matchesSearch && matchesCategory && matchesAvailability;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc': return (a.nome || '').localeCompare(b.nome || '');
        case 'name_desc': return (b.nome || '').localeCompare(a.nome || '');
        case 'price_asc': return (Number(a.preco) || 0) - (Number(b.preco) || 0);
        case 'price_desc': return (Number(b.preco) || 0) - (Number(a.preco) || 0);
        case 'id_asc': return (a.id || 0) - (b.id || 0);
        case 'id_desc':
        case 'recent':
        default: return (b.id || 0) - (a.id || 0);
      }
    });

    return result;
  }, [products, searchQuery, selectedCategoryId, availabilityFilter, sortBy]);

  // Paginated products
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  const handleDelete = async (id: number | string) => {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
      try {
        await deleteProduct(id);
        setProducts(products.filter(p => p.id !== id));
        toast.success('Produto excluído com sucesso!');
        // Refresh categories if needed
        const categoriesData = await getCategories();
        setCategories(categoriesData);
      } catch (error) {
        console.error('Erro ao excluir produto:', error);
        toast.error('Erro ao excluir produto no servidor.');
      }
    }
  };

  const handleEditInit = async (product: any) => {
    setEditingProduct(product);
    try {
      const receita = await getReceitaDoProduto(product.id);
      setEditingProductInsumos(receita);
    } catch {
      setEditingProductInsumos([]);
    }
    try {
      const prodSlots = await getGruposSlotsDoProduto(Number(product.id));
      setEditingProductSlots(prodSlots.map(String));
    } catch {
      setEditingProductSlots([]);
    }
    setIsModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Partial<Category> = {
      id: editingCategory?.id,
      nome: formData.get('nome') as string,
      ordem: Number(formData.get('ordem') || 0)
    };

    try {
      const saved = await upsertCategory(data);
      if (editingCategory) {
        setCategories(categories.map(c => c.id === editingCategory.id ? saved as Category : c));
        toast.success('Categoria atualizada!');
      } else {
        setCategories([...categories, saved as Category]);
        toast.success('Categoria criada!');
      }
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
    } catch (error) {
      toast.error('Erro ao salvar categoria.');
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir esta categoria? Os produtos vinculados perderão a referência.')) {
      try {
        await deleteCategory(id);
        setCategories(categories.filter(c => c.id !== id));
        toast.success('Categoria excluída com sucesso!');
      } catch (error) {
        console.error('Erro ao excluir:', error);
        toast.error('Erro ao excluir a categoria.');
      }
    }
  };

  const handleSaveProduct = async (formData: FormData, isCreatingCategory: boolean, selectedInsumos?: { insumo_id: string | number, quantidade_necessaria: number }[], selectedGrupos?: number[], selectedSlots?: string[]) => {
    try {
      let finalCategoryId = Number(formData.get('categoria_id'));

      if (isCreatingCategory) {
        const novaCategoriaNome = formData.get('novaCategoria') as string;
        // Create the new category in the backend
        const novaCat = await upsertCategory({
          nome: novaCategoriaNome
        });
        finalCategoryId = novaCat.id;
      }

      // Upload image if provided
      let imagemUrl = editingProduct?.imagem || 'https://picsum.photos/seed/food/200/200';
      const file = formData.get('imagem_file') as File;
      if (file && file.size > 0) {
        const uploadFormData = new FormData();
        uploadFormData.append('image', file);
        try {
          const uploadedUrl = await uploadImageAction(uploadFormData);
          if (uploadedUrl) {
            imagemUrl = uploadedUrl;
          }
        } catch (uploadError) {
          console.error('Upload Error:', uploadError);
          toast.error('Ocorreu um erro ao fazer upload da imagem.');
        }
      }

      // Use "categorias" for NocoDB relation link
      const productData = {
        id: editingProduct?.id,
        nome: formData.get('nome') as string,
        categorias: finalCategoryId,
        preco: parseFloat(formData.get('preco') as string),
        descricao: formData.get('descricao') as string,
        disponivel: editingProduct ? editingProduct.disponivel : true,
        imagem: imagemUrl
      };

      const savedProduct = await upsertProduct(productData, selectedInsumos);

      if (selectedGrupos) {
        await updateGruposDoProduto(savedProduct.id, selectedGrupos);
      }

      if (selectedSlots) {
        await atualizarGruposSlotsDoProduto(Number(savedProduct.id), selectedSlots.map(s => Number(s)));
      }

      if (editingProduct) {
        setProducts(products.map(p => p.id === editingProduct.id ? savedProduct : p));
        toast.success('Produto atualizado com sucesso!');
      } else {
        setProducts([savedProduct, ...products]);
        toast.success('Produto criado com sucesso!');
      }

      // Refresh categories just in case
      const categoriesData = await getCategories();
      setCategories(categoriesData);

      setIsModalOpen(false);
      setEditingProduct(null);
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      toast.error('Erro ao salvar produto no servidor.');
    }
  };

  return (
    <div className="space-y-8">
      <header id="menu-header" className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Gestão de Cardápio</h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Crie, edite e organize seus produtos do catálogo WhatsApp.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setEditingCategory(null); setIsCategoryModalOpen(true); }}
            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm flex items-center gap-2 transition-all active:scale-95"
          >
            <Folder className="size-4 text-amber-500" />
            Gerenciar Categorias
          </button>
          <button
            onClick={startTour}
            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm flex items-center gap-2 transition-all active:scale-95"
          >
            <Sparkles className="size-4 text-amber-500" />
            Tour
          </button>
          <button
            id="btn-cadastro-massa"
            onClick={() => setIsBulkModalOpen(true)}
            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm flex items-center gap-2 transition-all active:scale-95"
          >
            <CheckCircle2 className="size-4 text-violet-500" />
            Cadastrar em Massa
          </button>
          <button
            id="btn-novo-produto"
            onClick={() => { setEditingProduct(null); setEditingProductInsumos([]); setEditingProductGrupos([]); setIsModalOpen(true); }}
            className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-primary/20 flex items-center gap-2 transition-all active:scale-95"
          >
            <Plus className="size-4" />
            Novo Produto
          </button>
        </div>
      </header>


      {/* Filters & Search */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div id="search-bar" className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-slate-400 transition-all outline-none"
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
              selectedCategoryId === 0 ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-50"
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
                selectedCategoryId === cat.id ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-50"
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
                    className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-4 space-y-4"
                  >
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Disponibilidade</label>
                      <select
                        value={availabilityFilter}
                        onChange={(e) => { setAvailabilityFilter(e.target.value); setCurrentPage(1); }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      >
                        <option value="all">Todos</option>
                        <option value="available">Apenas Disponíveis</option>
                        <option value="unavailable">Apenas Esgotados</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ordenar por</label>
                      <select
                        value={sortBy}
                        onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
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

      {/* Product Modal */}
      {isModalOpen && (
        <ProductFormModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingProduct(null); setEditingProductInsumos([]); setEditingProductGrupos([]); }}
          editingProduct={editingProduct}
          categories={categories}
          insumosList={insumosList}
          productInsumos={editingProductInsumos}
          gruposComplemento={gruposComplemento}
          productGrupos={[...editingProductGrupos, ...editingProductSlots]}
          gruposSlots={gruposSlots}
          onSubmit={handleSaveProduct}
        />
      )}

      {/* Category Management Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => { setIsCategoryModalOpen(false); setEditingCategory(null); }}
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900">{editingCategory ? 'Editar' : 'Nova'} Categoria</h2>
              <button
                type="button"
                onClick={() => { setIsCategoryModalOpen(false); setEditingCategory(null); }}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="size-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-4 sm:p-6 space-y-4">
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
                          onClick={() => handleDeleteCategory(cat.id)}
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
      )}

      {/* Bulk Complement Modal */}
      {isBulkModalOpen && (
        <BulkComplementModal
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          products={products}
          grupos={gruposComplemento}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
