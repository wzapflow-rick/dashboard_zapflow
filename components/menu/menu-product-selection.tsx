'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { X, ShoppingCart, Check, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from './cart-context';
import { toast } from 'sonner';

interface ComplementItem {
    id: number;
    nome: string;
    preco?: number;
    grupo_id?: number;
}

interface ComplementGroup {
    id: number;
    nome: string;
    minimo?: number;
    maximo?: number;
    obrigatorio?: boolean;
    tipo_calculo?: string;
    cobrar_mais_caro?: boolean;
    total_slots?: number;
    items: ComplementItem[];
}

interface SelectedItem extends ComplementItem {
    fator_proporcao: number;
}

interface UpsellProduct {
    id: number;
    nome: string;
    preco: number;
    imagem?: string | null;
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

// Checks if a group uses fractional selection (meio a meio, etc.)
function isFractionalGroup(grupo: ComplementGroup): boolean {
    const slots = Number(grupo.total_slots || grupo.maximo || 1);
    return slots > 1 && (grupo.cobrar_mais_caro || grupo.tipo_calculo === 'maior_valor' || grupo.tipo_calculo === 'media');
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

    // Filter upsell products - exclude current product and get related items
    const relatedUpsells = upsellProducts
        .filter(p => p.id !== product.id)
        .slice(0, 3);
    
    const hasComplements = product.complementGroups && product.complementGroups.length > 0;

    // Toggle item selection in a group, respecting fractional logic
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
                // For fractional groups: check if adding would exceed 1.0 total
                const currentSum = current.reduce((s, i) => s + i.fator_proporcao, 0);
                if (currentSum + fatorDefault > 1.0001) return; // Already full
                if (max === 1) {
                    // Radio-style: replace
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

    // Calculate total fraction for a group (0.0 to 1.0)
    const getGroupFraction = (grupoId: number) => {
        return (selections[grupoId] || []).reduce((s, i) => s + i.fator_proporcao, 0);
    };

    // Price calculation
    const finalPrice = useMemo(() => {
        let price = Number(product.preco || 0);
        if (!hasComplements) return price;

        product.complementGroups.forEach((grupo: ComplementGroup) => {
            const selectedItems = selections[grupo.id] || [];
            if (selectedItems.length === 0) return;
            const prices = selectedItems.map(i => Number(i.preco || 0));

            if (grupo.cobrar_mais_caro) {
                // Replace base price with the most expensive flavor
                const maxFlapPrice = Math.max(...prices);
                price = Math.max(price, maxFlapPrice);
            } else if (grupo.tipo_calculo === 'maior_valor') {
                price = Math.max(price, ...prices);
            } else if (grupo.tipo_calculo === 'media') {
                const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
                price = Math.max(price, avg);
            } else {
                // Soma: multiply each item price by its fator_proporcao
                const subtotal = selectedItems.reduce((s, i) => s + (Number(i.preco || 0) * i.fator_proporcao), 0);
                price += subtotal;
            }
        });

        return price;
    }, [product, selections, hasComplements]);

    // Add to cart
    const handleAddToCart = () => {
        const complementos = product.complementGroups?.map((grupo: ComplementGroup) => {
            const selected = selections[grupo.id] || [];
            if (selected.length === 0) return null;
            return {
                grupoId: grupo.id,
                grupoNome: grupo.nome,
                items: selected.map(i => ({
                    id: i.id,
                    nome: i.nome,
                    preco: Number(i.preco || 0),
                    fator_proporcao: i.fator_proporcao
                }))
            };
        }).filter(Boolean);

        addItem({
            productId: product.id,
            nome: product.nome,
            preco: finalPrice,
            quantidade: 1,
            imagem: product.imagem,
            complementos: complementos.length > 0 ? complementos : undefined
        });

        toast.success(`${product.nome} adicionado ao carrinho!`);
        setIsOpen(false);
        setSelections({});
    };

    // Validate: all required groups met + fractional groups sum to 1.0
    const isSelectionValid = useMemo(() => {
        if (!hasComplements) return true;
        return product.complementGroups.every((grupo: ComplementGroup) => {
            const sel = selections[grupo.id] || [];
            const count = sel.length;
            const min = Number(grupo.minimo || 0);

            if (isFractionalGroup(grupo)) {
                const slots = Number(grupo.total_slots || grupo.maximo || 1);
                const fraction = getGroupFraction(grupo.id);
                // Must exactly fill all slots (within floating-point tolerance)
                return Math.abs(fraction - 1.0) < 0.001 || (min === 0 && count === 0);
            }

            return count >= min;
        });
    }, [product, selections, hasComplements]);

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
                            onClick={() => setIsOpen(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            {/* Header Image */}
                            <div className="relative h-48 shrink-0">
                                <Image
                                    src={product.imagem || `https://picsum.photos/seed/${product.id}/200/200`}
                                    alt={product.nome}
                                    fill
                                    className="object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full text-white transition-colors"
                                >
                                    <X className="size-5" />
                                </button>
                                <div className="absolute bottom-4 left-6 right-6">
                                    <h2 className="text-xl font-bold text-white">{product.nome}</h2>
                                    <p className="text-white/80 text-xs line-clamp-1">{product.descricao}</p>
                                </div>
                            </div>

                            {/* Options */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                                {product.complementGroups.map((grupo: ComplementGroup) => {
                                    const fractional = isFractionalGroup(grupo);
                                    const slots = Number(grupo.total_slots || grupo.maximo || 1);
                                    const selected = selections[grupo.id] || [];
                                    const fraction = getGroupFraction(grupo.id);
                                    const filled = fractional
                                        ? Math.round(fraction * slots)
                                        : selected.length;
                                    const isFull = fractional
                                        ? Math.abs(fraction - 1.0) < 0.001
                                        : selected.length >= (grupo.maximo || 999);

                                    return (
                                        <div key={grupo.id} className="space-y-3">
                                            <div className="flex justify-between items-start gap-2">
                                                <div>
                                                    <h3 className="font-bold text-slate-900">{grupo.nome}</h3>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        {grupo.cobrar_mais_caro
                                                            ? `Cobrado pelo sabor mais caro`
                                                            : grupo.tipo_calculo === 'maior_valor'
                                                                ? 'Cobrado pelo maior valor'
                                                                : grupo.tipo_calculo === 'media'
                                                                    ? 'Preço: média dos sabores'
                                                                    : 'Preço: soma dos adicionais'}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 shrink-0">
                                                    {Number(grupo.minimo) > 0 && selected.length < Number(grupo.minimo) && (
                                                        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-md uppercase">Obrigatório</span>
                                                    )}
                                                    {isFull && (
                                                        <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-md uppercase">✓ Completo</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Fractional progress meter */}
                                            {fractional && (
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-xs text-slate-500">
                                                        <span>{filled}/{slots} sabores</span>
                                                        <span>{Math.round(fraction * 100)}% preenchido</span>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        {Array.from({ length: slots }).map((_, idx) => (
                                                            <div
                                                                key={idx}
                                                                className={`h-2 flex-1 rounded-full transition-all ${idx < filled ? 'bg-violet-500' : 'bg-slate-200'}`}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                {grupo.items.map((item: ComplementItem) => {
                                                    const isSelected = selected.find(i => i.id === item.id);
                                                    const canAdd = !isFull || !!isSelected;

                                                    return (
                                                        <button
                                                            key={item.id}
                                                            onClick={() => canAdd ? toggleItem(grupo, item) : undefined}
                                                            disabled={!canAdd && !isSelected}
                                                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${isSelected
                                                                ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-200'
                                                                : canAdd
                                                                    ? 'border-slate-100 bg-slate-50 hover:border-slate-200'
                                                                    : 'border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed'
                                                                }`}
                                                        >
                                                            <div className="text-left">
                                                                <p className={`text-sm font-bold ${isSelected ? 'text-violet-700' : 'text-slate-700'}`}>{item.nome}</p>
                                                                {Number(item.preco) > 0 && (
                                                                    <p className="text-xs text-slate-500 font-medium">+{defaultFormatPrice(item.preco)}</p>
                                                                )}
                                                            </div>
                                                            <div className={`size-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${isSelected ? 'bg-violet-500 border-violet-500' : 'border-slate-300 bg-white'}`}>
                                                                {isSelected && <Check className="size-3 text-white stroke-[4]" />}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Upsell Suggestions */}
                            {relatedUpsells.length > 0 && (
                                <div className="px-6 py-4 bg-amber-50 border-t border-amber-100">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Combina bem com</span>
                                    </div>
                                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-2 px-2 custom-scrollbar">
                                        {relatedUpsells.map((upsell) => (
                                            <button
                                                key={upsell.id}
                                                onClick={() => {
                                                    addItem({
                                                        productId: upsell.id,
                                                        nome: upsell.nome,
                                                        preco: Number(upsell.preco || 0),
                                                        quantidade: 1,
                                                        imagem: upsell.imagem || undefined
                                                    });
                                                    toast.success(`${upsell.nome} adicionado!`);
                                                }}
                                                className="flex-shrink-0 bg-white border border-amber-200 rounded-xl p-2 hover:bg-amber-100 transition-colors"
                                            >
                                                <div className="size-10 rounded-lg bg-slate-100 overflow-hidden mb-1 relative">
                                                    {upsell.imagem ? (
                                                        <Image src={upsell.imagem} alt={upsell.nome} fill className="object-cover" referrerPolicy="no-referrer" />
                                                    ) : (
                                                        <div className="size-full flex items-center justify-center text-amber-400 text-xs">🍔</div>
                                                    )}
                                                </div>
                                                <p className="text-[10px] font-bold text-slate-800 line-clamp-1 w-16 text-center">{upsell.nome}</p>
                                                <p className="text-[9px] text-amber-600 font-medium text-center">{defaultFormatPrice(upsell.preco)}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Footer */}
                            <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total</span>
                                    <span className="text-xl font-black text-slate-900">{defaultFormatPrice(finalPrice)}</span>
                                </div>
                                {!isSelectionValid && (
                                    <p className="text-center text-xs text-amber-600 font-medium mb-3">
                                        ⚠️ Complete a seleção de todos os grupos obrigatórios para continuar
                                    </p>
                                )}
                                <button
                                    disabled={!isSelectionValid}
                                    onClick={handleAddToCart}
                                    className="w-full bg-green-500 hover:bg-green-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl shadow-lg shadow-green-500/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                                >
                                    <ShoppingCart className="size-5" />
                                    {isSelectionValid ? 'Adicionar ao Carrinho' : 'Selecione os sabores'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
