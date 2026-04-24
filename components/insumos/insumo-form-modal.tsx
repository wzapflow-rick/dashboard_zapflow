'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, PackageOpen } from 'lucide-react';
import { CurrencyInput } from '@/components/ui/currency-input';
import { MobileDrawer } from '@/components/ui/mobile-drawer';
import { Insumo } from '@/app/actions/insumos';

interface InsumoFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingInsumo: Insumo | null;
    onSubmit: (formData: FormData) => Promise<void>;
}

export default function InsumoFormModal({ isOpen, onClose, editingInsumo, onSubmit }: InsumoFormModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedUnit, setSelectedUnit] = useState(editingInsumo?.unidade_medida || 'UN');
    const [embalagemPreco, setEmbalagemPreco] = useState<number>(0);
    const [embalagemQuantidade, setEmbalagemQuantidade] = useState<number>(1);

    useEffect(() => {
        setIsSubmitting(false);
        if (editingInsumo) {
            setSelectedUnit(editingInsumo.unidade_medida || 'UN');
            setEmbalagemPreco(0);
            setEmbalagemQuantidade(1);
        }
    }, [isOpen, editingInsumo]);

    const UNIDADES: Record<string, string> = {
        'KG': 'kg',
        'G': 'g',
        'L': 'L',
        'ML': 'ml',
        'UN': 'un',
        'CX': 'cx',
        'PCT': 'pct',
    };

    const unidadeLabel = UNIDADES[selectedUnit] || selectedUnit.toLowerCase();

    const calcularCustoPorUnidade = () => {
        if (embalagemPreco > 0 && embalagemQuantidade > 0) {
            return embalagemPreco / embalagemQuantidade;
        }
        return 0;
    };

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
        <MobileDrawer
            isOpen={isOpen}
            onClose={onClose}
            title={editingInsumo ? 'Editar Insumo' : 'Novo Insumo'}
            size="lg"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Nome do Insumo</label>
                            <input
                                name="nome"
                                defaultValue={editingInsumo?.nome}
                                required
                                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                placeholder="Ex: Farinha de Trigo, Queijo Muçarela, Calabresa"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Qtd Atual no Estoque</label>
                                <input
                                    name="quantidade_atual"
                                    type="number"
                                    step="0.001"
                                    defaultValue={editingInsumo?.quantidade_atual ?? 0}
                                    required
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                    placeholder="Ex: 5.5"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Unidade Medida</label>
                                <select
                                    name="unidade_medida"
                                    value={selectedUnit}
                                    onChange={(e) => setSelectedUnit(e.target.value)}
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer"
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
                                <label className="text-[10px] sm:text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Alerta de Estoque Baixo</label>
                                <input
                                    name="estoque_minimo"
                                    type="number"
                                    step="0.001"
                                    defaultValue={editingInsumo?.estoque_minimo ?? 1}
                                    required
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-orange-500/20 outline-none transition-all placeholder:text-orange-300 dark:placeholder:text-orange-700"
                                    placeholder="Ex: 2"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                                    Custo por {unidadeLabel}
                                </label>
                                <CurrencyInput
                                    name="custo_por_unidade"
                                    required
                                    defaultValue={editingInsumo?.custo_por_unidade ?? 0}
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                                />
                                <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 font-medium leading-tight text-center">
                                    Quanto custa 1 {unidadeLabel}?
                                </p>
                            </div>
                        </div>

                        {/* Cálculo rápido por embalagem */}
                        <div className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-3 sm:p-4">
                            <p className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
                                Calcular custo por embalagem
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">Preço total pago</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={embalagemPreco}
                                        onChange={(e) => setEmbalagemPreco(Number(e.target.value) || 0)}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm dark:text-white"
                                        placeholder="R$ 0,00"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">Quantidade na embalagem</label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        value={embalagemQuantidade}
                                        onChange={(e) => setEmbalagemQuantidade(Number(e.target.value) || 1)}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm dark:text-white"
                                    />
                                </div>
                            </div>
                            {embalagemPreco > 0 && embalagemQuantidade > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                        Custo por {unidadeLabel}: 
                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-1">
                                            R$ {(embalagemPreco / embalagemQuantidade).toFixed(4)}/{unidadeLabel}
                                        </span>
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const custo = calcularCustoPorUnidade();
                                            if (custo > 0) {
                                                const input = document.querySelector('input[name="custo_por_unidade"]') as HTMLInputElement;
                                                if (input) {
                                                    input.value = custo.toFixed(2);
                                                    input.dispatchEvent(new Event('input', { bubbles: true }));
                                                }
                                            }
                                        }}
                                        className="mt-2 text-[10px] text-primary font-medium hover:underline"
                                    >
                                        Aplicar este custo
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="pt-2 sm:pt-4 flex flex-col sm:flex-row gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="order-2 sm:order-1 flex-1 px-6 py-2.5 sm:py-3 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-sm disabled:opacity-50"
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
        </MobileDrawer>
    );
}
