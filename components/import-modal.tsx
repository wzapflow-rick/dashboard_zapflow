'use client';

import React from 'react';
import { X, Search, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface ImportModalProps {
    isOpen: boolean;
    activeGrupo: any;
    onClose: () => void;
    produtos: any[];
    categorias: any[];
    itensDoGrupo: any[];
    selectedProdutosToImport: number[];
    setSelectedProdutosToImport: (ids: number[] | ((prev: number[]) => number[])) => void;
    importSearch: string;
    setImportSearch: (s: string) => void;
    importFator: number;
    setImportFator: (f: number) => void;
    activeCatTab: number | null;
    setActiveCatTab: (c: number | null) => void;
    importing: boolean;
    onImport: () => void;
}

export function ImportModal({
    isOpen,
    activeGrupo,
    onClose,
    produtos,
    categorias,
    itensDoGrupo,
    selectedProdutosToImport,
    setSelectedProdutosToImport,
    importSearch,
    setImportSearch,
    importFator,
    setImportFator,
    activeCatTab,
    setActiveCatTab,
    importing,
    onImport
}: ImportModalProps) {
    return (
        <AnimatePresence>
            {isOpen && activeGrupo && (
                <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" />
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl bg-white rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[88vh]">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 flex justify-between items-start shrink-0">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Selecionar Produtos do Catálogo</h3>
                                <p className="text-sm text-slate-500 mt-0.5">Escolha os itens para o grupo <b>{activeGrupo.nome}</b></p>
                            </div>
                            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="size-5" /></button>
                        </div>

                        {/* Fator + Search bar */}
                        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 shrink-0 flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar produto..."
                                    value={importSearch}
                                    onChange={e => setImportSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 rounded-lg bg-white border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <label className="text-xs font-bold text-amber-700 whitespace-nowrap">Fator de Proporção:</label>
                                <input
                                    type="number" step="0.01" min="0.01" max="1"
                                    value={importFator}
                                    onChange={e => setImportFator(Number(e.target.value))}
                                    className="w-20 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm font-bold text-amber-800 text-center focus:ring-2 focus:ring-amber-200 outline-none"
                                />
                                <span className="text-xs text-slate-500">(0.5 = metade)</span>
                            </div>
                        </div>

                        {/* Category Tabs */}
                        {categorias.length > 0 && (
                            <div className="flex gap-2 px-5 py-2 border-b border-slate-100 overflow-x-auto shrink-0 custom-scrollbar">
                                <button
                                    onClick={() => setActiveCatTab(null)}
                                    className={cn('px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors', activeCatTab === null ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                                >
                                    Todos
                                </button>
                                {categorias.map((cat: any) => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setActiveCatTab(cat.id)}
                                        className={cn('px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors', activeCatTab === cat.id ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                                    >
                                        {cat.nome}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Product List */}
                        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                            {(() => {
                                const search = importSearch.toLowerCase();
                                const filtered = produtos.filter(p => {
                                    const matchSearch = !search || p.nome?.toLowerCase().includes(search);
                                    const matchCat = activeCatTab === null || p.categoria_id === activeCatTab;
                                    return matchSearch && matchCat;
                                });

                                if (filtered.length === 0) return (
                                    <div className="text-center py-10 text-slate-400"><p>Nenhum produto encontrado.</p></div>
                                );

                                // Group by category for display
                                const byCat = new Map<string, any[]>();
                                filtered.forEach(p => {
                                    const catName = categorias.find((c: any) => c.id === p.categoria_id)?.nome || 'Sem Categoria';
                                    if (!byCat.has(catName)) byCat.set(catName, []);
                                    byCat.get(catName)!.push(p);
                                });

                                return Array.from(byCat.entries()).map(([catName, prods]) => (
                                    <div key={catName} className="mb-6">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <span className="h-px flex-1 bg-slate-100" />
                                            {catName}
                                            <span className="h-px flex-1 bg-slate-100" />
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {prods.map(p => {
                                                const alreadyImported = itensDoGrupo.some(i => i.nome === p.nome);
                                                const isSelected = selectedProdutosToImport.includes(p.id);
                                                return (
                                                    <label key={p.id} className={cn(
                                                        "flex items-center gap-3 p-3 border rounded-xl transition-all",
                                                        alreadyImported ? "opacity-40 cursor-not-allowed border-slate-200 bg-slate-50" :
                                                            isSelected ? "border-primary bg-primary/5 cursor-pointer" :
                                                                "cursor-pointer bg-white hover:border-primary/40 hover:bg-primary/5 border-slate-200"
                                                    )}>
                                                        <input
                                                            type="checkbox"
                                                            disabled={alreadyImported}
                                                            className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary shrink-0"
                                                            checked={isSelected}
                                                            onChange={(e) => {
                                                                if (e.target.checked) setSelectedProdutosToImport(prev => [...prev, p.id]);
                                                                else setSelectedProdutosToImport(prev => prev.filter(id => id !== p.id));
                                                            }}
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <p className={cn("text-sm font-bold truncate", isSelected ? 'text-primary' : 'text-slate-800')}>
                                                                {p.nome}
                                                                {alreadyImported && <span className="ml-2 text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-bold">Já adicionado</span>}
                                                            </p>
                                                            <p className="text-xs text-slate-500 font-medium">R$ {(Number(p.preco) || 0).toFixed(2).replace('.', ',')}</p>
                                                        </div>
                                                        {isSelected && <Check className="size-4 text-primary shrink-0" />}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-white shrink-0">
                            <div className="text-sm text-slate-500">
                                <span className="font-bold text-slate-800">{selectedProdutosToImport.length}</span> selecionado(s) ·
                                <span className="text-amber-700 font-bold ml-1">Fator: {importFator}</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setSelectedProdutosToImport([]); }}
                                    className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                                >Limpar</button>
                                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                                <button
                                    onClick={onImport}
                                    disabled={selectedProdutosToImport.length === 0 || importing}
                                    className="px-5 py-2 text-sm font-semibold bg-primary text-white hover:bg-primary/90 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                                >
                                    <Check className="size-4" />
                                    {importing ? 'Importando...' : `Adicionar ${selectedProdutosToImport.length} ao Grupo`}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
