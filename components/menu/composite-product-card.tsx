'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { X, ShoppingCart, Check, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from './cart-context';
import { toast } from 'sonner';

interface CompositeItem {
    id: number;
    nome: string;
    preco: number;
    descricao?: string;
    imagem?: string;
    fator_proporcao: number;
    grupo_id: number;
}

interface CompositeProduct {
    id: string;
    _grupoId: number;
    _isComposite: true;
    nome: string;
    descricao?: string;
    imagem?: string;
    tipo_calculo?: string;
    cobrar_mais_caro?: boolean;
    preco_fixo?: number;
    completamentos_ids?: number[];
    minimo: number;
    maximo: number;
    items: CompositeItem[];
}

interface Props {
    product: CompositeProduct;
    whatsappNumber: string;
    empresaNome: string;
    onClose?: () => void;
}

const fmt = (price: number) => `R$ ${price.toFixed(2).replace('.', ',')}`;

export default function CompositeProductCard({ product, whatsappNumber, empresaNome, onClose }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [selected, setSelected] = useState<CompositeItem[]>([]);
    const { addItem } = useCart();

    // Open modal when product is selected from the filter
    useEffect(() => {
        if (onClose) {
            setIsOpen(true);
        }
    }, [onClose]);

    const handleClose = () => {
        setIsOpen(false);
        setSelected([]);
        if (onClose) onClose();
    };

    const max = Number(product.maximo || 1);
    const min = Number(product.minimo || 1);
    const isFull = selected.length >= max;

    const toggleItem = (item: CompositeItem) => {
        const already = selected.find(i => i.id === item.id);
        if (already) {
            setSelected(prev => prev.filter(i => i.id !== item.id));
        } else {
            if (isFull) {
                if (max === 1) setSelected([item]);
                return; // block adding more
            }
            setSelected(prev => [...prev, item]);
        }
    };

    // Calcula o preço baseado na regra configurada
    const finalPrice = useMemo(() => {
        if (selected.length === 0) {
            // Mostra o preço base a partir do item mais barato disponível
            const prices = product.items.map(i => i.preco).filter(p => p > 0);
            if (prices.length === 0) return 0;
            if (product.tipo_calculo === 'fixo') {
                return product.preco_fixo || 0;
            }
            return Math.min(...prices);
        }
        
        if (product.tipo_calculo === 'fixo') {
            return product.preco_fixo || 0;
        }
        
        const prices = selected.map(i => i.preco);
        if (product.cobrar_mais_caro || product.tipo_calculo === 'maior_valor') {
            return Math.max(...prices);
        }
        if (product.tipo_calculo === 'media') {
            return prices.reduce((a, b) => a + b, 0) / prices.length;
        }
        // soma ponderada por fator de proporção
        return selected.reduce((total, i) => total + (i.preco * i.fator_proporcao), 0);
    }, [selected, product]);

    const isValid = selected.length >= min;

    const handleAddToCart = () => {
        if (!isValid) return;
        
        addItem({
            productId: product._grupoId,
            nome: product.nome,
            preco: finalPrice,
            quantidade: 1,
            imagem: product.imagem,
            isComposite: true,
            grupoId: product._grupoId,
            complementos: [{
                grupoId: product._grupoId,
                grupoNome: product.nome,
                items: selected.map(i => ({
                    id: i.id,
                    nome: i.nome,
                    preco: i.preco,
                    fator_proporcao: i.fator_proporcao
                }))
            }]
        });
        
        toast.success(`${product.nome} adicionado ao carrinho!`);
        setIsOpen(false);
        setSelected([]);
    };

    // Label da regra de preço
    const priceRuleLabel = product.tipo_calculo === 'fixo'
        ? `Preço fixo: R$ ${(product.preco_fixo || 0).toFixed(2)}`
        : product.cobrar_mais_caro
            ? 'Cobrado pelo sabor mais caro'
            : product.tipo_calculo === 'maior_valor'
                ? 'Cobrado pelo maior valor'
                : product.tipo_calculo === 'media'
                    ? 'Preço: média dos sabores'
                    : 'Preço: soma dos sabores';

    return (
        <>
            <button onClick={() => setIsOpen(true)} className="w-full text-left">
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-amber-100 dark:border-amber-700 shadow-sm p-4 flex gap-4 hover:shadow-md hover:border-amber-200 dark:hover:border-amber-600 transition-all cursor-pointer">
                    <div className="relative size-20 rounded-xl overflow-hidden bg-amber-50 dark:bg-amber-900/30 shrink-0 flex items-center justify-center">
                        {product.imagem ? (
                            <Image
                                src={product.imagem}
                                alt={product.nome}
                                fill
                                className="object-cover"
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <span className="text-3xl">🍕</span>
                        )}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">{product.nome}</h3>
                        {product.descricao && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{product.descricao}</p>
                        )}
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-medium">{priceRuleLabel}</p>
                        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                            <span className="text-base font-black text-amber-600 dark:text-amber-400">
                                {selected.length > 0 ? fmt(finalPrice) : `A partir de ${fmt(finalPrice)}`}
                            </span>
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 px-3 py-1.5 rounded-lg transition-all">
                                Montar 🍕
                            </span>
                        </div>
                    </div>
                </div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => { setIsOpen(false); setSelected([]); }}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-700"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-start justify-between gap-4 bg-gradient-to-r from-amber-50 dark:from-amber-900/30 to-orange-50 dark:to-orange-900/30 shrink-0">
                                <div>
                                    <div className="text-3xl mb-1">🍕</div>
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{product.nome}</h2>
                                    {product.descricao && (
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{product.descricao}</p>
                                    )}
                                    <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-700 dark:text-amber-400 font-medium bg-amber-100 dark:bg-amber-900/50 w-fit px-2 py-1 rounded-lg">
                                        <Info className="size-3" />
                                        {priceRuleLabel}
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setIsOpen(false); setSelected([]); }}
                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors shrink-0"
                                >
                                    <X className="size-5 text-slate-500 dark:text-slate-400" />
                                </button>
                            </div>

                            {/* Instruction banner */}
                            <div className="px-6 py-3 bg-violet-50 dark:bg-violet-900/30 border-b border-violet-100 dark:border-violet-800 shrink-0">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold text-violet-800 dark:text-violet-300">
                                        Escolha {min === max ? max : `${min} a ${max}`} sabore{max > 1 ? 's' : ''}
                                    </p>
                                    <div className="flex gap-1">
                                        {Array.from({ length: max }).map((_, idx) => (
                                            <div
                                                key={idx}
                                                className={`size-3 rounded-full border-2 transition-all ${idx < selected.length
                                                    ? 'bg-violet-500 border-violet-500'
                                                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Flavor list */}
                            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2 custom-scrollbar">
                                {product.items.length === 0 ? (
                                    <p className="text-center text-slate-400 dark:text-slate-500 py-8">Nenhuma opção disponível.</p>
                                ) : (
                                    product.items.map((item) => {
                                        const isSelected = !!selected.find(i => i.id === item.id);
                                        const canAdd = !isFull || isSelected;

                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => canAdd ? toggleItem(item) : undefined}
                                                disabled={!canAdd && !isSelected}
                                                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${isSelected
                                                    ? 'border-violet-400 dark:border-violet-600 bg-violet-50 dark:bg-violet-900/30 ring-1 ring-violet-200 dark:ring-violet-700'
                                                    : canAdd
                                                        ? 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 hover:border-violet-200 dark:hover:border-violet-600 hover:bg-violet-50/40 dark:hover:bg-violet-900/20'
                                                        : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 opacity-40 cursor-not-allowed'
                                                    }`}
                                            >
                                                {/* Flavor image or emoji */}
                                                <div className="size-12 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-600 shrink-0 flex items-center justify-center">
                                                    {item.imagem ? (
                                                        <Image src={item.imagem} alt={item.nome} width={48} height={48} className="object-cover w-full h-full" referrerPolicy="no-referrer" />
                                                    ) : (
                                                        <span className="text-lg">🍕</span>
                                                    )}
                                                </div>
                                                <div className="text-left flex-1 min-w-0">
                                                    <p className={`text-sm font-bold ${isSelected ? 'text-violet-700 dark:text-violet-300' : 'text-slate-800 dark:text-white'}`}>{item.nome}</p>
                                                    {item.descricao && (
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{item.descricao}</p>
                                                    )}
                                                    {Number(item.preco) > 0 && (
                                                        <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-0.5">{fmt(Number(item.preco))}</p>
                                                    )}
                                                </div>
                                                <div className={`size-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isSelected
                                                    ? 'bg-violet-500 border-violet-500'
                                                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
                                                    }`}>
                                                    {isSelected && <Check className="size-3.5 text-white stroke-[3]" />}
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-6 bg-slate-50 dark:bg-slate-700 border-t border-slate-100 dark:border-slate-600 shrink-0">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</span>
                                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                                        {selected.length > 0 ? fmt(finalPrice) : '—'}
                                    </span>
                                </div>
                                {!isValid && selected.length > 0 && (
                                    <p className="text-center text-xs text-amber-600 dark:text-amber-400 font-medium mb-3">
                                        ⚠️ Selecione ao menos {min} sabore{min > 1 ? 's' : ''} para continuar
                                    </p>
                                )}
                                {selected.length === 0 && (
                                    <p className="text-center text-xs text-slate-400 dark:text-slate-500 mb-3">
                                        Escolha seus sabores acima para ver o preço final
                                    </p>
                                )}
                                <button
                                    disabled={!isValid}
                                    onClick={handleAddToCart}
                                    className="w-full bg-green-500 hover:bg-green-600 disabled:bg-slate-200 dark:bg-slate-600 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl shadow-lg shadow-green-500/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                                >
                                    <ShoppingCart className="size-5" />
                                    {isValid ? 'Adicionar ao Carrinho' : `Escolha ${min - selected.length} sabore${(min - selected.length) !== 1 ? 's' : ''} ainda`}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
