'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { X, ShoppingCart, Check, ChevronRight, ChevronLeft, MessageSquare } from 'lucide-react';
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

type Step = 'flavors' | 'additions' | 'observation';

export default function MenuProductSelectionModal({
    product,
    whatsappNumber,
    empresaNome,
    upsellProducts = [],
    onClose,
    editingItemId,
}: MenuProductSelectionModalProps) {
    const { addItem, updateItem } = useCart();
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
    const [step, setStep] = useState<Step>('flavors');

    const saborGroups = product.saborGroups || [];
    const additionalGroups = product.additionalGroups || [];
    
    const hasFlavors = saborGroups.length > 0;
    const hasAdditions = additionalGroups.length > 0;

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
        let price = Number(product.preco || 0);
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
    }, [product, selections, saborGroups, additionalGroups]);

    const isStepValid = (currentStep: Step) => {
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

    const handleClose = () => {
        setSelections({});
        setObservacao('');
        setStep('flavors');
        onClose();
    };

    const nextStep = () => {
        if (!isStepValid(step)) {
            toast.error('Por favor, preencha as opções obrigatórias');
            return;
        }

        if (step === 'flavors') {
            if (hasAdditions) {
                setStep('additions');
            } else {
                setStep('observation');
            }
        } else if (step === 'additions') {
            setStep('observation');
        } else {
            addToCart();
        }
    };

    const prevStep = () => {
        if (step === 'observation') {
            if (hasAdditions) setStep('additions');
            else if (hasFlavors) setStep('flavors');
        } else if (step === 'additions') {
            setStep('flavors');
        }
    };

    const addToCart = () => {
        const allGroups = [...saborGroups, ...additionalGroups];
        const complementos = Object.entries(selections).map(([grupoId, items]) => {
            const grupo = allGroups.find((g: ComplementGroup) => g.id === Number(grupoId));
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

        if (editingItemId) {
            updateItem(editingItemId, {
                preco: finalPrice,
                observacao: observacao.trim() || undefined,
                complementos: complementos.length > 0 ? complementos : undefined
            });
            toast.success(`${product.nome} atualizado!`);
        } else {
            addItem({
                productId: product.id,
                nome: product.nome,
                preco: finalPrice,
                quantidade: 1,
                imagem: product.imagem,
                observacao: observacao.trim() || undefined,
                complementos: complementos.length > 0 ? complementos : undefined
            });
            toast.success(`${product.nome} adicionado ao carrinho!`);
        }

        handleClose();
    };

    const currentGroups = step === 'flavors' ? saborGroups : step === 'additions' ? additionalGroups : [];

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
                    className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header Image */}
                    <div className="relative h-40 shrink-0">
                        <Image
                            src={product.imagem || `https://picsum.photos/seed/${product.id}/400/200`}
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
                            <div className="flex items-center gap-2 mt-1">
                                <span className="px-2 py-0.5 bg-white/20 backdrop-blur-md rounded text-[10px] font-bold text-white uppercase tracking-wider">
                                    {step === 'flavors' ? 'Passo 1: Sabores' : step === 'additions' ? 'Passo 2: Adicionais' : 'Passo 3: Observação'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1 w-full bg-slate-100 flex">
                        <div className={`h-full bg-violet-500 transition-all duration-300 ${step === 'flavors' ? 'w-1/3' : step === 'additions' ? 'w-2/3' : 'w-full'}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                        {step === 'observation' ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-slate-900 mb-2">
                                    <MessageSquare className="size-5 text-violet-500" />
                                    <h3 className="font-bold">Alguma observação?</h3>
                                </div>
                                <textarea
                                    value={observacao}
                                    onChange={(e) => setObservacao(e.target.value)}
                                    placeholder="Ex: Tirar cebola, ponto da carne, etc..."
                                    className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 resize-none"
                                />
                            </div>
                        ) : (
                            currentGroups.map((grupo: ComplementGroup) => (
                                <div key={grupo.id} className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-bold text-slate-900">{grupo.nome}</h3>
                                            <p className="text-xs text-slate-500">
                                                {Number(grupo.minimo || 0) > 0 ? `Obrigatório • Mín ${grupo.minimo}` : 'Opcional'}
                                                {Number(grupo.maximo || 0) > 0 && ` • Máx ${grupo.maximo}`}
                                            </p>
                                        </div>
                                        {isFractionalGroup(grupo) && (
                                            <div className="px-2 py-1 bg-violet-50 text-violet-600 rounded-lg text-[10px] font-bold uppercase">
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
                                                    className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all ${
                                                        isSelected
                                                            ? 'border-violet-500 bg-violet-50'
                                                            : 'border-slate-100 hover:border-slate-200 bg-white'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`size-5 rounded border-2 flex items-center justify-center transition-colors ${
                                                            isSelected ? 'bg-violet-500 border-violet-500' : 'border-slate-300'
                                                        }`}>
                                                            {isSelected && <Check className="size-3 text-white" />}
                                                        </div>
                                                        <span className="text-sm font-medium text-slate-700">{item.nome}</span>
                                                    </div>
                                                    {Number(item.preco || 0) > 0 && (
                                                        <span className="text-xs font-bold text-violet-600">+{fmt(item.preco)}</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="shrink-0 p-6 border-t border-slate-100 bg-slate-50/50">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total do item</p>
                                <p className="text-2xl font-black text-slate-900">{fmt(finalPrice)}</p>
                            </div>
                            <div className="flex gap-2">
                                {step !== 'flavors' && (
                                    <button
                                        onClick={prevStep}
                                        className="p-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors"
                                    >
                                        <ChevronLeft className="size-6" />
                                    </button>
                                )}
                                
                                <button
                                    onClick={nextStep}
                                    className={`px-8 py-3 text-white font-bold rounded-xl transition-colors flex items-center gap-2 shadow-lg ${
                                        step === 'observation'
                                            ? 'bg-green-500 hover:bg-green-600 shadow-green-200'
                                            : 'bg-violet-500 hover:bg-violet-600 shadow-violet-200'
                                    }`}
                                >
                                    {step === 'observation' ? (
                                        <>
                                            <ShoppingCart className="size-5" />
                                            Finalizar
                                        </>
                                    ) : (
                                        <>
                                            Continuar
                                            <ChevronRight className="size-5" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
