'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, Plus, Minus, ShoppingCart, Loader2, Check, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getProducts, getCategories, type Category } from '@/app/actions/products';
import { getCompositeProducts, type CompositeProduct, type CompositeItem } from '@/app/actions/grupos-slots';
import { createTableOrder } from '@/app/actions/tables';
import { toast } from 'sonner';
import { type MesaComDetalhes, type ComandaComPedidos } from '@/app/actions/tables';

interface Product {
  id: number;
  nome: string;
  preco: number;
  categoria_id?: number | string;
  imagem?: string;
}

interface CartItem extends Product {
  quantidade: number;
  observacao?: string;
  isComposite?: boolean;
  compositeItems?: CompositeItem[];
  compositeId?: string;
}

interface TableOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  comanda: ComandaComPedidos;
  mesa: MesaComDetalhes;
}

export default function TableOrderModal({
  isOpen,
  onClose,
  onSuccess,
  comanda,
  mesa,
}: TableOrderModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [compositeProducts, setCompositeProducts] = useState<CompositeProduct[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isCompositeModalOpen, setIsCompositeModalOpen] = useState(false);
  const [selectedComposite, setSelectedComposite] = useState<CompositeProduct | null>(null);
  const [selectedItems, setSelectedItems] = useState<CompositeItem[]>([]);
  const [addedProductId, setAddedProductId] = useState<number | null>(null);
  
  // Estado para modal de observacao
  const [isObsModalOpen, setIsObsModalOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen]);

  const fetchProducts = async () => {
    try {
      const [productsData, categoriesData, compositeData] = await Promise.all([
        getProducts(),
        getCategories(),
        getCompositeProducts(),
      ]);
      setProducts(productsData);
      setCategories(categoriesData.sort((a, b) => (a.ordem || 0) - (b.ordem || 0)));
      setCompositeProducts(compositeData);
    } catch (error) {
      toast.error('Erro ao buscar produtos');
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // Abre modal de observacao antes de adicionar ao carrinho
  const handleProductClick = (product: Product) => {
    setPendingProduct(product);
    setObservacao('');
    setIsObsModalOpen(true);
  };

  // Adiciona produto ao carrinho (com ou sem observacao)
  const addToCart = (product: Product, obs?: string) => {
    setCart((prev) => {
      // Se tem observacao, sempre adiciona como item novo
      if (obs && obs.trim()) {
        return [...prev, { ...product, quantidade: 1, observacao: obs.trim() }];
      }
      
      // Se nao tem observacao, agrupa com item existente sem observacao
      const existing = prev.find((item) => item.id === product.id && !item.isComposite && !item.observacao);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id && !item.isComposite && !item.observacao
            ? { ...item, quantidade: item.quantidade + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantidade: 1 }];
    });
    
    // Feedback visual
    setAddedProductId(product.id);
    toast.success(`${product.nome} adicionado!`, { duration: 1500 });
    setTimeout(() => setAddedProductId(null), 600);
  };

  // Confirma adicao do produto com observacao
  const confirmAddToCart = () => {
    if (pendingProduct) {
      addToCart(pendingProduct, observacao);
      setIsObsModalOpen(false);
      setPendingProduct(null);
      setObservacao('');
    }
  };

  // Adiciona sem observacao (botao rapido)
  const addWithoutObs = () => {
    if (pendingProduct) {
      addToCart(pendingProduct);
      setIsObsModalOpen(false);
      setPendingProduct(null);
      setObservacao('');
    }
  };

  const removeFromCart = (productId: number, isComposite?: boolean) => {
    setCart((prev) => {
      const existing = prev.find(
        (item) => item.id === productId && item.isComposite === isComposite
      );
      if (existing && existing.quantidade > 1) {
        return prev.map((item) =>
          item.id === productId && item.isComposite === isComposite
            ? { ...item, quantidade: item.quantidade - 1 }
            : item
        );
      }
      return prev.filter(
        (item) => !(item.id === productId && item.isComposite === isComposite)
      );
    });
  };

  const total = cart.reduce((acc, item) => acc + item.preco * item.quantidade, 0);

  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error('Adicione pelo menos um produto');
      return;
    }

    setIsSubmitting(true);
    try {
      const itensJson = cart.map((item) => {
        const baseItem = {
          id: item.id,
          produto: item.nome,
          remocoes: [],
          adicionais: [],
          quantidade: item.quantidade,
          preco_unitario: item.preco,
          observacao: item.observacao || '',
        };

        if (item.isComposite && item.compositeItems) {
          return {
            ...baseItem,
            complements: item.compositeItems.map((comp) => ({
              id: comp.id,
              grupo_id: comp.grupo_id,
              nome: comp.nome,
              fator_proporcao: comp.fator_proporcao,
            })),
            compositeId: item.compositeId,
            isComposite: true,
          };
        }

        return baseItem;
      });

      await createTableOrder({
        comanda_id: comanda.id,
        mesa_id: mesa.id,
        numero_mesa: mesa.numero,
        cliente_nome: comanda.nome_cliente || undefined,
        itens: JSON.stringify(itensJson),
        valor_total: total,
      });

      toast.success('Pedido enviado para a cozinha!');
      setCart([]);
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao criar pedido:', error);
      toast.error(error.message || 'Erro ao criar pedido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.nome.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === null || String(p.categoria_id) === String(selectedCategory);
    return matchesSearch && matchesCategory;
  });
  
  const filteredComposite = compositeProducts.filter((p) =>
    p.nome.toLowerCase().includes(search.toLowerCase())
  );

  // Agrupar produtos por categoria
  const productsByCategory = categories.reduce((acc, cat) => {
    const catProducts = filteredProducts.filter(p => String(p.categoria_id) === String(cat.id));
    if (catProducts.length > 0) {
      acc[cat.id] = { nome: cat.nome, produtos: catProducts };
    }
    return acc;
  }, {} as Record<number, { nome: string; produtos: Product[] }>);

  // Produtos sem categoria
  const uncategorizedProducts = filteredProducts.filter(p => !p.categoria_id || !categories.find(c => String(c.id) === String(p.categoria_id)));
  if (uncategorizedProducts.length > 0) {
    productsByCategory[0] = { nome: 'Outros', produtos: uncategorizedProducts };
  }

  const openCompositeModal = (composite: CompositeProduct) => {
    setSelectedComposite(composite);
    setSelectedItems([]);
    setIsCompositeModalOpen(true);
  };

  const toggleItemSelection = (item: CompositeItem) => {
    setSelectedItems((prev) => {
      const isSelected = prev.some((i) => i.id === item.id);
      if (isSelected) {
        return prev.filter((i) => i.id !== item.id);
      } else {
        if (selectedComposite && prev.length >= selectedComposite.maximo) {
          toast.warning(`Maximo de ${selectedComposite.maximo} itens permitidos.`);
          return prev;
        }
        return [...prev, item];
      }
    });
  };

  const handleAddCompositeToCart = () => {
    if (!selectedComposite || selectedItems.length === 0) return;

    let price = 0;
    if (selectedComposite.tipo_calculo === 'fixo') {
      price = selectedComposite.preco_fixo || 0;
    } else {
      const prices = selectedItems.map((i) => i.preco);
      if (selectedComposite.cobrar_mais_caro || selectedComposite.tipo_calculo === 'maior_valor') {
        price = Math.max(...prices);
      } else if (selectedComposite.tipo_calculo === 'media') {
        price = prices.reduce((a, b) => a + b, 0) / prices.length;
      } else {
        price = selectedItems.reduce((total, i) => total + i.preco * i.fator_proporcao, 0);
      }
    }

    const cartItem: CartItem = {
      id: selectedComposite._grupoId,
      nome: selectedComposite.nome,
      preco: price,
      quantidade: 1,
      isComposite: true,
      compositeItems: selectedItems,
      compositeId: selectedComposite.id,
    };

    setCart((prev) => [...prev, cartItem]);
    setIsCompositeModalOpen(false);
    setSelectedComposite(null);
    setSelectedItems([]);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl h-[85vh] bg-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row"
        >
          {/* Products List */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-slate-700">
            <header className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Novo Pedido - Mesa {mesa.numero}
                </h2>
                <p className="text-sm text-slate-400">
                  {comanda.nome_cliente || `Comanda #${comanda.id}`}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors md:hidden"
              >
                <X className="size-5 text-slate-400" />
              </button>
            </header>

            <div className="p-3 bg-slate-900/50 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 size-4" />
                <input
                  type="text"
                  placeholder="Buscar produto..."
                  className="w-full h-10 pl-10 pr-4 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {/* Category Filter */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                    selectedCategory === null
                      ? 'bg-primary text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Todos
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-primary text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {cat.nome}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {isLoadingProducts ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="size-8 text-primary animate-spin" />
                </div>
              ) : (
                <>
                  {/* Produtos organizados por categoria */}
                  {Object.entries(productsByCategory).map(([catId, { nome, produtos }]) => (
                    <div key={catId}>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1 flex items-center gap-2">
                        <span className="w-2 h-2 bg-primary rounded-full"></span>
                        {nome}
                        <span className="text-slate-600">({produtos.length})</span>
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {produtos.map((p) => {
                                          const isAdded = addedProductId === p.id;
                                          return (
                                          <button
                                            key={p.id}
                                            onClick={() => handleProductClick(p)}
                                            className={`group p-3 bg-slate-900/50 border rounded-lg text-left transition-all flex items-center justify-between gap-2 ${
                                              isAdded 
                                                ? 'border-green-500 bg-green-500/10 scale-[0.98]' 
                                                : 'border-slate-700 hover:border-primary/50 hover:bg-slate-900'
                                            }`}
                                          >
                                            <div className="min-w-0">
                                              <h4 className={`font-semibold text-sm truncate transition-colors ${
                                                isAdded ? 'text-green-400' : 'text-white group-hover:text-primary'
                                              }`}>
                                                {p.nome}
                                              </h4>
                                              <span className="text-xs text-slate-500">
                                                R$ {Number(p.preco).toFixed(2).replace('.', ',')}
                                              </span>
                                            </div>
                                            <div className={`size-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                                              isAdded 
                                                ? 'bg-green-500 text-white' 
                                                : 'bg-slate-800 text-slate-400 group-hover:bg-primary group-hover:text-white'
                                            }`}>
                                              {isAdded ? <Check className="size-4" /> : <Plus className="size-4" />}
                                            </div>
                                          </button>
                                        );})}
                      </div>
                    </div>
                  ))}

                  {filteredComposite.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">
                        Compostos
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {filteredComposite.map((comp) => (
                          <button
                            key={comp.id}
                            onClick={() => openCompositeModal(comp)}
                            className="group p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-left hover:border-amber-500/50 transition-all flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <h4 className="font-semibold text-amber-400 text-sm truncate">
                                {comp.nome}
                              </h4>
                              <span className="text-xs text-amber-500/70">
                                {comp.minimo === comp.maximo
                                  ? `${comp.maximo} item(s)`
                                  : `${comp.minimo}-${comp.maximo} itens`}
                              </span>
                            </div>
                            <div className="size-7 bg-amber-500/20 rounded-lg flex items-center justify-center text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-all">
                              <Plus className="size-4" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {Object.keys(productsByCategory).length === 0 && filteredComposite.length === 0 && (
                    <div className="text-center py-10 text-slate-500">
                      Nenhum produto encontrado
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Cart */}
          <div className="w-full md:w-80 flex flex-col bg-slate-900">
            <header className="p-4 border-b border-slate-700 flex items-center gap-2">
              <ShoppingCart className="size-5 text-primary" />
              <span className="font-semibold text-white">Carrinho</span>
              <AnimatePresence mode="wait">
                {cart.length > 0 && (
                  <motion.span
                    key={cart.reduce((acc, i) => acc + i.quantidade, 0)}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="ml-auto px-2 py-0.5 bg-primary/20 text-primary text-xs font-bold rounded-full"
                  >
                    {cart.reduce((acc, i) => acc + i.quantidade, 0)}
                  </motion.span>
                )}
              </AnimatePresence>
            </header>

            <div className="flex-1 overflow-y-auto p-3">
              {cart.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  Carrinho vazio
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map((item, idx) => (
                    <div
                      key={`${item.id}-${idx}`}
                      className="p-3 bg-slate-800 rounded-lg border border-slate-700"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {item.nome}
                          </p>
                          {item.isComposite && item.compositeItems && (
                            <p className="text-xs text-slate-400 truncate">
                              {item.compositeItems.map((c) => c.nome).join(', ')}
                            </p>
                          )}
                          {item.observacao && (
                            <p className="text-xs text-amber-400 flex items-center gap-1 mt-1">
                              <MessageSquare className="size-3" />
                              {item.observacao}
                            </p>
                          )}
                        </div>
                        <span className="text-sm font-bold text-primary shrink-0">
                          R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => removeFromCart(item.id, item.isComposite)}
                          className="size-7 bg-slate-700 rounded flex items-center justify-center text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="text-sm font-bold text-white w-8 text-center">
                          {item.quantidade}
                        </span>
                        <button
                          onClick={() => addToCart(item)}
                          className="size-7 bg-slate-700 rounded flex items-center justify-center text-slate-300 hover:bg-primary/20 hover:text-primary transition-colors"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total</span>
                <span className="text-xl font-bold text-white">
                  R$ {total.toFixed(2).replace('.', ',')}
                </span>
              </div>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || cart.length === 0}
                className="w-full py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="size-4" />
                    Enviar Pedido
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Composite Modal */}
        <AnimatePresence>
          {isCompositeModalOpen && selectedComposite && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[250] flex items-center justify-center p-4"
            >
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => setIsCompositeModalOpen(false)}
              />
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="relative w-full max-w-md bg-slate-800 rounded-xl shadow-xl overflow-hidden"
              >
                <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white">{selectedComposite.nome}</h3>
                    <p className="text-xs text-slate-400">
                      Selecione{' '}
                      {selectedComposite.minimo === selectedComposite.maximo
                        ? selectedComposite.maximo
                        : `${selectedComposite.minimo} a ${selectedComposite.maximo}`}{' '}
                      item(s)
                    </p>
                  </div>
                  <button
                    onClick={() => setIsCompositeModalOpen(false)}
                    className="p-2 hover:bg-slate-700 rounded-lg"
                  >
                    <X className="size-4 text-slate-400" />
                  </button>
                </div>

                <div className="p-4 max-h-[50vh] overflow-y-auto space-y-2">
                  {selectedComposite.items.map((item) => {
                    const isSelected = selectedItems.some((i) => i.id === item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleItemSelection(item)}
                        className={`w-full p-3 rounded-lg border text-left transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-primary/20 border-primary'
                            : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <span className="text-sm font-medium text-white">{item.nome}</span>
                        <span className="text-sm text-slate-400">
                          R$ {item.preco.toFixed(2).replace('.', ',')}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="p-4 border-t border-slate-700">
                  <button
                    onClick={handleAddCompositeToCart}
                    disabled={selectedItems.length < selectedComposite.minimo}
                    className="w-full py-2.5 bg-primary text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                  >
                    Adicionar ao Carrinho
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal de Observacao */}
        <AnimatePresence>
          {isObsModalOpen && pendingProduct && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[260] flex items-center justify-center p-4"
            >
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => {
                  setIsObsModalOpen(false);
                  setPendingProduct(null);
                }}
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative w-full max-w-sm bg-slate-800 rounded-xl shadow-xl overflow-hidden"
              >
                <div className="p-4 border-b border-slate-700">
                  <h3 className="font-bold text-white">{pendingProduct.nome}</h3>
                  <p className="text-sm text-slate-400">
                    R$ {Number(pendingProduct.preco).toFixed(2).replace('.', ',')}
                  </p>
                </div>

                <div className="p-4">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Observacao (opcional)
                  </label>
                  <textarea
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="Ex: Sem cebola, bem passado, etc..."
                    className="w-full h-24 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                    autoFocus
                  />
                </div>

                <div className="p-4 border-t border-slate-700 flex gap-2">
                  <button
                    onClick={addWithoutObs}
                    className="flex-1 py-2.5 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-600 transition-colors"
                  >
                    Sem Obs.
                  </button>
                  <button
                    onClick={confirmAddToCart}
                    className="flex-1 py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="size-4" />
                    Adicionar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
}
