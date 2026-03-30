'use client';

import React, { useState } from 'react';
import { Package, X, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Insumo } from '@/app/actions/insumos';

interface QuickRestockModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (id: number, quantity: number) => Promise<void>;
    insumo: Insumo | null;
}

export default function QuickRestockModal({ isOpen, onClose, onConfirm, insumo }: QuickRestockModalProps) {
    const [quantity, setQuantity] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen || !insumo) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numQty = parseFloat(quantity.replace(',', '.'));
        if (isNaN(numQty)) return;

        setIsSubmitting(true);
        try {
            await onConfirm(insumo.id, numQty);
            setQuantity('');
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                >
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                                    <Package className="size-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">Reposição Rápida</h3>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{insumo.nome}</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                <X className="size-5 text-slate-400" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nova Quantidade Atual ({insumo.unidade_medida})</label>
                                <div className="relative">
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder={`Ex: 5.50`}
                                        className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 text-xl font-black focus:border-primary/30 focus:bg-white outline-none transition-all placeholder:text-slate-300"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        disabled={isSubmitting}
                                    />
                                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                                        {insumo.unidade_medida}
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400 font-bold px-1 italic">
                                    * Informe o valor total que você tem agora no estoque.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting || !quantity}
                                className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
                                ATUALIZAR ESTOQUE
                            </button>
                        </form>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
