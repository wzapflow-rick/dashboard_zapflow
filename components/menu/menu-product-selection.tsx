'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { X, ShoppingCart, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from './cart-context';
import { toast } from 'sonner';

interface ComplementItem {
    id: number;
    nome: string;
    preco: number;
    fator_proporcao?: number;
}

interface ComplementGroup {
    id: number;
    nome: string;
    minimo: number;
    maximo: number;
    total_slots?: number;
    tipo_calculo?: string;
    cobrar_mais_caro?: boolean;
    preco_fixo?: number;
    completamentos_ids?: number[];
    items: ComplementItem[];
}

interface UpsellProduct {
    id: number;
    nome: string;
    preco: number;
    imagem?: string | null;
    descricao?: string;
}

interface MenuProductSelectionProps {
    product: any;
    whatsappNumber: string;
    empresaNome: string;
    upsellProducts?: UpsellProduct[];
}

const defaultFormatPrice = (price: any) => {
    const num = Number(price || 0);
    return `R$ ${num.toFixed(2).replace('.', ',')}`;
};

function isFractionalGroup(grupo: ComplementGroup): boolean {
    const slots = Number(grupo.total_slots || grupo.maximo || 1);
    return slots > 1 && (grupo.cobrar_mais_caro || grupo.tipo_calculo === 'maior_valor' || grupo.tipo_calculo === 'media');
}

interface SelectedItem extends ComplementItem {
    grupo_id: number;
}

