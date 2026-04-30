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
            const parsed = typeof rawTamanhos === 'string' ? JSON.parse(rawTamanhos) : rawTamanhos;
            return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
    }, [product.tamanhos, product.descricao]);

    const hasSizes = availableSizes.length > 0;
    const saborGroups = product.saborGroups || [];
    const additionalGroups = product.additionalGroups || [];
    const hasFlavors = saborGroups.length > 0;
    const hasAdditions = additionalGroups.length > 0;

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
    const [step, setStep] = useState<Step>('observation');

    // Ajustar o step inicial após a montagem do componente para evitar erros de hidratação
    useEffect(() => {
        if (hasSizes) setStep('size');
        else if (hasFlavors) setStep('flavors');
        else if (hasAdditions) setStep('additions');
        else setStep('observation');
    }, [hasSizes, hasFlavors, hasAdditions]);

    const recommendedProductIds = useMemo<number[]>(() => {
        const raw = product.recomendacoes;
        if (!raw) return [];
        if (Array.isArray(raw)) return raw.map(Number);
        if (typeof raw === 'string') {
            try {
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed.map(Number) : [];
            } catch { return []; }
        }
        return [];
    }, [product.recomendacoes]);

    const availableUpsells = useMemo(() => {
        return upsellProducts.filter(p => recommendedProductIds.includes(p.id));
    }, [upsellProducts, recommendedProductIds]);

    const hasUpsells = availableUpsells.length > 0;

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
                grupoNome: String(grupo?.nome || ''),
                items: items.map(i => ({ 
                    id: i.id, 
                    nome: i.nome,
                    preco: Number(i.preco || 0),
                    fator_proporcao: Number(i.fator_proporcao || 1)
                }))
            };
        });

        const itemData = {
            productId: Number(product.id),
            nome: String(product.nome || ''),
            preco: Number(finalPrice),
            quantidade: 1,
            imagem: String(product.imagem || ''),
            tamanho: String(selectedSize?.nome || ''),
            observacao: String(observacao || ''),
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
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="bg-white dark:bg-slate-900 w-full max-w-lg h-full sm:h-auto sm:max-h-[90vh] sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header do Modal */}
                    <div className="relative h-48 sm:h-56 shrink-0">
                        <Image
                            src={product.imagem || '/images/produto-placeholder.svg'}
                            alt={product.nome}
                            fill
                            className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 size-10 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/40 transition-colors"
                        >
                            <X className="size-6" />
                        </button>
                        <div className="absolute bottom-4 left-4 right-4">
                            <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                                {product.nome}
                            </h2>
                            <p className="text-white/80 text-xs sm:text-sm mt-1 line-clamp-1">
                                {product.descricao}
                            </p>
                        </div>
                    </div>

                    {/* Conteúdo com Steps */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                        {/* Indicador de Progresso */}
                        <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-2 no-scrollbar">
                            {hasSizes && (
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${step === 'size' ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' : 'text-slate-400'}`}>
                                    <Ruler className="size-3" /> Tamanho
                                </div>
                            )}
                            {hasFlavors && (
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${step === 'flavors' ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' : 'text-slate-400'}`}>
                                    <Sparkles className="size-3" /> Sabores
                                </div>
                            )}
                            {hasAdditions && (
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${step === 'additions' ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' : 'text-slate-400'}`}>
                                    <ShoppingCart className="size-3" /> Adicionais
                                </div>
                            )}
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${step === 'observation' ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' : 'text-slate-400'}`}>
                                <MessageSquare className="size-3" /> Obs
                            </div>
                        </div>

                        {/* Conteúdo Dinâmico por Step */}
                        <AnimatePresence mode="wait">
                            {step === 'size' && (
                                <motion.div
                                    key="size"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-4"
                                >
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            Escolha o tamanho <span className="text-rose-500">*</span>
                                        </h3>
                                        <span className="text-[10px] font-bold text-violet-500 uppercase tracking-widest bg-violet-50 dark:bg-violet-900/20 px-2 py-1 rounded">Obrigatório</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3">
                                        {availableSizes.map((size) => (
                                            <button
                                                key={size.nome}
                                                onClick={() => setSelectedSize(size)}
                                                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                                                    selectedSize?.nome === size.nome
                                                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                                                        : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                                                }`}
                                            >
                                                <span className={`font-bold ${selectedSize?.nome === size.nome ? 'text-violet-700 dark:text-violet-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                                    {size.nome}
                                                </span>
                                                <div className="flex items-center gap-3">
                                                    <span className="font-black text-slate-900 dark:text-white">{fmt(size.preco)}</span>
                                                    <div className={`size-5 rounded-full border-2 flex items-center justify-center transition-colors ${selectedSize?.nome === size.nome ? 'border-violet-500 bg-violet-500' : 'border-slate-300'}`}>
                                                        {selectedSize?.nome === size.nome && <Check className="size-3 text-white" />}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {(step === 'flavors' || step === 'additions') && (
                                <motion.div
                                    key={step}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-8"
                                >
                                    {currentGroups.map((grupo: ComplementGroup) => {
                                        const isFractional = isFractionalGroup(grupo);
                                        const fraction = getGroupFraction(grupo.id);
                                        const selCount = (selections[grupo.id] || []).length;
                                        const min = Number(grupo.minimo || 0);
                                        const max = Number(grupo.maximo || 999);
                                        const isDone = isFractional ? Math.abs(fraction - 1.0) < 0.001 : selCount >= min;

                                        return (
                                            <div key={grupo.id} className="space-y-4">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center justify-between">
                                                        <h3 className="font-bold text-slate-900 dark:text-white">
                                                            {grupo.nome} {min > 0 && <span className="text-rose-500">*</span>}
                                                        </h3>
                                                        <div className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${isDone ? 'bg-green-100 text-green-600 dark:bg-green-900/30' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                                                            {isFractional ? `${Math.round(fraction * 100)}% selecionado` : `${selCount}/${max === 999 ? '∞' : max}`}
                                                        </div>
                                                    </div>
                                                    <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                                                        {isFractional ? 'Escolha as frações para completar 100%' : `Selecione no mínimo ${min} e no máximo ${max}`}
                                                    </p>
                                                </div>

                                                <div className="grid grid-cols-1 gap-2">
                                                    {grupo.items.map((item) => {
                                                        const isSelected = (selections[grupo.id] || []).find(i => i.id === item.id);
                                                        return (
                                                            <button
                                                                key={item.id}
                                                                onClick={() => toggleItem(grupo, item)}
                                                                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                                                    isSelected
                                                                        ? 'border-violet-200 bg-violet-50 dark:bg-violet-900/10 dark:border-violet-800'
                                                                        : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`size-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-violet-500 border-violet-500' : 'border-slate-300 dark:border-slate-600'}`}>
                                                                        {isSelected && <Check className="size-3 text-white" />}
                                                                    </div>
                                                                    <span className={`text-xs sm:text-sm font-medium ${isSelected ? 'text-violet-700 dark:text-violet-300 font-bold' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                        {item.nome}
                                                                    </span>
                                                                </div>
                                                                {item.preco > 0 && (
                                                                    <span className="text-xs font-bold text-slate-900 dark:text-white">{fmt(item.preco)}</span>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </motion.div>
                            )}

                            {step === 'observation' && (
                                <motion.div
                                    key="observation"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-4"
                                >
                                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        Alguma observação?
                                    </h3>
                                    <textarea
                                        value={observacao}
                                        onChange={(e) => setObservacao(e.target.value)}
                                        placeholder="Ex: Sem cebola, caprichar no queijo..."
                                        className="w-full h-32 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-violet-400 transition-all text-sm placeholder:text-slate-400"
                                    />
                                </motion.div>
                            )}

                            {step === 'upsell' && (
                                <motion.div
                                    key="upsell"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    <div className="text-center py-4">
                                        <div className="size-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Sparkles className="size-8 text-amber-500" />
                                        </div>
                                        <h3 className="text-xl font-black text-slate-900 dark:text-white">
                                            Que tal aproveitar também?
                                        </h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            Selecionamos estas ofertas especiais para você!
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        {availableUpsells.map((upsell) => (
                                            <div key={upsell.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-3 flex items-center gap-4 shadow-sm">
                                                <div className="relative size-16 rounded-xl overflow-hidden shrink-0">
                                                    <Image src={upsell.imagem || '/images/produto-placeholder.svg'} alt={upsell.nome} fill className="object-cover" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">{upsell.nome}</h4>
                                                    <p className="text-violet-600 dark:text-violet-400 font-black text-sm">{fmt(upsell.preco)}</p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        addItem({
                                                            productId: upsell.id,
                                                            nome: upsell.nome,
                                                            preco: upsell.preco,
                                                            quantidade: 1,
                                                            imagem: upsell.imagem || '',
                                                            tamanho: '',
                                                            observacao: 'Item de recomendação',
                                                            complementos: []
                                                        });
                                                        toast.success(`${upsell.nome} adicionado!`);
                                                    }}
                                                    className="bg-violet-500 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-violet-600 transition-colors shadow-sm"
                                                >
                                                    Adicionar
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={addToCart}
                                        className="w-full py-4 text-slate-500 dark:text-slate-400 font-bold text-sm hover:text-slate-700 transition-colors"
                                    >
                                        Não, obrigado. Finalizar pedido.
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Footer com Botão de Ação */}
                    <div className="shrink-0 p-4 sm:p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
                        {step !== (hasSizes ? 'size' : (hasFlavors ? 'flavors' : (hasAdditions ? 'additions' : 'observation'))) && step !== 'upsell' && (
                            <button
                                onClick={prevStep}
                                className="size-12 sm:size-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 transition-colors"
                            >
                                <ChevronLeft className="size-6" />
                            </button>
                        )}
                        
                        {step !== 'upsell' && (
                            <button
                                onClick={nextStep}
                                className="flex-1 h-12 sm:h-14 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg shadow-violet-200 dark:shadow-none transition-all active:scale-[0.98]"
                            >
                                {step === 'observation' ? (
                                    <>
                                        {editingItemId ? 'Atualizar Pedido' : (hasUpsells ? 'Ver Ofertas' : 'Adicionar ao Carrinho')}
                                        <ChevronRight className="size-5" />
                                    </>
                                ) : (
                                    <>
                                        Continuar
                                        <ChevronRight className="size-5" />
                                    </>
                                )}
                            </button>
                        )}

                        {step === 'upsell' && (
                            <button
                                onClick={addToCart}
                                className="flex-1 h-12 sm:h-14 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg shadow-violet-200 dark:shadow-none transition-all active:scale-[0.98]"
                            >
                                Finalizar e Ir para o Carrinho
                                <ShoppingCart className="size-5" />
                            </button>
                        )}
                    </div>
                    
                    {/* Preço Flutuante no Mobile */}
                    <div className="absolute top-4 left-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-white/20 dark:border-slate-700/30 z-20 sm:hidden">
                        <span className="text-xs font-black text-violet-600 dark:text-violet-400">{fmt(finalPrice)}</span>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
