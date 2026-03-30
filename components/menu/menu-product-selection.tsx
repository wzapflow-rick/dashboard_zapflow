'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { X, Plus, Minus, MessageCircle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MenuProductSelectionProps {
    product: any;
    whatsappNumber: string;
    empresaNome: string;
    formatPrice: (price: any) => string;
}

export default function MenuProductSelection({ product, whatsappNumber, empresaNome, formatPrice }: MenuProductSelectionProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selections, setSelections] = useState<Record<number, any[]>>({});

    const hasComplements = product.complementGroups && product.complementGroups.length > 0;

    const toggleItem = (grupoId: number, item: any, max: number, type: string) => {
        const current = selections[grupoId] || [];
        const isSelected = current.find(i => i.id === item.id);

        if (isSelected) {
            setSelections({
                ...selections,
                [grupoId]: current.filter(i => i.id !== item.id)
            });
        } else {
            if (current.length < (max || 999)) {
                setSelections({
                    ...selections,
                    [grupoId]: [...current, item]
                });
            } else if (max === 1) {
                setSelections({
                    ...selections,
                    [grupoId]: [item]
                });
            }
        }
    };

    const finalPrice = useMemo(() => {
        let price = Number(product.preco || 0);

        if (!hasComplements) return price;

        product.complementGroups.forEach((grupo: any) => {
            const selectedItems = selections[grupo.id] || [];
            if (selectedItems.length === 0) return;

            const type = grupo.tipo_calculo || 'Soma';
            const prices = selectedItems.map(i => Number(i.preco || 0));

            if (type === 'Soma') {
                const total = prices.reduce((a, b) => a + b, 0);
                price += total;
            } else if (type === 'Média') {
                const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
                price = Math.max(price, avg); // usually base price or average
            } else if (type === 'Maior Valor') {
                const max = Math.max(...prices);
                price = Math.max(price, max);
            }
        });

        return price;
    }, [product, selections, hasComplements]);

    const handleOrder = () => {
        let message = `*Novo Pedido - ${empresaNome}*\n\n`;
        message += `*Item:* ${product.nome}\n`;

        product.complementGroups?.forEach((grupo: any) => {
            const selected = selections[grupo.id] || [];
            if (selected.length > 0) {
                message += `\n*${grupo.nome}:*\n`;
                selected.forEach(i => {
                    message += `- ${i.nome}${Number(i.preco) > 0 ? ` (+${formatPrice(i.preco)})` : ''}\n`;
                });
            }
        });

        message += `\n*Total:* ${formatPrice(finalPrice)}`;

        const url = `https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
        setIsOpen(false);
    };

    const isSelectionValid = useMemo(() => {
        if (!hasComplements) return true;

        return product.complementGroups.every((grupo: any) => {
            const selectedCount = (selections[grupo.id] || []).length;
            const min = Number(grupo.minimo || 0);
            return selectedCount >= min;
        });
    }, [product, selections, hasComplements]);

    return (
        <>
            <button
                onClick={() => hasComplements ? setIsOpen(true) : null}
                className="w-full text-left"
            >
                {/* Product Card Body (Trigger) */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex gap-4 hover:shadow-md transition-all cursor-pointer">
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
                        <div className="mt-auto pt-2 flex items-center justify-between">
                            <span className="text-base font-black text-violet-600">
                                {formatPrice(product.preco)}
                            </span>
                            {whatsappNumber && (
                                <div className="text-xs font-bold text-green-600 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-all">
                                    {hasComplements ? 'Escolher 🛒' :
                                        <a
                                            href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Quero pedir: ${product.nome} - ${formatPrice(product.preco)}`)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            Pedir 🛒
                                        </a>
                                    }
                                </div>
                            )}
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
                            {/* Header */}
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
                                {product.complementGroups.map((grupo: any) => (
                                    <div key={grupo.id} className="space-y-4">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <h3 className="font-bold text-slate-900">{grupo.nome}</h3>
                                                <p className="text-xs text-slate-500">
                                                    {Number(grupo.minimo) > 0 ? `Mínimo ${grupo.minimo} • ` : ''}
                                                    Máximo {grupo.maximo || 'ilimitado'}
                                                </p>
                                            </div>
                                            {Number(grupo.minimo) > 0 && (selections[grupo.id]?.length || 0) < Number(grupo.minimo) && (
                                                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-md uppercase">Obrigatório</span>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            {grupo.items.map((item: any) => {
                                                const isSelected = (selections[grupo.id] || []).find(i => i.id === item.id);
                                                return (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => toggleItem(grupo.id, item, grupo.maximo, grupo.tipo_calculo)}
                                                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${isSelected
                                                                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                                                : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                                                            }`}
                                                    >
                                                        <div className="text-left">
                                                            <p className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-slate-700'}`}>{item.nome}</p>
                                                            {Number(item.preco) > 0 && (
                                                                <p className="text-xs text-slate-500 font-medium">+{formatPrice(item.preco)}</p>
                                                            )}
                                                        </div>
                                                        <div className={`size-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary' : 'border-slate-300 bg-white'
                                                            }`}>
                                                            {isSelected && <Check className="size-3 text-white stroke-[4]" />}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Footer */}
                            <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Subtotal</span>
                                    <span className="text-xl font-black text-slate-900">{formatPrice(finalPrice)}</span>
                                </div>
                                <button
                                    disabled={!isSelectionValid}
                                    onClick={handleOrder}
                                    className="w-full bg-green-500 hover:bg-green-600 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl shadow-lg shadow-green-500/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                                >
                                    <MessageCircle className="size-5" />
                                    Confirmar Pedido
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