export default function MenuProductSelection({
    product,
    whatsappNumber,
    empresaNome,
    upsellProducts = [],
}: MenuProductSelectionProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selections, setSelections] = useState<Record<number, SelectedItem[]>>({});
    const { addItem } = useCart();

    const hasComplements = product.complementGroups && product.complementGroups.length > 0;

    const toggleItem = (grupo: ComplementGroup, item: ComplementItem) => {
        const grupoId = grupo.id;
        const current = selections[grupoId] || [];
        const slots = Number(grupo.total_slots || grupo.maximo || 1);
        const isFractional = isFractionalGroup(grupo);
        const fatorDefault = isFractional ? parseFloat((1 / slots).toFixed(4)) : 1;
        const isSelected = current.find(i => i.id === item.id);

        if (isSelected) {
            setSelections(prev => ({ ...prev, [grupoId]: current.filter(i => i.id !== item.id) }));
        } else {
            const max = Number(grupo.maximo || 999);
            if (isFractional) {
                const currentSum = current.reduce((s, i) => s + (i.fator_proporcao || 0), 0);
                if (currentSum + fatorDefault > 1.0001) return;
                if (max === 1) {
                    setSelections(prev => ({ ...prev, [grupoId]: [{ ...item, fator_proporcao: fatorDefault, grupo_id: grupoId }] }));
                } else {
                    setSelections(prev => ({
                        ...prev,
                        [grupoId]: [...current, { ...item, fator_proporcao: fatorDefault, grupo_id: grupoId }]
                    }));
                }
            } else {
                if (current.length < max) {
                    setSelections(prev => ({
                        ...prev,
                        [grupoId]: [...current, { ...item, fator_proporcao: 1, grupo_id: grupoId }]
                    }));
                } else if (max === 1) {
                    setSelections(prev => ({ ...prev, [grupoId]: [{ ...item, fator_proporcao: 1, grupo_id: grupoId }] }));
                }
            }
        }
    };

    const getGroupFraction = (grupoId: number) => {
        return (selections[grupoId] || []).reduce((s, i) => s + (i.fator_proporcao || 0), 0);
    };

    const finalPrice = useMemo(() => {
        let price = Number(product.preco || 0);
        if (!hasComplements) return price;

        product.complementGroups.forEach((grupo: ComplementGroup) => {
            const selectedItems = selections[grupo.id] || [];
            if (selectedItems.length === 0) return;
            
            if (grupo.tipo_calculo === 'fixo') {
                price += grupo.preco_fixo || 0;
                return;
            }
            
            const prices = selectedItems.map(i => Number(i.preco || 0));

            if (grupo.cobrar_mais_caro) {
                const maxFlapPrice = Math.max(...prices);
                price = Math.max(price, maxFlapPrice);
            } else if (grupo.tipo_calculo === 'maior_valor') {
                price = Math.max(price, ...prices);
            } else if (grupo.tipo_calculo === 'media') {
                const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
                price = Math.max(price, avg);
            } else {
                price += prices.reduce((a, b) => a + b, 0);
            }
        });

        return price;
    }, [product, selections, hasComplements]);

    const isSelectionValid = useMemo(() => {
        if (!hasComplements) return true;
        return product.complementGroups.every((grupo: ComplementGroup) => {
            const sel = selections[grupo.id] || [];
            const count = sel.length;
            const min = Number(grupo.minimo || 0);

            if (isFractionalGroup(grupo)) {
                const fraction = getGroupFraction(grupo.id);
                return Math.abs(fraction - 1.0) < 0.001 || (min === 0 && count === 0);
            }

            return count >= min;
        });
    }, [product, selections, hasComplements]);

    const handleClose = () => {
        setIsOpen(false);
        setSelections({});
    };

    const addToCart = () => {
        if (hasComplements && !isSelectionValid) {
            toast.error('Selecione todas as opções obrigatórias');
            return;
        }

        const complementos = Object.entries(selections).map(([grupoId, items]) => {
            const grupo = product.complementGroups.find((g: ComplementGroup) => g.id === Number(grupoId));
            return {
                grupoId: Number(grupoId),
                grupoNome: grupo?.nome || '',
                items: items.map(i => ({
                    id: i.id,
                    nome: i.nome,
                    preco: i.preco,
                    fator_proporcao: i.fator_proporcao || 1
                }))
            };
        });

        addItem({
            productId: product.id,
            nome: product.nome,
            preco: finalPrice,
            quantidade: 1,
            imagem: product.imagem,
            complementos: complementos.length > 0 ? complementos : undefined
        });

        toast.success(`${product.nome} adicionado ao carrinho!`);
        handleClose();
    };

    return (
        <>
            <button
                onClick={() => hasComplements ? setIsOpen(true) : null}
                className="w-full text-left"
            >
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 flex gap-4 hover:shadow-md transition-all cursor-pointer">
                    <div className="relative size-20 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                        <Image
                            src={product.imagem || `https://picsum.photos/seed/${product.id}/200/200`}
                            alt={product.nome}
                            fill
                            className="object-cover"
                            referrerPolicy="no-referrer"
                        />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 text-sm">{product.nome}</h3>
                        {product.descricao && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{product.descricao}</p>
                        )}
                        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                            <span className="text-base font-black text-violet-600">
                                {defaultFormatPrice(product.preco)}
                            </span>
                            <div className="flex gap-1">
                                {hasComplements ? (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsOpen(true);
                                        }}
                                        className="text-xs font-bold text-green-600 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-all"
                                    >
                                        Escolher
                                    </button>
                                ) : (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            addItem({
                                                productId: product.id,
                                                nome: product.nome,
                                                preco: Number(product.preco || 0),
                                                quantidade: 1,
                                                imagem: product.imagem
                                            });
                                            toast.success(`${product.nome} adicionado ao carrinho!`);
                                        }}
                                        className="text-xs font-bold text-green-600 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-all"
                                    >
                                        Adicionar
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </button>

            <AnimatePresence>
                {isOpen && (
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
                            className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            <div className="relative h-48 shrink-0">
                                <Image
                                    src={product.imagem || `https://picsum.photos/seed/${product.id}/200/200`}
                                    alt={product.nome}
                                    fill
                                    className="object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                <button
                                    onClick={handleClose}
                                    className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full text-white transition-colors"
                                >
                                    <X className="size-5" />
                                </button>
                                <div className="absolute bottom-4 left-6 right-6">
                                    <h2 className="text-xl font-bold text-white">{product.nome}</h2>
                                    <p className="text-white/80 text-xs line-clamp-1">{product.descricao}</p>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                                {product.complementGroups?.map((grupo: ComplementGroup) => (
                                    <div key={grupo.id}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <h3 className="font-bold text-slate-900">{grupo.nome}</h3>
                                                <p className="text-xs text-slate-500">
                                                    {Number(grupo.minimo || 0) > 0 && `Mín: ${grupo.minimo} | `}
                                                    {Number(grupo.maximo || 1) === 1 ? 'Escolha 1' : `Máx: ${grupo.maximo}`}
                                                </p>
                                            </div>
                                            {isFractionalGroup(grupo) && (
                                                <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-1 rounded-full font-bold">
                                                    MEIO A MEIO
                                                </span>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            {grupo.items?.map((item: ComplementItem) => {
                                                const isSelected = (selections[grupo.id] || []).some(s => s.id === item.id);
                                                return (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => toggleItem(grupo, item)}
                                                        className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all ${
                                                            isSelected
                                                                ? 'border-green-500 bg-green-50'
                                                                : 'border-slate-200 hover:border-slate-300'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {isFractionalGroup(grupo) ? (
                                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                                                    isSelected ? 'border-green-500 bg-green-500' : 'border-slate-300'
                                                                }`}>
                                                                    {isSelected && <Check className="size-3 text-white" />}
                                                                </div>
                                                            ) : (
                                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                                                    isSelected ? 'border-green-500 bg-green-500' : 'border-slate-300'
                                                                }`}>
                                                                    {isSelected && <Check className="size-3 text-white" />}
                                                                </div>
                                                            )}
                                                            <span className="text-sm font-medium text-slate-900">{item.nome}</span>
                                                        </div>
                                                        {Number(item.preco || 0) > 0 && (
                                                            <span className="text-sm font-bold text-green-600">
                                                                +{defaultFormatPrice(item.preco)}
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="shrink-0 p-4 border-t border-slate-200 bg-slate-50">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-medium text-slate-600">Total:</span>
                                    <span className="text-xl font-black text-green-600">{defaultFormatPrice(finalPrice)}</span>
                                </div>
                                <button
                                    onClick={addToCart}
                                    className="w-full py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                                >
                                    <ShoppingCart className="size-5" />
                                    Adicionar ao Carrinho
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
