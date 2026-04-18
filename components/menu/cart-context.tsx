'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';

export interface CartItem {
  id: string;
  productId: number;
  nome: string;
  preco: number;
  quantidade: number;
  imagem?: string;
  observacao?: string;
  complementos?: {
    grupoId: number;
    grupoNome: string;
    items: {
      id: number;
      nome: string;
      preco: number;
      fator_proporcao: number;
    }[];
  }[];
  isComposite?: boolean;
  grupoId?: number;
  isAvulso?: boolean;
}

interface CartContextType {
  items: CartItem[];
  cupom: { id?: number; codigo: string; desconto: number; tipo: string } | null;
  addItem: (item: Omit<CartItem, 'id'>) => void;
  updateItem: (id: string, item: Partial<CartItem>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantidade: number) => void;
  setCupom: (cupom: { id?: number; codigo: string; desconto: number; tipo: string } | null) => void;
  clearCart: () => void;
  subtotal: number;
  desconto: number;
  total: number;
  pontosGanhos: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | null>(null);

const CART_STORAGE_KEY = 'zapflow_cart';
const CUPOM_STORAGE_KEY = 'zapflow_cupom';

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}

export function CartProvider({ children, pontosPorReal = 1, empresaId }: { children: React.ReactNode; pontosPorReal?: number; empresaId?: number }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [cupom, setCupomState] = useState<{ id?: number; codigo: string; desconto: number; tipo: string } | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const savedItems = localStorage.getItem(`${CART_STORAGE_KEY}_${empresaId}`);
      const savedCupom = localStorage.getItem(`${CUPOM_STORAGE_KEY}_${empresaId}`);
      
      if (savedItems) {
        const parsed = JSON.parse(savedItems);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
      
      if (savedCupom) {
        const parsed = JSON.parse(savedCupom);
        if (parsed && parsed.codigo) {
          setCupomState(parsed);
        }
      }
    } catch (e) {
      console.error('Erro ao carregar carrinho:', e);
    }
    
    setIsLoaded(true);
  }, [empresaId]);

  // Save cart to localStorage when items change
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    
    try {
      if (items.length > 0) {
        localStorage.setItem(`${CART_STORAGE_KEY}_${empresaId}`, JSON.stringify(items));
      } else {
        localStorage.removeItem(`${CART_STORAGE_KEY}_${empresaId}`);
      }
    } catch (e) {
      console.error('Erro ao salvar carrinho:', e);
    }
  }, [items, empresaId, isLoaded]);

  // Save cupom to localStorage when it changes
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    
    try {
      if (cupom) {
        localStorage.setItem(`${CUPOM_STORAGE_KEY}_${empresaId}`, JSON.stringify(cupom));
      } else {
        localStorage.removeItem(`${CUPOM_STORAGE_KEY}_${empresaId}`);
      }
    } catch (e) {
      console.error('Erro ao salvar cupom:', e);
    }
  }, [cupom, empresaId, isLoaded]);

  const addItem = useCallback((item: Omit<CartItem, 'id'>) => {
    const id = `${item.productId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setItems(prev => [...prev, { ...item, id }]);
  }, []);

  const updateItem = useCallback((id: string, updatedItem: Partial<CartItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updatedItem } : item));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantidade: number) => {
    if (quantidade <= 0) {
      removeItem(id);
      return;
    }
    setItems(prev => prev.map(item => item.id === id ? { ...item, quantidade } : item));
  }, [removeItem]);

  const setCupom = useCallback((cupomData: { id?: number; codigo: string; desconto: number; tipo: string } | null) => {
    setCupomState(cupomData);
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setCupomState(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`${CART_STORAGE_KEY}_${empresaId}`);
      localStorage.removeItem(`${CUPOM_STORAGE_KEY}_${empresaId}`);
    }
  }, [empresaId]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
  }, [items]);

  const desconto = useMemo(() => {
    if (!cupom) return 0;
    if (cupom.tipo === 'percentual') {
      return subtotal * (cupom.desconto / 100);
    }
    return Math.min(cupom.desconto, subtotal);
  }, [cupom, subtotal]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - desconto);
  }, [subtotal, desconto]);

  const pontosGanhos = useMemo(() => {
    return Math.floor(total * pontosPorReal);
  }, [total, pontosPorReal]);

  const itemCount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantidade, 0);
  }, [items]);

  return (
    <CartContext.Provider value={{
      items,
      cupom,
      addItem,
      updateItem,
      removeItem,
      updateQuantity,
      setCupom,
      clearCart,
      subtotal,
      desconto,
      total,
      pontosGanhos,
      itemCount
    }}>
      {children}
    </CartContext.Provider>
  );
}
