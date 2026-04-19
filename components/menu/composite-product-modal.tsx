'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShoppingCart, ChevronRight, ChevronLeft, Plus, Minus, Check } from 'lucide-react';
import { useCart } from './cart-context';
import { toast } from 'sonner';

interface CompositeProductModalProps {
    product: any;
    whatsappNumber: string;
    empresaNome: string;
    allComposites: any[];
    allGroups: any[];
    onClose: () => void;
    editingItemId?: string;
}

type Step = 'flavors' | 'additions' | 'observation';

export default function CompositeProductModal({
    product,
    whatsappNumber,
    empresaNome,
    allComposites,
    allGroups,
    onClose,
    editingItemId,
}: CompositeProductModalProps) {
    const { addItem, updateItem } = useCart();
    const [selectedFlavors, setSelectedFlavors] = useState<any[]>(() => {
        if (product._editingData?.nome) {
            // Tentar extrair sabores do nome: "Pizza 2 Sabores (Calabresa / Frango)"
            const match = product._editingData.nome.match(/\((.*)\)/);
            if (match && match[1]) {
                const nomes = match[1].split(' / ');
                return product.items.filter((i: any) => nomes.includes(i.nome));
            }
        }
        return [];
    });
    const [selections, setSelections] = useState<Record<number, any[]>>(() => {
        if (product._editingData?.complementos) {
            const initial: Record<number, any[]> = {};
            product._editingData.complementos.forEach((c: any) => {
                initial[c.grupoId] = c.items;
            });
            return initial;
        }
        return {};
    });
    const [observacao, setObservacao] = useState(product._editingData?.observacao || '');
    const [step, setStep] = useState<Step>('flavors');

    const maxFlavors = Number(product.maximo || 1);
    const minFlavors = Number(product.minimo || 1);

    // Encontrar grupos de adicionais vinculados aos sabores
    const additionalGroups = useMemo(() => {
        const groupIds = new Set<number>();
        if (product.completamentos_ids) {
            product.completamentos_ids.forEach((id: number) => groupIds.add(id));
        }
        return allGroups.filter(g => groupIds.has(g.id));
    }, [product.completamentos_ids, allGroups]);

    const hasAdditions = additionalGroups.length > 0;

    const toggleFlavor = (flavor: any) => {
        const isSelected = selectedFlavors.find(f => f.id === flavor.id);
        if (isSelected) {
            setSelectedFlavors(prev => prev.filter(f => f.id !== flavor.id));
        } else {
            if (selectedFlavors.length < maxFlavors) {
                setSelectedFlavors(prev => [...prev, flavor]);
            } else {
                toast.error(`Máximo de ${maxFlavors} sabores`);
            }
        }
    };

    const toggleAddition = (group: any, item: any) => {
        const current = selections[group.id] || [];
        const isSelected = current.find(i => i.id === item.id);

        if (isSelected) {
            setSelections(prev => ({
                ...prev,
                [group.id]: current.filter(i => i.id !== item.id)
            }));
        } else {
            const max = Number(group.maximo || 99);
            if (current.length < max) {
                setSelections(prev => ({
                    ...prev,
                    [group.id]: [...current, item]
                }));
            } else {
                toast.error(`Máximo de ${max} itens para ${group.nome}`);
            }
        }
    };

    const finalPrice = useMemo(() => {
        let price = Number(product.preco || 0);

        // Lógica de preço por sabores (maior valor)
        if (selectedFlavors.length > 0) {
            const flavorPrices = selectedFlavors.map(f => Number(f.preco || 0));
            price = Math.max(...flavorPrices);
        }

        // Adicionais
        Object.values(selections).flat().forEach(item => {
            price += Number(item.preco || 0);
        });

        return price;
    }, [product.preco, selectedFlavors, selections]);

    const nextStep = () => {
        if (selectedFlavors.length < minFlavors) {
            toast.error(`Selecione pelo menos ${minFlavors} sabor(es)`);
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

    const addToCart = () => {
        const complementos = Object.entries(selections).map(([grupoId, items]) => {
            const grupo = additionalGroups.find(g => g.id === Number(grupoId));
            return {
                grupoId: Number(grupoId),
                grupoNome: grupo?.nome || '',
                items: items.map(i => ({
                    id: i.id,
                    nome: i.nome,
                    preco: i.preco,
                    fator_proporcao: 1
                }))
            };
        });

        const saborNomes = selectedFlavors.map(f => f.nome).join(' / ');

        if (editingItemId) {
            updateItem(editingItemId, {
                nome: `${product.nome} (${saborNomes})`,
                preco: finalPrice,
                complementos,
                observacao,
            });
            toast.success(`${product.nome} atualizado!`);
        } else {
            addItem({
                productId: product._grupoId,
                nome: `${product.nome} (${saborNomes})`,
                preco: finalPrice,
                quantidade: 1,
                complementos,
                observacao,
                isComposite: true,
                grupoId: product._grupoId
            });
            toast.success(`${product.nome} adicionado ao carrinho!`);
        }

        setObservacao('');
        setStep('flavors');
        onClose();
    };

    const fmt = (price: number) => `R$ ${price.toFixed(2).replace('.', ',')}`;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white">{product.nome}</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {step === 'flavors' && `Escolha de ${minFlavors} a ${maxFlavors} sabores`}
                                {step === 'additions' && 'Turbine seu pedido com adicionais'}
                                {step === 'observation' && 'Alguma observação?'}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                            <X className="size-6 text-slate-400" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        {step === 'flavors' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {product.items?.map((flavor: any) => {
                                    const isSelected = selectedFlavors.find(f => f.id === flavor.id);
                                    return (
                                        <button
                                            key={flavor.id}
                                            onClick={() => toggleFlavor(flavor)}
                                            className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${isSelected
                                                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-md shadow-amber-100 dark:shadow-none'
                                                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-white dark:bg-slate-800'
                                                }`}
                                        >
                                            <div className="text-left">
                                                <p className="font-bold text-slate-800 dark:text-slate-200">{flavor.nome}</p>
                                                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">{fmt(flavor.preco)}</p>
                                            </div>
                                            <div className={`size-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-amber-500 border-amber-500' : 'border-slate-200 dark:border-slate-700'
                                                }`}>
                                                {isSelected && <Check className="size-4 text-white" />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {step === 'additions' && (
                            <div className="space-y-8">
                                {additionalGroups.map(group => (
                                    <div key={group.id} className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{group.nome}</h3>
                                            <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded-md uppercase">
                                                Até {group.maximo || 99} itens
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {group.items?.map((item: any) => {
                                                const isSelected = (selections[group.id] || []).find(i => i.id === item.id);
                                                return (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => toggleAddition(group, item)}
                                                        className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${isSelected
                                                                ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 shadow-md shadow-violet-100 dark:shadow-none'
                                                                : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-white dark:bg-slate-800'
                                                            }`}
                                                    >
                                                        <div className="text-left">
                                                            <p className="font-bold text-slate-800 dark:text-slate-200">{item.nome}</p>
                                                            <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">+ {fmt(item.preco)}</p>
                                                        </div>
                                                        <div className={`size-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-violet-500 border-violet-500' : 'border-slate-200 dark:border-slate-700'
                                                            }`}>
                                                            {isSelected && <Check className="size-4 text-white" />}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {step === 'observation' && (
                            <div className="space-y-4">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Alguma observação para este item?</label>
                                <textarea
                                    value={observacao}
                                    onChange={(e) => setObservacao(e.target.value)}
                                    placeholder="Ex: Sem cebola, bem passado, etc..."
                                    className="w-full h-32 p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-violet-500 focus:ring-0 transition-all resize-none"
                                />
                            </div>
                        )}
                    </div>

                    <div className="shrink-0 p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total do item</p>
                                <p className="text-2xl font-black text-slate-900 dark:text-white">{fmt(finalPrice)}</p>
                            </div>
                            <div className="flex gap-2">
                                {step !== 'flavors' && (
                                    <button
                                        onClick={() => {
                                            if (step === 'observation') {
                                                if (hasAdditions) setStep('additions');
                                                else setStep('flavors');
                                            } else if (step === 'additions') {
                                                setStep('flavors');
                                            }
                                        }}
                                        className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700"
                                    >
                                        <ChevronLeft className="size-6" />
                                    </button>
                                )}
                                <button
                                    onClick={nextStep}
                                    className={`px-8 py-3 text-white font-bold rounded-xl transition-colors flex items-center gap-2 shadow-lg ${step === 'observation'
                                            ? 'bg-green-500 hover:bg-green-600 shadow-green-200'
                                            : 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'
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
