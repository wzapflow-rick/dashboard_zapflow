'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, Loader2, CheckCircle2, ChevronRight, PackageOpen } from 'lucide-react';
import { bulkCreateComplements } from '@/app/actions/complements';
import { toast } from 'sonner';

interface BulkComplementModalProps {
    isOpen: boolean;
    onClose: () => void;
    products: any[];
    grupos: any[];
    onSuccess: () => void;
}

export default function BulkComplementModal({
    isOpen,
    onClose,
    products,
    grupos,
    onSuccess
}: BulkComplementModalProps) {
    const [selectedGrupoId, setSelectedGrupoId] = useState<string>('');
    const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const filteredProducts = products.filter(p =>
        p.nome.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleProduct = (id: number) => {
        const next = new Set(selectedProductIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedProductIds(next);
    };

    const handleSelectAll = () => {
        if (selectedProductIds.size === filteredProducts.length) {
            setSelectedProductIds(new Set());
        } else {
            setSelectedProductIds(new Set(filteredProducts.map(p => p.id)));
        }
    };

    const handleSubmit = async () => {
        if (!selectedGrupoId) {
            toast.error('Selecione um grupo de destino');
            return;
        }
        if (selectedProductIds.size === 0) {
            toast.error('Selecione pelo menos um produto');
            return;
        }

        setIsSubmitting(true);
        try {
            const selectedProducts = products.filter(p => selectedProductIds.has(p.id));
            await bulkCreateComplements(Number(selectedGrupoId), selectedProducts);
            toast.success(`${selectedProductIds.size} complementos criados com sucesso!`);
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Erro ao criar complementos em massa');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-700"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800 relative z-10">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                    <CheckCircle2 className="size-5 text-violet-500" />
                                    Cadastrar em Massa
                                </h2>
                                <p className="text-xs text-slate-500 font-medium mt-1">
                                    Transforme produtos existentes em complementos de um grupo.
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Step 1: Group Selection */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                    1. Escolha o Grupo de Destino
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    <select
                                        value={selectedGrupoId}
                                        onChange={(e) => setSelectedGrupoId(e.target.value)}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-violet-500/20 outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">Selecione um grupo...</option>
                                        {grupos.map((g) => (
                                            <option key={g.id} value={g.id}>{g.nome}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Step 2: Product Selection */}
                            <div className="space-y-3 flex flex-col h-[400px]">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                        2. Selecione os Produtos ({selectedProductIds.size})
                                    </label>
                                    <button
                                        onClick={handleSelectAll}
                                        className="text-[10px] font-bold text-violet-600 hover:text-violet-700 uppercase tracking-wider"
                                    >
                                        {selectedProductIds.size === filteredProducts.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                                    </button>
                                </div>

                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar no cardápio..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full h-11 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500/20 outline-none transition-all"
                                    />
                                </div>

                                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-1 mt-2">
                                    {filteredProducts.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 opacity-60">
                                            <PackageOpen className="size-10" />
                                            <p className="text-xs font-medium">Nenhum produto encontrado</p>
                                        </div>
                                    ) : (
                                        filteredProducts.map((product) => (
                                            <div
                                                key={product.id}
                                                onClick={() => toggleProduct(product.id)}
                                                className={`
                                                    flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all border
                                                    ${selectedProductIds.has(product.id)
                                                        ? 'bg-violet-50 border-violet-100 shadow-sm'
                                                        : 'bg-white border-transparent hover:bg-slate-50'}
                                                `}
                                            >
                                                <div className={`
                                                    size-5 rounded-lg flex items-center justify-center transition-all border-2
                                                    ${selectedProductIds.has(product.id)
                                                        ? 'bg-violet-500 border-violet-500 text-white'
                                                        : 'bg-white border-slate-200'}
                                                `}>
                                                    {selectedProductIds.has(product.id) && <X className="size-3" />}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className={`text-sm font-bold transition-colors ${selectedProductIds.has(product.id) ? 'text-violet-900' : 'text-slate-700'}`}>
                                                        {product.nome}
                                                    </p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                                                        R$ {Number(product.preco).toFixed(2)}
                                                    </p>
                                                </div>
                                                <ChevronRight className={`size-4 transition-transform ${selectedProductIds.has(product.id) ? 'text-violet-400 rotate-90' : 'text-slate-300'}`} />
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 px-8">
                            <button
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || !selectedGrupoId || selectedProductIds.size === 0}
                                className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-sm font-black shadow-lg shadow-slate-900/20 hover:bg-slate-800 disabled:bg-slate-200 disabled:shadow-none transition-all flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="size-4 animate-spin" />
                                        Processando...
                                    </>
                                ) : (
                                    <>
                                        Cadastrar {selectedProductIds.size} Itens
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
