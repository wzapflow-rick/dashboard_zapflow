'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, PackageOpen } from 'lucide-react';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Insumo } from '@/app/actions/insumos';

interface InsumoFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingInsumo: Insumo | null;
    onSubmit: (formData: FormData) => Promise<void>;
}

export default function InsumoFormModal({ isOpen, onClose, editingInsumo, onSubmit }: InsumoFormModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setIsSubmitting(false);
    }, [isOpen, editingInsumo]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);
        try {
            await onSubmit(formData);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
                    className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                >
                    <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                <PackageOpen className="size-5" />
                            </div>
                            <div>
                                <h2 className="text-lg sm:text-xl font-bold text-slate-900">{editingInsumo ? 'Editar Insumo' : 'Novo Insumo'}</h2>
                                <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">Gerencie seu estoque e custos.</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                            <X className="size-5 text-slate-500" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto custom-scrollbar">
                        <div className="space-y-1.5">
                            <label className="text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider">Nome do Insumo</label>
                            <input
                                name="nome"
                                defaultValue={editingInsumo?.nome}
                                required
                                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                placeholder="Ex: Farinha de Trigo, Queijo Muçarela, Calabresa"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider">Qtd Atual no Estoque</label>
                                <input
                                    name="quantidade_atual"
                                    type="number"
                                    step="0.001"
                                    defaultValue={editingInsumo?.quantidade_atual ?? 0}
                                    required
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    placeholder="Ex: 5.5"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider">Unidade Medida</label>
                                <select
                                    name="unidade_medida"
                                    defaultValue={editingInsumo?.unidade_medida || 'UN'}
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer"
                                >
                                    <option value="KG">Quilogramas (kg)</option>
                                    <option value="G">Gramas (g)</option>
                                    <option value="L">Litros (L)</option>
                                    <option value="ML">Mililitros (ml)</option>
                                    <option value="UN">Unidades (un)</option>
                                    <option value="CX">Caixas (cx)</option>
                                    <option value="PCT">Pacotes (pct)</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] sm:text-xs font-bold text-orange-600 uppercase tracking-wider">Alerta de Estoque Baixo</label>
                                <input
                                    name="estoque_minimo"
                                    type="number"
                                    step="0.001"
                                    defaultValue={editingInsumo?.estoque_minimo ?? 1}
                                    required
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-orange-50/50 border border-orange-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                                    placeholder="Ex: 2"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] sm:text-xs font-bold text-emerald-700 uppercase tracking-wider">Custo / Un. de Medida</label>
                                <CurrencyInput
                                    name="custo_por_unidade"
                                    required
                                    defaultValue={editingInsumo?.custo_por_unidade ?? 0}
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-emerald-50/30 border border-emerald-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                                />
                                <p className="text-[9px] text-slate-400 mt-1 font-medium leading-tight text-center">Referência (p/ 1 KG, 1 UN, etc)</p>
                            </div>
                        </div>

                        <div className="pt-2 sm:pt-4 flex flex-col sm:flex-row gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="order-2 sm:order-1 flex-1 px-6 py-2.5 sm:py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all text-sm disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="order-1 sm:order-2 flex-1 px-6 py-2.5 sm:py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                            >
                                <Check className="size-4" />
                                {isSubmitting ? 'Salvando...' : 'Salvar Insumo'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
