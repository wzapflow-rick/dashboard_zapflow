'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Image as ImageIcon, Plus, Check, PackageOpen, Trash2, Ruler } from 'lucide-react';
import Image from 'next/image';
import { type Category } from '@/app/actions/products';
import { type Insumo } from '@/app/actions/insumos';
import { CurrencyInput } from '@/components/ui/currency-input';
import { toast } from 'sonner';
import { parseCurrency } from '@/lib/utils';

interface SizeOption {
    nome: string;
    preco: number;
}

interface ProductFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingProduct: any;
    categories: Category[];
    insumosList: Insumo[];
    productInsumos?: { insumo_id: number; quantidade_necessaria: number }[];
    onSubmit: (formData: FormData, isCreatingCategory: boolean, selectedInsumos: { insumo_id: string, quantidade_necessaria: number }[]) => Promise<void>;
}

export default function ProductFormModal({
    isOpen,
    onClose,
    editingProduct,
    categories,
    insumosList,
    productInsumos = [],
    onSubmit
}: ProductFormModalProps) {
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    // Sizes State
    const [hasSizes, setHasSizes] = useState(false);
    const [sizes, setSizes] = useState<SizeOption[]>([]);

    // Insumos State
    const [usaInsumos, setUsaInsumos] = useState(false);
    const [selectedInsumos, setSelectedInsumos] = useState<{ insumo_id: number, quantidade_necessaria: number }[]>([]);

    useEffect(() => {
        import('@/app/actions/auth').then(({ getMe }) => {
            getMe().then(setUser);
        });
    }, []);

    useEffect(() => {
        toast.dismiss();

        setIsCreatingCategory(false);
        setIsSubmitting(false);
        setImagePreview(editingProduct?.imagem || null);

        // Load sizes if they exist
        let rawTamanhos = editingProduct?.tamanhos || editingProduct?.tamanhos_json;
        
        // FALLBACK: Se não encontrou na coluna 'tamanhos', tenta extrair da descrição
        if (!rawTamanhos && editingProduct?.descricao?.includes('[[SIZES:')) {
            const match = editingProduct.descricao.match(/\[\[SIZES:(.*)\]\]/);
            if (match && match[1]) {
                rawTamanhos = match[1];
            }
        }

        if (rawTamanhos) {
            try {
                const parsedSizes = typeof rawTamanhos === 'string' 
                    ? JSON.parse(rawTamanhos) 
                    : rawTamanhos;
                    
                if (Array.isArray(parsedSizes) && parsedSizes.length > 0) {
                    setSizes(parsedSizes);
                    setHasSizes(true);
                } else {
                    setSizes([]);
                    setHasSizes(false);
                }
            } catch (e) {
                console.error('Error parsing sizes:', e);
                setSizes([]);
                setHasSizes(false);
            }
        } else {
            setSizes([]);
            setHasSizes(false);
        }

        if (productInsumos && productInsumos.length > 0) {
            setUsaInsumos(true);
            setSelectedInsumos(productInsumos);
        } else {
            setUsaInsumos(false);
            setSelectedInsumos([]);
        }

        return () => {
            toast.dismiss();
        };
    }, [isOpen, editingProduct, productInsumos]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);

        // Validar preço base se não houver tamanhos
        if (!hasSizes) {
            const precoValue = formData.get('preco');
            const precoNumerico = parseCurrency(precoValue as string);

            if (precoNumerico <= 0) {
                toast.error('Por favor, informe um preço válido maior que zero');
                setIsSubmitting(false);
                return;
            }
            formData.set('preco', String(precoNumerico));
            formData.set('tamanhos', '');

            // Se desativou tamanhos, limpa o marcador da descrição
            const currentDesc = formData.get('descricao') as string || '';
            const cleanDesc = currentDesc.split('[[SIZES:')[0].trim();
            formData.set('descricao', cleanDesc);
        } else {
            if (sizes.length === 0) {
                toast.error('Adicione pelo menos um tamanho ou desative a opção de tamanhos');
                setIsSubmitting(false);
                return;
            }
            // Garantir que todos os tamanhos tenham preço
            if (sizes.some(s => s.preco <= 0)) {
                toast.error('Todos os tamanhos devem ter um preço maior que zero');
                setIsSubmitting(false);
                return;
            }
            // Se tem tamanhos, o preço base no DB deve ser o menor preço entre os tamanhos para exibição correta no cardápio
            const menorPreco = Math.min(...sizes.map(s => s.preco));
            formData.set('preco', String(menorPreco));
            const sizesJson = JSON.stringify(sizes);
            formData.set('tamanhos', sizesJson);
            
            // FALLBACK: Como a coluna 'tamanhos' pode não existir no NocoDB, 
            // vamos anexar os tamanhos ao final da descrição de forma oculta para persistência garantida.
            const currentDesc = formData.get('descricao') as string || '';
            const cleanDesc = currentDesc.split('[[SIZES:')[0].trim();
            formData.set('descricao', `${cleanDesc}\n\n[[SIZES:${sizesJson}]]`);
        }

        try {
            await onSubmit(
                formData,
                isCreatingCategory,
                usaInsumos ? selectedInsumos.map(i => ({ ...i, insumo_id: String(i.insumo_id) })) : []
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const addSize = () => {
        setSizes([...sizes, { nome: '', preco: 0 }]);
    };

    const updateSize = (index: number, field: keyof SizeOption, value: string | number) => {
        const newSizes = [...sizes];
        newSizes[index] = { ...newSizes[index], [field]: value };
        setSizes(newSizes);
    };

    const removeSize = (index: number) => {
        setSizes(sizes.filter((_, i) => i !== index));
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
                    className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-700"
                >
                    <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-700/50 shrink-0">
                        <div>
                            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h2>
                            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">Preencha as informações do item abaixo.</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors">
                            <X className="size-5 text-slate-500 dark:text-slate-400" />
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
                                <div className="size-20 sm:size-24 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-700 border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 group-hover:border-primary group-hover:text-primary transition-all overflow-hidden relative">
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
                                <label className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Nome do Produto</label>
                                <input
                                    name="nome"
                                    defaultValue={editingProduct?.nome}
                                    required
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                    placeholder="Ex: Pizza Calabresa"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Descrição</label>
                                <textarea
                                    name="descricao"
                                    defaultValue={editingProduct?.descricao}
                                    rows={3}
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                    placeholder="Descreva os ingredientes ou detalhes do produto..."
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Categoria</label>
                                    <select
                                        name="categoria_id"
                                        defaultValue={editingProduct?.categoria_id || (categories.length > 0 ? categories[0].id : '')}
                                        onChange={(e) => setIsCreatingCategory(e.target.value === 'new_category')}
                                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
                                    >
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.nome}</option>
                                        ))}
                                        <option value="new_category">+ Criar Nova</option>
                                    </select>
                                    {isCreatingCategory && (
                                        <div className="pt-2">
                                            <input
                                                name="new_category_name"
                                                required={isCreatingCategory}
                                                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                                placeholder="Nome da Nova Categoria"
                                                autoFocus
                                            />
                                        </div>
                                    )}
                                </div>
                                {!hasSizes && (
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Preço (R$)</label>
                                        <CurrencyInput
                                            name="preco"
                                            required={!hasSizes}
                                            defaultValue={editingProduct?.preco}
                                            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sizes Section */}
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                            <label className="flex items-center gap-3 cursor-pointer group mb-4">
                                <div className={`relative w-10 h-6 rounded-full transition-colors ${hasSizes ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-600'}`}>
                                    <div className={`absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform ${hasSizes ? 'translate-x-4' : 'translate-x-0'}`} />
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={hasSizes}
                                        onChange={(e) => setHasSizes(e.target.checked)}
                                    />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors flex items-center gap-1.5">
                                        <Ruler className="size-4" /> Este produto tem tamanhos diferentes?
                                    </div>
                                    <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Ex: Broto, Média, Grande, 1 Litro, 500ml...</div>
                                </div>
                            </label>

                            <AnimatePresence>
                                {hasSizes && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 border border-slate-100 dark:border-slate-600 space-y-3">
                                            {sizes.map((size, index) => (
                                                <div key={index} className="flex gap-2 items-center">
                                                    <input
                                                        type="text"
                                                        value={size.nome}
                                                        onChange={(e) => updateSize(index, 'nome', e.target.value)}
                                                        placeholder="Ex: Grande"
                                                        className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                                                        required
                                                    />
                                                    <div className="w-32">
                                                        <CurrencyInput
                                                            defaultValue={size.preco}
                                                            onValueChange={(val) => updateSize(index, 'preco', val)}
                                                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                                                            required
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeSize(index)}
                                                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={addSize}
                                                className="w-full py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-500 dark:text-slate-400 hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-1.5"
                                            >
                                                <Plus className="size-3" /> Adicionar Tamanho
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Insumos Section */}
                        {user?.controle_estoque && (
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                                <label className="flex items-center gap-3 cursor-pointer group mb-4">
                                    <div className={`relative w-10 h-6 rounded-full transition-colors ${usaInsumos ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-600'}`}>
                                        <div className={`absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform ${usaInsumos ? 'translate-x-4' : 'translate-x-0'}`} />
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={usaInsumos}
                                            onChange={(e) => setUsaInsumos(e.target.checked)}
                                        />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">Usa Insumos / Ficha Técnica?</div>
                                        <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Faz a baixa automática de estoque a cada pedido finalizado.</div>
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
                                            <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 border border-slate-100 dark:border-slate-600 space-y-4">
                                                <div className="flex gap-2">
                                                    <select
                                                        id="insumoSelector"
                                                        className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 text-slate-700 dark:text-slate-300"
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
                                                            const select = document.getElementById('insumoSelector') as HTMLSelectElement;
                                                            if (select.value) addInsumo(Number(select.value));
                                                        }}
                                                        className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
                                                    >
                                                        Adicionar
                                                    </button>
                                                </div>

                                                <div className="space-y-2">
                                                    {selectedInsumos.map((item, idx) => {
                                                        const insumo = insumosList.find(i => i.id === item.insumo_id);
                                                        return (
                                                            <div key={idx} className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-600">
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{insumo?.nome}</div>
                                                                    <div className="text-[10px] text-slate-500">Unidade: {insumo?.unidade_medida}</div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="number"
                                                                        step="0.001"
                                                                        value={item.quantidade_necessaria}
                                                                        onChange={(e) => updateInsumoQty(item.insumo_id, Number(e.target.value))}
                                                                        className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-xs outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                                                                        placeholder="Qtd"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeInsumo(item.insumo_id)}
                                                                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                                                    >
                                                                        <Trash2 className="size-3.5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        <div className="flex gap-3 pt-4 shrink-0">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 px-4 py-3 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    <>
                                        <Check className="size-4" />
                                        Salvar Produto
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
