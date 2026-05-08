'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { X, Plus, Minus, Trash2, Search, Package, Save, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { updateOrderItems } from '@/app/actions/orders';
import { getProducts } from '@/app/actions/products';

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onSuccess?: () => void;
}

interface OrderItem {
  id: number;
  produto: string;
  nome?: string;
  preco: number;
  quantidade: number;
  subtotal: number;
  observacao?: string;
}

const formatPrice = (price: number) => `R$ ${Number(price || 0).toFixed(2).replace('.', ',')}`;

export default function EditOrderModal({ isOpen, onClose, order, onSuccess }: EditOrderModalProps) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [observacao, setObservacao] = useState('');

  // Carregar itens do pedido quando abrir
  useEffect(() => {
    if (isOpen && order) {
      let parsedItems: OrderItem[] = [];
      try {
        if (typeof order.itens === 'string') {
          parsedItems = JSON.parse(order.itens);
        } else if (Array.isArray(order.itens)) {
          parsedItems = order.itens;
        }
      } catch (e) {
        parsedItems = [];
      }
      
      // Normalizar itens - tentar multiplos nomes de campos para preco
      const normalized = parsedItems.map((item: any, idx: number) => {
        // Tentar extrair preco de diferentes campos possiveis
        const preco = Number(item.preco) || 
                      Number(item.preco_unitario) || 
                      Number(item.valor_unitario) || 
                      Number(item.valor) ||
                      (item.subtotal && item.quantidade ? Number(item.subtotal) / Number(item.quantidade) : 0) ||
                      0;
        
        const quantidade = Number(item.quantidade) || Number(item.qtd) || 1;
        
        return {
          id: item.id || item.produto_id || idx,
          produto: item.produto || item.nome || item.name || 'Item',
          nome: item.nome || item.produto || item.name,
          preco: preco,
          quantidade: quantidade,
          subtotal: Number(item.subtotal) || (preco * quantidade),
          observacao: item.observacao || item.obs || '',
        };
      });
      
      setItems(normalized);
      setObservacao('');
    }
  }, [isOpen, order]);

  // Carregar produtos da empresa
  useEffect(() => {
    if (isOpen) {
      getProducts()
        .then(prods => setProducts(prods.filter((p: any) => p.disponivel)))
        .catch(err => console.error('Erro ao carregar produtos:', err));
    }
  }, [isOpen]);

  // Calcular total
  const total = items.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);

  // Filtrar produtos para busca
  const filteredProducts = products.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !items.some(item => item.id === p.id)
  );

  // Handlers
  const handleQuantityChange = (index: number, delta: number) => {
    setItems(prev => {
      const updated = [...prev];
      const newQty = Math.max(1, updated[index].quantidade + delta);
      updated[index] = {
        ...updated[index],
        quantidade: newQty,
        subtotal: updated[index].preco * newQty
      };
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.error('O pedido precisa ter pelo menos 1 item');
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddProduct = (product: any) => {
    const newItem: OrderItem = {
      id: product.id,
      produto: product.nome,
      nome: product.nome,
      preco: Number(product.preco),
      quantidade: 1,
      subtotal: Number(product.preco),
    };
    setItems(prev => [...prev, newItem]);
    setSearchTerm('');
    setShowProductSearch(false);
    toast.success(`${product.nome} adicionado`);
  };

  const handleSave = () => {
    if (items.length === 0) {
      toast.error('O pedido precisa ter pelo menos 1 item');
      return;
    }

    startTransition(async () => {
      try {
        // Prepara os itens no formato correto
        const formattedItems = items.map(item => ({
          id: item.id,
          produto: item.produto,
          nome: item.nome || item.produto,
          preco: item.preco,
          quantidade: item.quantidade,
          subtotal: item.preco * item.quantidade,
          observacao: item.observacao,
        }));

        await updateOrderItems(order.id, formattedItems, total, observacao || undefined);
        toast.success('Pedido atualizado com sucesso');
        onSuccess?.();
        onClose();
      } catch (error: any) {
        toast.error(error.message || 'Erro ao atualizar pedido');
      }
    });
  };

  if (!order) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-amber-500/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="size-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                  <Package className="size-5 text-amber-500" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white">Editar Pedido #{order.id}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {order.cliente_nome || order.nome_cliente || 'Cliente'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="size-5 text-slate-400 dark:text-slate-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Lista de Itens */}
              <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">
                  Itens do Pedido ({items.length})
                </h3>
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div 
                      key={`${item.id}-${idx}`} 
                      className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600"
                    >
                      {/* Mobile: Layout empilhado */}
                      <div className="flex items-start justify-between gap-2 mb-2 sm:mb-0">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white truncate">
                            {item.produto}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {formatPrice(item.preco)} cada
                          </p>
                        </div>
                        {/* Remover - visivel em mobile no topo */}
                        <button
                          onClick={() => handleRemoveItem(idx)}
                          className="size-8 flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors sm:hidden"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      
                      {/* Controles de quantidade e subtotal */}
                      <div className="flex items-center justify-between gap-2 sm:gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleQuantityChange(idx, -1)}
                            className="size-9 sm:size-8 flex items-center justify-center bg-slate-100 dark:bg-slate-600 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-500 transition-colors"
                          >
                            <Minus className="size-4 text-slate-600 dark:text-slate-300" />
                          </button>
                          <span className="w-8 text-center font-bold text-slate-900 dark:text-white">
                            {item.quantidade}
                          </span>
                          <button
                            onClick={() => handleQuantityChange(idx, 1)}
                            className="size-9 sm:size-8 flex items-center justify-center bg-slate-100 dark:bg-slate-600 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-500 transition-colors"
                          >
                            <Plus className="size-4 text-slate-600 dark:text-slate-300" />
                          </button>
                        </div>

                        {/* Subtotal e remover (desktop) */}
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white text-right">
                            {formatPrice(item.preco * item.quantidade)}
                          </span>
                          <button
                            onClick={() => handleRemoveItem(idx)}
                            className="size-8 items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors hidden sm:flex"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Adicionar Produto */}
              <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">
                  Adicionar Produto
                </h3>
                
                {!showProductSearch ? (
                  <button
                    onClick={() => setShowProductSearch(true)}
                    className="w-full p-3 border-2 border-dashed border-slate-300 dark:border-slate-500 rounded-lg text-slate-500 dark:text-slate-400 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="size-4" />
                    Adicionar item ao pedido
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar produto..."
                        autoFocus
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400"
                      />
                    </div>
                    
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {filteredProducts.length > 0 ? (
                        filteredProducts.slice(0, 10).map(product => (
                          <button
                            key={product.id}
                            onClick={() => handleAddProduct(product)}
                            className="w-full p-2 text-left hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors flex justify-between items-center"
                          >
                            <span className="text-slate-900 dark:text-white">{product.nome}</span>
                            <span className="text-slate-500 dark:text-slate-400">{formatPrice(product.preco)}</span>
                          </button>
                        ))
                      ) : (
                        <p className="text-center text-slate-500 dark:text-slate-400 py-2">
                          {searchTerm ? 'Nenhum produto encontrado' : 'Digite para buscar'}
                        </p>
                      )}
                    </div>
                    
                    <button
                      onClick={() => {
                        setShowProductSearch(false);
                        setSearchTerm('');
                      }}
                      className="w-full p-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>

              {/* Observacao da edicao */}
              <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">
                  Motivo da Alteracao (opcional)
                </h3>
                <input
                  type="text"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex: Cliente pediu para adicionar mais itens"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400"
                />
              </div>

              {/* Resumo */}
              <div className="bg-primary/5 dark:bg-primary/10 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Valor anterior</p>
                    <p className="text-slate-500 dark:text-slate-400 line-through">
                      {formatPrice(order.valor_total)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Novo total</p>
                    <p className="text-2xl font-bold text-primary">
                      {formatPrice(total)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 flex gap-3">
              <button
                onClick={onClose}
                disabled={isPending}
                className="flex-1 px-4 py-3 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-medium hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isPending || items.length === 0}
                className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    Salvar Alteracoes
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
