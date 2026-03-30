'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import {
  getProducts,
  getCategories,
  updateProductAvailability,
  deleteProduct,
  upsertProduct,
  upsertCategory,
  uploadImageAction,
  type Category
} from '@/app/actions/products';
import { getGruposComplementos, getGruposDoProduto, updateGruposDoProduto } from '@/app/actions/complements';
import { getInsumos, getReceitaDoProduto, getTodasReceitas, type Insumo } from '@/app/actions/insumos';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(0); // 0 means 'Todos'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [insumosList, setInsumosList] = useState<Insumo[]>([]);
  const [productRecipes, setProductRecipes] = useState<any[]>([]);
  const [editingProductInsumos, setEditingProductInsumos] = useState<{ insumo_id: number; quantidade_necessaria: number }[]>([]);
  const [gruposComplemento, setGruposComplemento] = useState<any[]>([]);
  const [editingProductGrupos, setEditingProductGrupos] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState('recent');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
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
      const [productsData, categoriesData, insumosData, receitasData, gruposData] = await Promise.all([
        getProducts(),
        getCategories(),
        getInsumos(),
        getTodasReceitas(),
        getGruposComplementos()
      ]);
      setProducts(productsData);
      setCategories(categoriesData);
      setInsumosList(insumosData);
      setProductRecipes(receitasData);
      setGruposComplemento(gruposData);
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
  const toggleDisponibilidade = async (produtoId: number, statusAtual: boolean) => {
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

  const handleDelete = async (id: number) => {
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
      const prodGrupos = await getGruposDoProduto(product.id);
      setEditingProductGrupos(prodGrupos.map((g: any) => g.grupo_id));
    } catch {
      setEditingProductGrupos([]);
    }
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (formData: FormData, isCreatingCategory: boolean, selectedInsumos?: { insumo_id: number, quantidade_necessaria: number }[], selectedGrupos?: number[]) => {
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
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Gestão de Cardápio</h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Crie, edite e organize seus produtos do catálogo WhatsApp.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm flex items-center gap-2 transition-all active:scale-95"
          >
            <CheckCircle2 className="size-4 text-violet-500" />
            Cadastrar em Massa
          </button>
          <button
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
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-slate-400 transition-all outline-none"
            placeholder="Buscar por nome ou código..."
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-2 md:pb-0 no-scrollbar flex-1">
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
          <div className="relative">
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
          productGrupos={editingProductGrupos}
          onSubmit={handleSaveProduct}
        />
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
