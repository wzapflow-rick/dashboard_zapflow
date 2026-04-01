'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Image as ImageIcon, Plus, Check, PackageOpen, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { type Category } from '@/app/actions/products';
import { type Insumo } from '@/app/actions/insumos';
import { CurrencyInput } from '@/components/ui/currency-input';

interface ProductFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingProduct: any;
    categories: Category[];
    insumosList: Insumo[];
    productInsumos?: { insumo_id: number; quantidade_necessaria: number }[];
    gruposComplemento?: any[];
    gruposSlots?: any[];
    productGrupos?: (number | string)[];
    productSlots?: string[];
    onSubmit: (formData: FormData, isCreatingCategory: boolean, selectedInsumos: { insumo_id: string, quantidade_necessaria: number }[], selectedGrupos: number[], selectedSlots: string[]) => Promise<void>;
}

export default function ProductFormModal({
    isOpen,
    onClose,
    editingProduct,
    categories,
    insumosList,
    productInsumos = [],
    gruposComplemento = [],
    gruposSlots = [],
    productGrupos = [],
    onSubmit
}: ProductFormModalProps) {
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    // Insumos State
    const [usaInsumos, setUsaInsumos] = useState(false);
    const [selectedInsumos, setSelectedInsumos] = useState<{ insumo_id: number, quantidade_necessaria: number }[]>([]);

    // Complementos State
    const [selectedGrupos, setSelectedGrupos] = useState<number[]>([]);
    const [selectedSlots, setSelectedSlots] = useState<string[]>([]);

    useEffect(() => {
        import('@/app/actions/auth').then(({ getMe }) => {
            getMe().then(setUser);
        });
    }, []);

    useEffect(() => {
        setIsCreatingCategory(false);
        setIsSubmitting(false);
        setImagePreview(editingProduct?.imagem || null);

        if (productInsumos && productInsumos.length > 0) {
            setUsaInsumos(true);
            setSelectedInsumos(productInsumos);
        } else {
            setUsaInsumos(false);
            setSelectedInsumos([]);
        }

        if (productGrupos) {
            setSelectedGrupos(productGrupos.filter(id => typeof id === 'number') as number[]);
            setSelectedSlots(productGrupos.filter(id => typeof id === 'string') as string[]);
        } else {
            setSelectedGrupos([]);
            setSelectedSlots([]);
        }
    }, [isOpen, editingProduct, productInsumos, productGrupos]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);
        try {
            await onSubmit(
                formData,
                isCreatingCategory,
                usaInsumos ? selectedInsumos.map(i => ({ ...i, insumo_id: String(i.insumo_id) })) : [],
                selectedGrupos,
                selectedSlots
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const addInsumo = (insumoId: number) => {
        if (!insumoId) return;
        if (selectedInsumos.find(i => i.insumo_id === insumoId)) return;
        setSelectedInsumos([...selectedInsumos, { insumo_id: insumoId, quantidade_necessaria: 0 }]);
    };

    const updateInsumoQty = (insumoId: number, qty: number) => {
        setSelectedInsumos(selectedInsumos.map(i =>
            i.insumo_id === insumoId ? { ...i, quantidade_necessaria: qty } : i
        ));
    };

    const removeInsumo = (insumoId: number) => {
        setSelectedInsumos(selectedInsumos.filter(i => i.insumo_id !== insumoId));
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
                        <div>
                            <h2 className="text-lg sm:text-xl font-bold text-slate-900">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h2>
                            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">Preencha as informações do item abaixo.</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                            <X className="size-5 text-slate-500" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto custom-scrollbar">
                        <div className="flex justify-center">
                            <label className="relative group cursor-pointer">
                                <input
                                    type="file"
                                    accept="image/*"
                                    name="imagem_file"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => setImagePreview(reader.result as string);
                                            reader.readAsDataURL(file);
                                        }
                                    }}
                                />
                                <div className="size-20 sm:size-24 rounded-xl sm:rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 group-hover:border-primary group-hover:text-primary transition-all overflow-hidden relative">
                                    {imagePreview ? (
                                        <Image
                                            src={imagePreview}
                                            fill
                                            className="object-cover"
                                            alt="Preview"
                                            referrerPolicy="no-referrer"
                                        />
                                    ) : (
                                        <>
                                            <ImageIcon className="size-6 sm:size-8 mb-1" />
                                            <span className="text-[8px] sm:text-[10px] font-bold uppercase">Foto</span>
                                        </>
                                    )}
                                </div>
                                <div className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 size-6 sm:size-8 bg-primary text-white rounded-lg flex items-center justify-center shadow-lg group-hover:bg-primary/90 transition-colors">
                                    <Plus className="size-3 sm:size-4" />
                                </div>
                            </label>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider">Nome do Produto</label>
                                <input
                                    name="nome"
                                    defaultValue={editingProduct?.nome}
                                    required
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    placeholder="Ex: Pizza Calabresa"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider">Descrição</label>
                                <textarea
                                    name="descricao"
                                    defaultValue={editingProduct?.descricao}
                                    rows={3}
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                                    placeholder="Descreva os ingredientes ou detalhes do produto..."
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider">Categoria</label>
                                    <select
                                        name="categoria_id"
                                        defaultValue={editingProduct?.categoria_id || (categories.length > 0 ? categories[0].id : '')}
                                        onChange={(e) => setIsCreatingCategory(e.target.value === 'new_category')}
                                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
                                    >
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.nome}</option>
                                        ))}
                                        <option value="new_category">+ Criar Nova</option>
                                    </select>
                                    {isCreatingCategory && (
                                        <div className="pt-2">
                                            <input
                                                name="novaCategoria"
                                                required={isCreatingCategory}
                                                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                                placeholder="Nome da Nova Categoria"
                                                autoFocus
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider">Preço (R$)</label>
                                    <CurrencyInput
                                        name="preco"
                                        required
                                        defaultValue={editingProduct?.preco}
                                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Slot Groups Section (NEW) */}
                        <div className="pt-4 border-t border-slate-100">
                            <div className="mb-4">
                                <div className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors flex items-center gap-2">
                                    Grupos de Slots
                                    <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[8px] font-black uppercase rounded">Novo</span>
                                </div>
                                <div className="text-[10px] sm:text-xs text-slate-500">O novo sistema de slots para produtos fracionados e combos.</div>
                            </div>

                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {gruposSlots?.map(grupo => (
                                        <label key={grupo.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-primary/50 transition-colors">
                                            <input
                                                type="checkbox"
                                                className="size-4 rounded border-slate-300 text-primary focus:ring-primary/20"
                                                checked={selectedSlots.includes(grupo.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedSlots([...selectedSlots, grupo.id]);
                                                    } else {
                                                        setSelectedSlots(selectedSlots.filter(id => id !== grupo.id));
                                                    }
                                                }}
                                            />
                                            <div>
                                                <div className="text-sm font-semibold text-slate-800">{grupo.nome}</div>
                                                <div className="text-[10px] text-slate-500">{grupo.tipo === 'fracionado' ? 'Fracionado' : 'Adicional'} • {grupo.qtd_slots} slots</div>
                                            </div>
                                        </label>
                                    ))}
                                    {(!gruposSlots || gruposSlots.length === 0) && (
                                        <div className="col-span-1 sm:col-span-2 text-center py-4 text-sm text-slate-500 italic">
                                            Nenhum grupo de slots cadastrado na aba de complementos.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Complement Groups Section */}
                        <div className="pt-4 border-t border-slate-100">
                            <div className="mb-4">
                                <div className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">Grupos de Complementos</div>
                                <div className="text-[10px] sm:text-xs text-slate-500">Selecione os grupos de complementos disponíveis para este produto (Ex: Sabores, Adicionais, Tamanho).</div>
                            </div>

                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {gruposComplemento?.map(grupo => (
                                        <label key={grupo.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-primary/50 transition-colors">
                                            <input
                                                type="checkbox"
                                                className="size-4 rounded border-slate-300 text-primary focus:ring-primary/20"
                                                checked={selectedGrupos.includes(grupo.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedGrupos([...selectedGrupos, grupo.id]);
                                                    } else {
                                                        setSelectedGrupos(selectedGrupos.filter(id => id !== grupo.id));
                                                    }
                                                }}
                                            />
                                            <div>
                                                <div className="text-sm font-semibold text-slate-800">{grupo.nome}</div>
                                                {grupo.descricao && <div className="text-[10px] text-slate-500">{grupo.descricao}</div>}
                                            </div>
                                        </label>
                                    ))}
                                    {(!gruposComplemento || gruposComplemento.length === 0) && (
                                        <div className="col-span-1 sm:col-span-2 text-center py-4 text-sm text-slate-500">
                                            Nenhum grupo de complemento cadastrado.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Insumos Section */}
                        {user?.controle_estoque && (
                            <div className="pt-4 border-t border-slate-100">
                                <label className="flex items-center gap-3 cursor-pointer group mb-4">
                                    <div className={`relative w-10 h-6 rounded-full transition-colors ${usaInsumos ? 'bg-primary' : 'bg-slate-200'}`}>
                                        <div className={`absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform ${usaInsumos ? 'translate-x-4' : 'translate-x-0'}`} />
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={usaInsumos}
                                            onChange={(e) => setUsaInsumos(e.target.checked)}
                                        />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">Usa Insumos / Ficha Técnica?</div>
                                        <div className="text-[10px] sm:text-xs text-slate-500">Faz a baixa automática de estoque a cada pedido finalizado.</div>
                                    </div>
                                </label>

                                <AnimatePresence>
                                    {usaInsumos && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-4">
                                                <div className="flex gap-2">
                                                    <select
                                                        id="insumoSelector"
                                                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 text-slate-700"
                                                        defaultValue=""
                                                    >
                                                        <option value="" disabled>Selecione um insumo...</option>
                                                        {insumosList.filter(i => !selectedInsumos.find(s => s.insumo_id === i.id)).map(insumo => (
                                                            <option key={insumo.id} value={insumo.id}>{insumo.nome} ({insumo.unidade_medida})</option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const el = document.getElementById('insumoSelector') as HTMLSelectElement;
                                                            if (el.value) {
                                                                addInsumo(Number(el.value));
                                                                el.value = ""; // reset
                                                            }
                                                        }}
                                                        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors shrink-0 flex items-center gap-1"
                                                    >
                                                        <Plus className="size-4" /> Add
                                                    </button>
                                                </div>

                                                {selectedInsumos.length > 0 && (
                                                    <div className="space-y-2 mt-4">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Ficha Técnica do Produto:</label>
                                                        {selectedInsumos.map((selInsumo, idx) => {
                                                            const refInsumo = insumosList.find(i => i.id === selInsumo.insumo_id);
                                                            if (!refInsumo) return null;

                                                            return (
                                                                <div key={selInsumo.insumo_id} className="flex gap-2 items-center bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                                                    <div className="flex-1 text-sm font-semibold text-slate-800 pl-2">
                                                                        {refInsumo.nome}
                                                                    </div>
                                                                    <input
                                                                        type="number"
                                                                        step="0.001"
                                                                        required
                                                                        value={selInsumo.quantidade_necessaria || ''}
                                                                        onChange={(e) => updateInsumoQty(selInsumo.insumo_id, parseFloat(e.target.value.replace(',', '.')) || 0)}
                                                                        className="w-24 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm text-center outline-none focus:ring-2 focus:ring-primary/20"
                                                                        placeholder="Qtd."
                                                                    />
                                                                    <div className="text-[11px] font-medium text-slate-400 w-10 uppercase">
                                                                        {refInsumo.unidade_medida}
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeInsumo(selInsumo.insumo_id)}
                                                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                                    >
                                                                        <Trash2 className="size-4" />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}

                                                        {/* Extra Idea: Calculate Total Cost / Profit Context */}
                                                        <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-end justify-between px-1">
                                                            <div>
                                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Custo de Produção (Estimado)</p>
                                                                <h3 className="text-lg font-black text-slate-800">
                                                                    {selectedInsumos.reduce((total, s) => {
                                                                        const i = insumosList.find(x => x.id === s.insumo_id);
                                                                        return total + ((i?.custo_por_unidade || 0) * (s.quantidade_necessaria || 0));
                                                                    }, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                </h3>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-md mb-1 inline-flex items-center gap-1">
                                                                    <PackageOpen className="size-3" /> Ficha Ativa
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

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
                                {isSubmitting ? 'Salvando...' : 'Salvar Produto'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
