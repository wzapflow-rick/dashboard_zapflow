'use client';

import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GrupoModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingGrupo: any;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export function GrupoModal({
    isOpen,
    onClose,
    editingGrupo,
    onSubmit
}: GrupoModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" />
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-xl z-50 overflow-hidden">
                        <form onSubmit={onSubmit}>
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="text-xl font-bold text-slate-800">{editingGrupo ? 'Editar Grupo' : 'Novo Grupo'}</h3>
                                <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="size-5" /></button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nome do Grupo</label>
                                    <input name="nome" type="text" defaultValue={editingGrupo?.nome} required className="mt-1.5 w-full bg-slate-50 px-4 py-2.5 rounded-lg text-sm border-none focus:ring-2 focus:ring-primary/20 outline-none" placeholder="Ex: Sabores, Tamanho, Adicionais" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Qtd. Mínima</label>
                                        <input name="minimo" type="number" min="0" defaultValue={editingGrupo?.minimo ?? 0} required className="mt-1.5 w-full bg-slate-50 px-4 py-2.5 rounded-lg text-sm border-none focus:ring-2 focus:ring-primary/20 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Qtd. Máxima</label>
                                        <input name="maximo" type="number" min="1" defaultValue={editingGrupo?.maximo ?? 1} required className="mt-1.5 w-full bg-slate-50 px-4 py-2.5 rounded-lg text-sm border-none focus:ring-2 focus:ring-primary/20 outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Regra de Precificação</label>
                                    <select name="tipo_calculo" defaultValue={editingGrupo?.tipo_calculo || 'soma'} className="mt-1.5 w-full bg-slate-50 px-4 py-2.5 rounded-lg text-sm border-none focus:ring-2 focus:ring-primary/20 outline-none">
                                        <option value="soma">Soma (Ex: Hambúrguer. Custa A + B)</option>
                                        <option value="maior_valor">Maior Valor (Ex: Pizza. Custa o sabor mais caro)</option>
                                        <option value="media">Média (Ex: Pizza. Custa a média dos sabores)</option>
                                    </select>
                                </div>
                                <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                                    <input name="obrigatorio" type="checkbox" defaultChecked={editingGrupo ? editingGrupo.obrigatorio : true} className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary" />
                                    <span className="text-sm font-semibold text-slate-700">Seleção Obrigatória</span>
                                </label>
                                <label className="flex items-center gap-3 p-3 border border-amber-200 bg-amber-50 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors">
                                    <input name="cobrar_mais_caro" type="checkbox" defaultChecked={editingGrupo?.cobrar_mais_caro || false} className="w-4 h-4 text-amber-500 rounded border-amber-300 focus:ring-amber-300" />
                                    <div>
                                        <span className="text-sm font-bold text-amber-800 block">🍕 Cobrar pelo sabor mais caro</span>
                                        <span className="text-xs text-amber-600">Ex: pizza com 2 sabores cobra o preço do mais caro</span>
                                    </div>
                                </label>
                                <label className="flex items-center gap-3 p-3 border border-violet-200 bg-violet-50 rounded-lg cursor-pointer hover:bg-violet-100 transition-colors">
                                    <input name="produto_composto" type="checkbox" defaultChecked={editingGrupo?.produto_composto || false} className="w-4 h-4 text-violet-500 rounded border-violet-300 focus:ring-violet-300" />
                                    <div>
                                        <span className="text-sm font-bold text-violet-800 block">✨ Produto Composto (exibir no cardápio)</span>
                                        <span className="text-xs text-violet-600">O grupo aparece como produto vendável — cliente escolhe os sabores</span>
                                    </div>
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Descrição</label>
                                        <input name="descricao" type="text" defaultValue={editingGrupo?.descricao || ''} className="mt-1.5 w-full bg-slate-50 px-4 py-2.5 rounded-lg text-sm border-none focus:ring-2 focus:ring-primary/20 outline-none" placeholder="Ex: 6 fatias, borda tradicional" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">URL da Imagem</label>
                                        <input name="imagem" type="text" defaultValue={editingGrupo?.imagem || ''} className="mt-1.5 w-full bg-slate-50 px-4 py-2.5 rounded-lg text-sm border-none focus:ring-2 focus:ring-primary/20 outline-none" placeholder="https://..." />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total de Slots (para fracionamento)</label>
                                    <input name="total_slots" type="number" min="1" defaultValue={editingGrupo?.total_slots ?? editingGrupo?.maximo ?? 1} className="mt-1.5 w-full bg-slate-50 px-4 py-2.5 rounded-lg text-sm border-none focus:ring-2 focus:ring-primary/20 outline-none" placeholder="Ex: 2 para Meio a Meio" />
                                    <p className="text-xs text-slate-400 mt-1">Defina quantas partes o produto pode ser dividido (ex: 2 = meio a meio, 3 = três sabores 1/3 cada).</p>
                                </div>
                            </div>
                            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
                                <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
                                <button type="submit" className="px-5 py-2.5 text-sm font-semibold bg-primary text-white hover:bg-primary/90 rounded-lg transition-colors shadow-sm">Salvar Grupo</button>
                            </div>
                        </form>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
