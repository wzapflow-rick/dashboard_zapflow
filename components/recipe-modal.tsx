'use client';

import React from 'react';
import { X, Trash2, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RecipeModalProps {
    isOpen: boolean;
    editingItemForRecipe: any;
    recipeForGrupo: any;
    onClose: () => void;
    recipe: any[];
    setRecipe: (r: any[]) => void;
    insumosList: any[];
    savingRecipe: boolean;
    onSaveRecipe: () => void;
}

export function RecipeModal({
    isOpen,
    editingItemForRecipe,
    recipeForGrupo,
    onClose,
    recipe,
    setRecipe,
    insumosList,
    savingRecipe,
    onSaveRecipe
}: RecipeModalProps) {
    return (
        <AnimatePresence>
            {isOpen && editingItemForRecipe && (
                <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]" />
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-2xl shadow-2xl z-[60] overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">
                                    {recipeForGrupo ? 'Ficha Técnica do Grupo' : 'Ficha Técnica da Opção'}
                                </h3>
                                <p className="text-xs text-slate-500 font-medium">
                                    {recipeForGrupo ? recipeForGrupo.nome : editingItemForRecipe?.nome}
                                </p>
                            </div>
                            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 outline-none"><X className="size-5" /></button>
                        </div>

                        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                            <div className="space-y-3">
                                {recipe.map((r, idx) => (
                                    <div key={idx} className="flex gap-3 items-end p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="flex-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Insumo</label>
                                            <select
                                                value={r.insumo_id}
                                                onChange={(e) => {
                                                    const newRecipe = [...recipe];
                                                    newRecipe[idx].insumo_id = Number(e.target.value);
                                                    setRecipe(newRecipe);
                                                }}
                                                className="w-full bg-white px-3 py-2 rounded-lg text-sm border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                                            >
                                                <option value="">Selecionar Insumo...</option>
                                                {insumosList.map(insumo => (
                                                    <option key={insumo.id} value={insumo.id}>{insumo.nome} ({insumo.unidade_medida})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="w-24">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Qtd (1/1)</label>
                                            <input
                                                type="number"
                                                step="0.001"
                                                value={r.quantidade_necessaria}
                                                onChange={(e) => {
                                                    const newRecipe = [...recipe];
                                                    newRecipe[idx].quantidade_necessaria = Number(e.target.value);
                                                    setRecipe(newRecipe);
                                                }}
                                                className="w-full bg-white px-3 py-2 rounded-lg text-sm border border-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                                            />
                                        </div>
                                        <button
                                            onClick={() => setRecipe(recipe.filter((_, i) => i !== idx))}
                                            className="p-2 text-slate-400 hover:text-red-500"
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => setRecipe([...recipe, { insumo_id: 0, quantidade_necessaria: 0 }])}
                                className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-primary hover:border-primary hover:bg-primary/5 transition-all text-sm font-bold flex items-center justify-center gap-2"
                            >
                                <Plus className="size-4" /> Adicionar Insumo
                            </button>

                            {recipe.length > 0 && (() => {
                                const totalCusto = recipe.reduce((acc, r) => {
                                    const insumo = insumosList.find(i => i.id === r.insumo_id);
                                    return acc + (Number(insumo?.custo_por_unidade || 0) * Number(r.quantidade_necessaria));
                                }, 0);

                                // Se for grupo, ignora o fator de proporção (insumos do grupo são sempre 1/1 por produto vendido)
                                const fatorProp = recipeForGrupo ? 1 : Number(editingItemForRecipe?.fator_proporcao || 1);
                                const custoProporcional = totalCusto * fatorProp;

                                return (
                                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                                        <div className="text-xs text-slate-500 font-medium">
                                            {recipeForGrupo ? (
                                                'Custo Fixo por Venda'
                                            ) : (
                                                <>Custo Base (1/1): <span className="font-bold text-slate-700">R$ {totalCusto.toFixed(2).replace('.', ',')}</span></>
                                            )}
                                            {!recipeForGrupo && fatorProp < 1 && (
                                                <div className="text-[10px] text-amber-600 font-bold uppercase mt-0.5">
                                                    Fator de Proporção: {fatorProp}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                                                {recipeForGrupo ? 'Custo Fixo' : 'Custo Final Estimado'}
                                            </p>
                                            <p className="text-lg font-black text-primary">R$ {custoProporcional.toFixed(2).replace('.', ',')}</p>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
                            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
                            <button
                                onClick={onSaveRecipe}
                                disabled={savingRecipe}
                                className="px-5 py-2.5 text-sm font-semibold bg-primary text-white hover:bg-primary/90 rounded-lg transition-colors shadow-sm flex items-center gap-2"
                            >
                                {savingRecipe ? 'Salvando...' : 'Salvar Ficha Técnica'}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
