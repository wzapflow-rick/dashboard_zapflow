'use client';

import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ItemModalProps {
    isOpen: boolean;
    activeGrupo: any;
    onClose: () => void;
    editingItem: any;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export function ItemModal({
    isOpen,
    activeGrupo,
    onClose,
    editingItem,
    onSubmit
}: ItemModalProps) {
    return (
        <AnimatePresence>
            {isOpen && activeGrupo && (
                <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" />
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden border border-slate-200 dark:border-slate-700">
                        <form onSubmit={onSubmit}>
                            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                <h3 className="text-xl font-bold text-slate-800">{editingItem ? 'Editar Opção' : 'Nova Opção'}</h3>
                                <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="size-5" /></button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nome da Opção</label>
                                    <input name="nome" type="text" defaultValue={editingItem?.nome} required className="mt-1.5 w-full bg-slate-50 px-4 py-2.5 rounded-lg text-sm border-none focus:ring-2 focus:ring-primary/20 outline-none" placeholder="Ex: Calabresa, Extra Bacon" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Preço Extra (R$)</label>
                                    <input name="preco" type="number" step="0.01" min="0" defaultValue={editingItem?.preco ?? 0} required className="mt-1.5 w-full bg-slate-50 px-4 py-2.5 rounded-lg text-sm border-none focus:ring-2 focus:ring-primary/20 outline-none" placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Descrição Opcional</label>
                                    <textarea name="descricao" defaultValue={editingItem?.descricao} rows={2} className="mt-1.5 w-full bg-slate-50 px-4 py-2.5 rounded-lg text-sm border-none focus:ring-2 focus:ring-primary/20 outline-none" placeholder="Ex: Molho de tomate, mussarela e calabresa..."></textarea>
                                </div>
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <label className="text-xs font-bold text-amber-700 uppercase tracking-wider block mb-1">Fator de Proporção do Insumo</label>
                                    <input name="fator_proporcao" type="number" step="0.01" min="0.01" max="1" defaultValue={editingItem?.fator_proporcao ?? 1} className="w-full bg-white px-4 py-2.5 rounded-lg text-sm border border-amber-200 focus:ring-2 focus:ring-amber-200 outline-none" />
                                    <p className="text-xs text-amber-600 mt-1">
                                        Define quanto dos insumos é usado: <strong>0.5</strong> = metade (pizza 2 sabores), <strong>0.33</strong> = 1/3 (3 sabores), <strong>1.0</strong> = inteiro
                                    </p>
                                </div>
                                <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                                    <input name="status" type="checkbox" defaultChecked={editingItem ? editingItem.status : true} className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary" />
                                    <span className="text-sm font-semibold text-slate-700">Ativo no Cardápio</span>
                                </label>
                            </div>
                            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
                                <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
                                <button type="submit" className="px-5 py-2.5 text-sm font-semibold bg-primary text-white hover:bg-primary/90 rounded-lg transition-colors shadow-sm">Salvar Opção</button>
                            </div>
                        </form>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
