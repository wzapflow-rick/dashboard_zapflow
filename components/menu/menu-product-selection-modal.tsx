'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { X, ShoppingCart, Check, ChevronRight, ChevronLeft, MessageSquare, Ruler, Sparkles } from 'lucide-react';
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

interface SizeOption {
    nome: string;
    preco: number;
}

interface MenuProductSelectionModalProps {
    product: any;
    whatsappNumber: string;
    empresaNome: string;
    upsellProducts?: UpsellProduct[];
    onClose: () => void;
    editingItemId?: string;
}

const fmt = (price: any) => {
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

type Step = 'size' | 'flavors' | 'additions' | 'observation' | 'upsell';

export default function MenuProductSelectionModal({
    product,
    whatsappNumber,
    empresaNome,
    upsellProducts = [],
    onClose,
    editingItemId,
}: MenuProductSelectionModalProps) {
    const { addItem, updateItem } = useCart();
    
    const availableSizes = useMemo<SizeOption[]>(() => {
        let rawTamanhos = product.tamanhos;
        if (!rawTamanhos && product.descricao?.includes('[[SIZES:')) {
            const match = product.descricao.match(/\[\[SIZES:(.*)\]\]/);
            if (match && match[1]) rawTamanhos = match[1];
        }
        if (!rawTamanhos) return [];
        try {
            const parsed = JSON.parse(rawTamanhos);
            return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
    }, [product.tamanhos, product.descricao]);

    const hasSizes = availableSizes.length > 0;

    const [selectedSize, setSelectedSize] = useState<SizeOption | null>(() => {
        if (product._editingData?.tamanho) {
            return availableSizes.find(s => s.nome === product._editingData.tamanho) || availableSizes[0] || null;
        }
        return availableSizes[0] || null;
    });

    const [selections, setSelections] = useState<Record<number, SelectedItem[]>>(() => {
        if (product._editingData?.complementos) {
            const initial: Record<number, SelectedItem[]> = {};
            product._editingData.complementos.forEach((c: any) => {
                initial[c.grupoId] = c.items.map((i: any) => ({ ...i, grupo_id: c.grupoId }));
            });
            return initial;
        }
        return {};
    });
    
    const [observacao, setObservacao] = useState(product._editingData?.observacao || '');
    const [step, setStep] = useState<Step>(hasSizes ? 'size' : 'flavors');

    const recommendedProductIds = useMemo<number[]>(() => {
        if (!product.recomendacoes) return [];
        try {
            const parsed = JSON.parse(product.recomendacoes);
            return Array.isArray(parsed) ? parsed.map(Number) : [];
        } catch { return []; }
    }, [product.recomendacoes]);

    const availableUpsells = useMemo(() => {
        return upsellProducts.filter(p => recommendedProductIds.includes(p.id));
    }, [upsellProducts, recommendedProductIds]);

    const hasUpsells = availableUpsells.length > 0;
    const saborGroups = product.saborGroups || [];
    const additionalGroups = product.additionalGroups || [];
    const hasFlavors = saborGroups.length > 0;
    const hasAdditions = additionalGroups.length > 0;

    const currentGroups = useMemo(() => {
        if (step === 'flavors') return saborGroups;
        if (step === 'additions') return additionalGroups;
        return [];
    }, [step, saborGroups, additionalGroups]);

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
                setSelections(prev => ({
                    ...prev,
                    [grupoId]: [...current, { ...item, fator_proporcao: fatorDefault, grupo_id: grupoId }]
                }));
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
        let price = selectedSize ? selectedSize.preco : Number(product.preco || 0);
        const allGroups = [...saborGroups, ...additionalGroups];

        allGroups.forEach((grupo: ComplementGroup) => {
            const selectedItems = selections[grupo.id] || [];
            if (selectedItems.length === 0) return;
            if (grupo.tipo_calculo === 'fixo') {
                price += (grupo.preco_fixo || 0);
                return;
            }
            const prices = selectedItems.map(i => Number(i.preco || 0));
            if (grupo.cobrar_mais_caro) {
                price = Math.max(price, ...prices);
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
    }, [product, selections, saborGroups, additionalGroups, selectedSize]);

    const isStepValid = (currentStep: Step) => {
        if (currentStep === 'size') return !!selectedSize;
        if (currentStep === 'flavors') {
            return saborGroups.every((grupo: ComplementGroup) => {
                const sel = selections[grupo.id] || [];
                const min = Number(grupo.minimo || 0);
                if (isFractionalGroup(grupo)) {
                    const fraction = getGroupFraction(grupo.id);
                    return Math.abs(fraction - 1.0) < 0.001 || (min === 0 && sel.length === 0);
                }
                return sel.length >= min;
            });
        }
        if (currentStep === 'additions') {
            return additionalGroups.every((grupo: ComplementGroup) => {
                const sel = selections[grupo.id] || [];
                const min = Number(grupo.minimo || 0);
                return sel.length >= min;
            });
        }
        return true;
    };

    const nextStep = () => {
        if (!isStepValid(step)) {
            toast.error('Por favor, preencha as opções obrigatórias');
            return;
        }
        if (step === 'size') {
            if (hasFlavors) setStep('flavors');
            else if (hasAdditions) setStep('additions');
            else setStep('observation');
        } else if (step === 'flavors') {
            if (hasAdditions) setStep('additions');
            else setStep('observation');
        } else if (step === 'additions') {
            setStep('observation');
        } else if (step === 'observation') {
            if (hasUpsells && !editingItemId) setStep('upsell');
            else addToCart();
        } else {
            addToCart();
        }
    };

    const prevStep = () => {
        if (step === 'upsell') setStep('observation');
        else if (step === 'observation') {
            if (hasAdditions) setStep('additions');
            else if (hasFlavors) setStep('flavors');
            else if (hasSizes) setStep('size');
        } else if (step === 'additions') {
            if (hasFlavors) setStep('flavors');
            else if (hasSizes) setStep('size');
        } else if (step === 'flavors') {
            if (hasSizes) setStep('size');
        }
    };

    const addToCart = () => {
        const allGroups = [...saborGroups, ...additionalGroups];
        const complementos = Object.entries(selections).map(([grupoId, items]) => {
            const grupo = allGroups.find((g: ComplementGroup) => g.id === Number(grupoId));
            return {
                grupoId: Number(grupoId),
                grupoNome: grupo?.nome || '',
                items: items.map(i => ({ id: i.id, nome: i.nome }))
            };
        });

        const itemData = {
            productId: product.id,
            nome: product.nome,
            preco: finalPrice,
            quantidade: 1,
            imagem: product.imagem,
            tamanho: selectedSize?.nome || '',
            observacao,
            complementos
        };

        if (editingItemId) {
            updateItem(editingItemId, itemData);
            toast.success('Item atualizado!');
        } else {
            addItem(itemData);
            toast.success('Adicionado ao carrinho!');
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center sm:p-4">
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            
            <motion.div
                initial={{ opacity: 0, y: 100, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 100, scale: 0.95 }}
                className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-xl bg-white dark:bg-slate-900 sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="shrink-0 relative h-48 sm:h-64">
                    <Image 
                        src={product.imagem || `https://picsum.photos/seed/${product.id}/800/600`}
                        alt={product.nome}
                        fill
                        className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 size-10 flex items-center justify-center bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/40 transition-colors"
                    >
                        <X className="size-6" />
                    </button>
                    <div className="absolute bottom-6 left-6 right-6">
                        <h2 className="text-2xl sm:text-3xl font-black text-white">{product.nome}</h2>
                        <p className="text-white/80 text-sm mt-1 line-clamp-1">{product.descricao}</p>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-8">
                    {step === 'size' ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-slate-900 dark:text-white mb-2">
                                <Ruler className="size-5 text-violet-500" />
                                <h3 className="font-bold text-sm sm:text-base">Escolha o tamanho</h3>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                {availableSizes.map((size) => (
                                    <button
                                        key={size.nome}
                                        onClick={() => setSelectedSize(size)}
                                        className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${
                                            selectedSize?.nome === size.nome
                                            ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                                            : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`size-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                                selectedSize?.nome === size.nome ? 'bg-violet-500 border-violet-500 text-white' : 'border-slate-300 dark:border-slate-600'
                                            }`}>
                                                {selectedSize?.nome === size.nome && <Check className="size-3" />}
                                            </div>
                                            <span className="font-bold text-slate-700 dark:text-slate-200">{size.nome}</span>
                                        </div>
                                        <span className="text-sm font-black text-violet-600 dark:text-violet-400">{fmt(size.preco)}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : step === 'observation' ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-slate-900 dark:text-white mb-2">
                                <MessageSquare className="size-5 text-violet-500" />
                                <h3 className="font-bold text-sm sm:text-base">Alguma observação?</h3>
                            </div>
                            <textarea
                                value={observacao}
                                onChange={(e) => setObservacao(e.target.value)}
                                placeholder="Ex: Tirar cebola, ponto da carne, etc..."
                                className="w-full h-32 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 resize-none dark:text-white"
                            />
                        </div>
                    ) : step === 'upsell' ? (
                        <div className="space-y-6">
                            <div className="text-center space-y-2">
                                <div className="inline-flex items-center justify-center size-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full mb-2">
                                    <Sparkles className="size-6" />
                                </div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white">Que tal acompanhar?</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 px-4">Selecionamos algumas sugestões especiais para você aproveitar agora!</p>
                            </div>
                            <div className="space-y-3">
                                {availableUpsells.map((upsell) => (
                                    <div key={upsell.id} className="group relative flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl transition-all hover:border-amber-300 dark:hover:border-amber-900/50">
                                        <div className="relative size-16 shrink-0 rounded-xl overflow-hidden">
                                            <Image src={upsell.imagem || `https://picsum.photos/seed/${upsell.id}/100/100`} alt={upsell.nome} fill className="object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{upsell.nome}</h4>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">{upsell.descricao || 'Excelente acompanhamento'}</p>
                                            <p className="text-sm font-black text-amber-600 dark:text-amber-400 mt-1">{fmt(upsell.preco)}</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                addItem({ productId: upsell.id, nome: upsell.nome, preco: Number(upsell.preco), quantidade: 1, imagem: upsell.imagem, tamanho: '' });
                                                toast.success(`${upsell.nome} adicionado!`);
                                            }}
                                            className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all shadow-sm"
                                        >
                                            Adicionar
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={addToCart} className="w-full py-3 text-slate-500 dark:text-slate-400 text-xs font-bold hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                                Não, obrigado. Quero apenas este item.
                            </button>
                        </div>
                    ) : (
                        currentGroups.map((grupo: ComplementGroup) => (
                            <div key={grupo.id} className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">{grupo.nome}</h3>
                                        <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                                            {Number(grupo.minimo || 0) > 0 ? `Obrigatório • Mín ${grupo.minimo}` : 'Opcional'}
                                            {Number(grupo.maximo || 0) > 0 && ` • Máx ${grupo.maximo}`}
                                        </p>
                                    </div>
                                    {isFractionalGroup(grupo) && (
                                        <div className="px-2 py-1 bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-lg text-[9px] font-bold uppercase">
                                            {Math.round(getGroupFraction(grupo.id) * 100)}% Selecionado
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    {grupo.items.map((item) => {
                                        const isSelected = (selections[grupo.id] || []).some(i => i.id === item.id);
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => toggleItem(grupo, item)}
                                                className={`w-full p-3.5 rounded-xl border-2 flex items-center justify-between transition-all ${isSelected ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`size-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-violet-500 border-violet-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                                                        {isSelected && <Check className="size-3" />}
                                                    </div>
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.nome}</span>
                                                </div>
                                                {Number(item.preco || 0) > 0 && <span className="text-xs font-bold text-violet-600 dark:text-violet-400">+{fmt(item.preco)}</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="shrink-0 p-5 sm:p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total do item</span>
                            <span className="text-2xl font-black text-slate-900 dark:text-white">{fmt(finalPrice)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {step !== (hasSizes ? 'size' : 'flavors') && (
                                <button onClick={prevStep} className="size-12 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl hover:bg-slate-200 transition-colors">
                                    <ChevronLeft className="size-6" />
                                </button>
                            )}
                            <button onClick={nextStep} className="flex-1 sm:flex-none px-8 py-3.5 bg-violet-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-violet-700 transition-all shadow-lg shadow-violet-500/20">
                                <span>{step === 'upsell' ? 'Finalizar' : step === 'observation' && !hasUpsells ? 'Adicionar' : 'Próximo'}</span>
                                <ChevronRight className="size-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
