'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface CartItem {
  id: string;
  productId: number;
  nome: string;
  preco: number;
  quantidade: number;
  imagem?: string;
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
}

interface CartContextType {
  items: CartItem[];
  cupom: { codigo: string; desconto: number; tipo: string } | null;
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantidade: number) => void;
  setCupom: (cupom: { codigo: string; desconto: number; tipo: string } | null) => void;
  clearCart: () => void;
  subtotal: number;
  desconto: number;
  total: number;
  pontosGanhos: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}

export function CartProvider({ children, pontosPorReal = 1 }: { children: React.ReactNode; pontosPorReal?: number }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [cupom, setCupomState] = useState<{ codigo: string; desconto: number; tipo: string } | null>(null);

  const addItem = useCallback((item: Omit<CartItem, 'id'>) => {
    const id = `${item.productId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setItems(prev => [...prev, { ...item, id }]);
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

  const setCupom = useCallback((cupomData: { codigo: string; desconto: number; tipo: string } | null) => {
    setCupomState(cupomData);
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setCupomState(null);
  }, []);

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
