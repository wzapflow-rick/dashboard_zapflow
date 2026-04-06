'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { X, ShoppingCart, Check, Plus, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from './cart-context';
import { toast } from 'sonner';

interface CompositeItem {
    id: number;
    nome: string;
    preco: number;
    imagem?: string;
}

interface CompositeProduct {
    id: string;
    _grupoId: number;
    nome: string;
    descricao?: string;
    imagem?: string;
    tipo_calculo?: string;
    cobrar_mais_caro?: boolean;
    minimo: number;
    maximo: number;
    items: CompositeItem[];
}

interface CompositeProductModalProps {
    product: CompositeProduct;
    whatsappNumber: string;
    empresaNome: string;
    onClose: () => void;
}

const fmt = (price: number) => `R$ ${price.toFixed(2).replace('.', ',')}`;

export default function CompositeProductModal({
    product,
    whatsappNumber,
    empresaNome,
    onClose,
}: CompositeProductModalProps) {
    const [selected, setSelected] = useState<CompositeItem[]>([]);
    const { addItem } = useCart();

    const max = Number(product.maximo || 1);
    const min = Number(product.minimo || 1);
    const isFull = selected.length >= max;

    const toggleItem = (item: CompositeItem) => {
        const already = selected.find(i => i.id === item.id);
        if (already) {
            setSelected(prev => prev.filter(i => i.id !== item.id));
        } else if (!isFull) {
            setSelected(prev => [...prev, item]);
        }
    };

    const finalPrice = useMemo(() => {
        if (selected.length === 0) {
            const prices = product.items.map(i => i.preco).filter(p => p > 0);
            return prices.length > 0 ? Math.min(...prices) : 0;
        }

        const prices = selected.map(i => i.preco);

        if (product.cobrar_mais_caro) {
            return Math.max(...prices);
        } else if (product.tipo_calculo === 'media') {
            return prices.reduce((a, b) => a + b, 0) / prices.length;
        } else if (product.tipo_calculo === 'maior_valor') {
            return Math.max(...prices);
        }
        
        return prices.reduce((a, b) => a + b, 0);
    }, [product, selected]);

    const isValid = selected.length >= min;

    const handleClose = () => {
        setSelected([]);
        onClose();
    };

    const addToCart = () => {
        if (!isValid) {
            toast.error(`Selecione pelo menos ${min} sabor(es)`);
            return;
        }

        addItem({
            productId: product._grupoId,
            nome: product.nome,
            preco: finalPrice,
            quantidade: 1,
            imagem: product.imagem,
            isComposite: true,
            grupoId: product._grupoId,
            isAvulso: false
        });

        toast.success(`${product.nome} adicionado ao carrinho!`);
        handleClose();
    };

    const priceRuleLabel = product.cobrar_mais_caro 
        ? 'Cobra o sabor mais caro'
        : product.tipo_calculo === 'media'
            ? 'Média dos sabores'
            : product.tipo_calculo === 'maior_valor'
                ? 'Maior valor'
                : 'Soma dos sabores';

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={handleClose}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />
                <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    <div className="relative h-48 shrink-0">
                        {product.imagem ? (
                            <Image
                                src={product.imagem}
                                alt={product.nome}
                                fill
                                className="object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                                <span className="text-6xl">🍕</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <button
                            onClick={handleClose}
                            className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full text-white transition-colors"
                        >
                            <X className="size-5" />
                        </button>
                        <div className="absolute bottom-4 left-6 right-6">
                            <h2 className="text-xl font-bold text-white">{product.nome}</h2>
                            <p className="text-white/80 text-xs">{priceRuleLabel}</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800">
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                            Selecionados: <strong>{selected.length}/{max}</strong>
                        </span>
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                            Mín: {min} | Máx: {max}
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                        {product.items?.map((item: CompositeItem) => {
                            const isSelected = selected.some(s => s.id === item.id);
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => toggleItem(item)}
                                    className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all ${
                                        isSelected
                                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                            : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                            isSelected ? 'border-green-500 bg-green-500' : 'border-slate-300 dark:border-slate-500'
                                        }`}>
                                            {isSelected && <Check className="size-3 text-white" />}
                                        </div>
                                        <span className="text-sm font-medium text-slate-900 dark:text-white">{item.nome}</span>
                                    </div>
                                    {Number(item.preco || 0) > 0 && (
                                        <span className="text-sm font-bold text-green-600 dark:text-green-400">
                                            {fmt(item.preco)}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="shrink-0 p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Total:</span>
                            <span className="text-xl font-black text-green-600 dark:text-green-400">{fmt(finalPrice)}</span>
                        </div>
                        <button
                            onClick={addToCart}
                            disabled={!isValid}
                            className="w-full py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                            <ShoppingCart className="size-5" />
                            Adicionar ao Carrinho
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
