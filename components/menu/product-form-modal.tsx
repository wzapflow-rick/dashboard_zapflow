'use client';


import { MorphingInfinity } from '@/components/ui/morphing-infinity';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Image as ImageIcon, Plus, Check, PackageOpen, Trash2, Ruler, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { type Category } from '@/app/actions/products';
import { type Insumo } from '@/app/actions/insumos';
import { CurrencyInput } from '@/components/ui/currency-input';
import { MobileDrawer } from '@/components/ui/mobile-drawer';
import { toast } from 'sonner';
import { parseCurrency } from '@/lib/utils';
import useSWR from 'swr';
import { getGruposComplementos, getGruposDoProduto, upsertGrupoComplemento, upsertItemComplemento } from '@/app/actions/complements';
import { getCompanyDetails } from '@/app/actions/company';

interface SizeOption {
    nome: string;
    preco: number;
}

const EMPTY_PRODUCT_INSUMOS: { insumo_id: number; quantidade_necessaria: number }[] = [];

interface ProductFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingProduct: any;
    categories: Category[];
    insumosList: Insumo[];
    productInsumos?: { insumo_id: number; quantidade_necessaria: number }[];
    allProducts?: any[];
    onSubmit: (formData: FormData, isCreatingCategory: boolean, selectedInsumos: { insumo_id: string, quantidade_necessaria: number }[]) => Promise<void>;
}

export default function ProductFormModal({
    isOpen,
    onClose,
    editingProduct,
    categories,
    insumosList,
    productInsumos = EMPTY_PRODUCT_INSUMOS,
    allProducts = [],
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

    // Recommendations State
    const [selectedRecommendations, setSelectedRecommendations] = useState<number[]>([]);

    // Adicionais (grupos de complementos). null = o usuário ainda não mexeu.
    const { data: gruposList = [], mutate: refreshGrupos } = useSWR('grupos-complementos', () => getGruposComplementos());
    const editingId = editingProduct?.id ? Number(editingProduct.id) : null;
    const { data: gruposDoProduto } = useSWR(
        editingId ? ['grupos-do-produto', editingId] : null,
        () => getGruposDoProduto(editingId as number)
    );
    const [selectedGrupos, setSelectedGrupos] = useState<number[] | null>(null);
    const [storeNiche, setStoreNiche] = useState('');
    const [showQuickGroupForm, setShowQuickGroupForm] = useState(false);
    const [quickGroupName, setQuickGroupName] = useState('');
    const [quickGroupMax, setQuickGroupMax] = useState(10);
    const [quickOptions, setQuickOptions] = useState([{ nome: '', preco: '0' }]);
    const [savingQuickGroup, setSavingQuickGroup] = useState(false);
    const gruposMarcados = selectedGrupos ?? gruposDoProduto ?? [];
    const toggleGrupo = (id: number) => {
        setSelectedGrupos(
            gruposMarcados.includes(id) ? gruposMarcados.filter((g) => g !== id) : [...gruposMarcados, id]
        );
    };

    useEffect(() => {
        import('@/app/actions/auth').then(({ getMe }) => {
            getMe().then(setUser);
        });
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        getCompanyDetails().then((company) => {
            setStoreNiche(String(company?.nincho || ''));
        });
    }, [isOpen]);

    const nicheKey = storeNiche.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const isAcaiShop = nicheKey.includes('acai');
    const isPizzeria = nicheKey.includes('pizza');
    const isBurgerShop = nicheKey.includes('hamburg');
    const optionSectionTitle = isAcaiShop ? 'Acompanhamentos' : isPizzeria ? 'Bordas e adicionais' : isBurgerShop ? 'Adicionais do lanche' : 'Personalizações';
    const optionSectionHelp = isAcaiShop
        ? 'Escolha o que o cliente pode colocar no açaí, como frutas, cremes e complementos.'
        : isPizzeria
            ? 'Configure bordas e adicionais da pizza com os nomes que seus clientes já conhecem.'
            : isBurgerShop
                ? 'Cadastre os extras que o cliente pode adicionar ao lanche.'
                : 'Escolha os extras que o cliente poderá adicionar a este produto.';
    const quickGroupTemplates = isAcaiShop ? ['Acompanhamentos'] : isPizzeria ? ['Bordas', 'Adicionais'] : ['Adicionais'];
    const startQuickGroup = (name: string) => {
        setQuickGroupName(name);
        setQuickGroupMax(name.toLowerCase().includes('borda') ? 1 : 10);
        setQuickOptions([{ nome: '', preco: '0' }]);
        setShowQuickGroupForm(true);
    };
    const addQuickOption = () => setQuickOptions((options) => [...options, { nome: '', preco: '0' }]);
    const updateQuickOption = (index: number, field: 'nome' | 'preco', value: string) => {
        setQuickOptions((options) => options.map((option, i) => i === index ? { ...option, [field]: value } : option));
    };
    const removeQuickOption = (index: number) => setQuickOptions((options) => options.filter((_, i) => i !== index));

    const handleCreateQuickGroup = async () => {
        const options = quickOptions
            .map((option) => ({ nome: option.nome.trim(), preco: parseCurrency(option.preco) }))
            .filter((option) => option.nome);
        if (!quickGroupName.trim() || options.length === 0) {
            toast.error('Informe o nome do grupo e pelo menos uma opção.');
            return;
        }

        try {
            setSavingQuickGroup(true);
            const savedGroup = await upsertGrupoComplemento({
                nome: quickGroupName.trim(),
                obrigatorio: false,
                minimo: 0,
                maximo: Math.max(1, quickGroupMax),
                tipo_calculo: 'soma',
                cobrar_mais_caro: false,
                total_slots: Math.max(1, quickGroupMax),
                produto_composto: false,
                descricao: '',
                imagem: '',
            });
            const groupId = Number(savedGroup?.id);
            if (!Number.isInteger(groupId) || groupId <= 0) throw new Error('Não foi possível identificar o grupo criado.');

            for (const option of options) {
                await upsertItemComplemento({
                    grupo_id: groupId,
                    nome: option.nome,
                    preco: option.preco,
                    descricao: '',
                    status: true,
                    fator_proporcao: 1,
                });
            }

            setSelectedGrupos([...new Set([...gruposMarcados, groupId])]);
            await refreshGrupos();
            setShowQuickGroupForm(false);
            setQuickGroupName('');
            setQuickOptions([{ nome: '', preco: '0' }]);
            toast.success('Grupo criado e vinculado a este produto.');
        } catch (error) {
            console.error('Erro ao criar grupo rápido de adicionais:', error);
            await refreshGrupos();
            toast.error(error instanceof Error ? error.message : 'Não foi possível criar o grupo.');
        } finally {
            setSavingQuickGroup(false);
        }
    };



    useEffect(() => {
        toast.dismiss();

        // Se nao existem categorias, automaticamente mostrar campo para criar nova
        queueMicrotask(() => {
        setIsCreatingCategory(categories.length === 0);
        setSelectedGrupos(null);
        setShowQuickGroupForm(false);
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

        // Load recommendations
        if (editingProduct?.recomendacoes) {
            try {
                const recs = typeof editingProduct.recomendacoes === 'string'
                    ? JSON.parse(editingProduct.recomendacoes)
                    : editingProduct.recomendacoes;
                if (Array.isArray(recs)) {
                    setSelectedRecommendations(recs.map(Number));
                } else {
                    setSelectedRecommendations([]);
                }
            } catch (e) {
                console.error('Error parsing recommendations:', e);
                setSelectedRecommendations([]);
            }
        } else {
            setSelectedRecommendations([]);
        }
        });

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
            
            // FALLBACK: Como a coluna 'tamanhos' pode não existir em bancos antigos, 
            // vamos anexar os tamanhos ao final da descrição de forma oculta para persistência garantida.
            const currentDesc = formData.get('descricao') as string || '';
            const cleanDesc = currentDesc.split('[[SIZES:')[0].trim();
            const newDesc = cleanDesc ? `${cleanDesc}\n\n[[SIZES:${sizesJson}]]` : `[[SIZES:${sizesJson}]]`;
            formData.set('descricao', newDesc);
        }

        // Adicionar recomendações ao formData
        formData.set('recomendacoes', JSON.stringify(selectedRecommendations));

        if (selectedGrupos !== null) {
            formData.set('grupos_complementos', JSON.stringify(selectedGrupos));
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
        <MobileDrawer
            isOpen={isOpen}
            onClose={onClose}
            title={editingProduct ? 'Editar Produto' : 'Novo Produto'}
            size="lg"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
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
                                <div className="size-20 sm:size-24 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-zinc-800 border-2 border-dashed border-slate-300 dark:border-zinc-700 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 group-hover:border-primary group-hover:text-primary transition-all overflow-hidden relative">
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
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                    placeholder="Ex: Pizza Calabresa"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Descricao</label>
                                <textarea
                                    name="descricao"
                                    defaultValue={editingProduct?.descricao?.split('[[SIZES:')[0].trim() || ''}
                                    rows={3}
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
                                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
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
                                                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                                placeholder="Nome da Nova Categoria"
                                                autoFocus
                                            />
                                        </div>
                                    )}
                                </div>
                                {!hasSizes && (
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Preco (R$)</label>
                                        <CurrencyInput
                                            name="preco"
                                            required={!hasSizes}
                                            defaultValue={editingProduct?.preco}
                                            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Tag do Produto */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Tag (opcional)</label>
                                <select
                                    name="tag"
                                    defaultValue={editingProduct?.tag || ''}
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
                                >
                                    <option value="">Nenhuma tag</option>
                                    <option value="oferta">Oferta / Destaque (glow vermelho)</option>
                                    <option value="mais_pedido">Mais Pedido</option>
                                    <option value="recomendado">Recomendado</option>
                                </select>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500">A tag aparecera abaixo do nome do produto no cardapio. &quot;Oferta&quot; destaca com borda vermelha e aparece na faixa de destaques no topo.</p>
                            </div>
                        </div>

                        {/* Sizes Section */}
                        <div className="pt-4 border-t border-slate-100 dark:border-zinc-800/60">
                            <label className="flex items-center gap-3 cursor-pointer group mb-4">
                                <div className={`relative w-10 h-6 rounded-full transition-colors ${hasSizes ? 'bg-primary' : 'bg-slate-200 dark:bg-zinc-700'}`}>
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
                                        <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl p-3 sm:p-4 border border-slate-100 dark:border-zinc-700 space-y-3">
                                            {sizes.map((size, index) => (
                                                <div key={index} className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                                    <div className="flex gap-2 items-center flex-1">
                                                        <input
                                                            type="text"
                                                            value={size.nome}
                                                            onChange={(e) => updateSize(index, 'nome', e.target.value)}
                                                            placeholder="Ex: Grande"
                                                            className="flex-1 min-w-0 px-3 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                                                            required
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => removeSize(index)}
                                                            className="p-2 text-slate-400 hover:text-red-500 transition-colors sm:hidden"
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </button>
                                                    </div>
                                                    <div className="flex gap-2 items-center">
                                                        <div className="flex-1 sm:w-36">
                                                            <CurrencyInput
                                                                defaultValue={size.preco}
                                                                onValueChange={(val) => updateSize(index, 'preco', val)}
                                                                className="w-full px-3 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                                                                required
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeSize(index)}
                                                            className="p-2 text-slate-400 hover:text-red-500 transition-colors hidden sm:block"
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={addSize}
                                                className="w-full py-2 border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-lg text-xs font-bold text-slate-500 dark:text-slate-400 hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-1.5"
                                            >
                                                <Plus className="size-3" /> Adicionar Tamanho
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Recommendations (Upsell) Section */}
                        <div className="pt-4 border-t border-slate-100 dark:border-zinc-800/60">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="size-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                    <Sparkles className="size-4" />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-900 dark:text-white">Sugestão de Venda (Upsell)</div>
                                    <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Quais produtos sugerir quando o cliente escolher este?</div>
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl p-4 border border-slate-100 dark:border-zinc-700 space-y-4">
                                <div className="flex gap-2">
                                    <select
                                        id="recommendationSelector"
                                        className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 text-slate-700 dark:text-slate-300"
                                        defaultValue=""
                                    >
                                        <option value="" disabled>Sugerir produto...</option>
                                        {allProducts
                                            .filter(p => p.id !== editingProduct?.id && !selectedRecommendations.includes(p.id))
                                            .map(p => (
                                                <option key={p.id} value={p.id}>{p.nome}</option>
                                            ))
                                        }
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const select = document.getElementById('recommendationSelector') as HTMLSelectElement;
                                            if (select.value) {
                                                setSelectedRecommendations([...selectedRecommendations, Number(select.value)]);
                                                select.value = "";
                                            }
                                        }}
                                        className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600 transition-colors"
                                    >
                                        Adicionar
                                    </button>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {selectedRecommendations.map(id => {
                                        const product = allProducts.find(p => p.id === id);
                                        if (!product) return null;
                                        return (
                                            <div key={id} className="flex items-center gap-2 bg-white dark:bg-zinc-900 pl-3 pr-1.5 py-1.5 rounded-full border border-slate-200 dark:border-zinc-700 shadow-sm">
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{product.nome}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedRecommendations(selectedRecommendations.filter(rid => rid !== id))}
                                                    className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                                                >
                                                    <X className="size-3" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {selectedRecommendations.length === 0 && (
                                        <div className="text-center w-full py-2 text-[10px] text-slate-400 italic">
                                            Nenhuma sugestão configurada para este produto.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Opções por ramo: atalhos simples, mantendo compatibilidade com grupos já existentes. */}
                        <fieldset className="pt-4 border-t border-slate-100 dark:border-zinc-800/60">
                            <legend className="sr-only">{optionSectionTitle}</legend>
                            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="text-sm font-bold text-slate-900 dark:text-white">{optionSectionTitle}</div>
                                    <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">{optionSectionHelp}</div>
                                </div>
                                <button type="button" onClick={() => startQuickGroup(quickGroupTemplates[0])} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-2 text-xs font-bold text-primary transition hover:bg-primary/5">
                                    <Plus className="size-3.5" /> Criar {isAcaiShop ? 'acompanhamentos' : 'opções'}
                                </button>
                            </div>

                            {gruposList.length > 0 && (
                                <div className="mb-3 flex flex-wrap gap-2">
                                    {gruposList.map((g: any) => {
                                        const id = Number(g.id);
                                        const ativo = gruposMarcados.includes(id);
                                        return (
                                            <button key={id} type="button" aria-pressed={ativo} onClick={() => toggleGrupo(id)}
                                                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                                                    ativo ? 'bg-primary/10 border-primary text-primary' : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-300 hover:border-primary/50'
                                                }`}>
                                                {ativo ? <Check className="size-3.5" aria-hidden="true" /> : <Plus className="size-3.5" aria-hidden="true" />}
                                                {g.nome}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {gruposList.length === 0 && !showQuickGroupForm && (
                                <p className="mb-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-400">
                                    Ainda não há opções cadastradas. Crie o primeiro grupo aqui, sem sair do produto.
                                </p>
                            )}

                            {showQuickGroupForm && (
                                <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/[.03] p-3 sm:p-4">
                                    <div className="flex flex-wrap gap-2">
                                        {quickGroupTemplates.map((template) => (
                                            <button key={template} type="button" onClick={() => startQuickGroup(template)}
                                                className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                                                    quickGroupName === template ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 dark:border-zinc-700 dark:text-slate-300'
                                                }`}>{template}</button>
                                        ))}
                                    </div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        Nome do grupo
                                        <input value={quickGroupName} onChange={(event) => setQuickGroupName(event.target.value)} maxLength={60}
                                            placeholder={isAcaiShop ? 'Ex.: Acompanhamentos' : isPizzeria ? 'Ex.: Bordas ou Adicionais' : 'Ex.: Adicionais'}
                                            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" />
                                    </label>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Opções para o cliente escolher</span>
                                            <span className="text-[10px] text-slate-500">Preço adicional · use 0 para incluir sem custo</span>
                                        </div>
                                        {quickOptions.map((option, index) => (
                                            <div key={index} className="grid grid-cols-[1fr_110px_32px] gap-2">
                                                <input value={option.nome} onChange={(event) => updateQuickOption(index, 'nome', event.target.value)} maxLength={80}
                                                    placeholder={isAcaiShop ? 'Ex.: Morango, leite em pó' : 'Ex.: Catupiry, bacon'}
                                                    className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" />
                                                <input inputMode="decimal" value={option.preco} onChange={(event) => updateQuickOption(index, 'preco', event.target.value.replace(/[^\d,.]/g, ''))}
                                                    aria-label={`Preço adicional da opção ${index + 1}`} placeholder="0,00"
                                                    className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" />
                                                <button type="button" onClick={() => removeQuickOption(index)} disabled={quickOptions.length === 1}
                                                    aria-label="Remover opção" className="flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 dark:border-zinc-700"><Trash2 className="size-4" /></button>
                                            </div>
                                        ))}
                                        <button type="button" onClick={addQuickOption} className="inline-flex items-center gap-1 text-xs font-bold text-primary"><Plus className="size-3.5" /> Adicionar outra opção</button>
                                    </div>
                                    <label className="block max-w-[220px] text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        Quantidade máxima por pedido
                                        <select value={quickGroupMax} onChange={(event) => setQuickGroupMax(Number(event.target.value))}
                                            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">
                                            {[1, 2, 3, 5, 10, 20].map((value) => <option key={value} value={value}>{value}</option>)}
                                        </select>
                                    </label>
                                    <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-zinc-700">
                                        <button type="button" onClick={() => setShowQuickGroupForm(false)} disabled={savingQuickGroup} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500">Cancelar</button>
                                        <button type="button" onClick={handleCreateQuickGroup} disabled={savingQuickGroup || !quickGroupName.trim() || !quickOptions.some((option) => option.nome.trim())}
                                            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{savingQuickGroup ? 'Salvando…' : 'Criar e vincular'}</button>
                                    </div>
                                </div>
                            )}
                        </fieldset>

                        {/* Insumos Section */}
                        {user?.controle_estoque && (
                            <div className="pt-4 border-t border-slate-100 dark:border-zinc-800/60">
                                <label className="flex items-center gap-3 cursor-pointer group mb-4">
                                    <div className={`relative w-10 h-6 rounded-full transition-colors ${usaInsumos ? 'bg-primary' : 'bg-slate-200 dark:bg-zinc-700'}`}>
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
                                            <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl p-4 border border-slate-100 dark:border-zinc-700 space-y-4">
                                                <div className="flex gap-2">
                                                    <select
                                                        id="insumoSelector"
                                                        className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 text-slate-700 dark:text-slate-300"
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
                                                            <div key={idx} className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-2 rounded-lg border border-slate-100 dark:border-zinc-700">
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
                                                                        className="w-20 px-2 py-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-xs outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
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
                                className="flex-1 px-4 py-3 border border-slate-200 dark:border-zinc-800/60 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
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
                                        <MorphingInfinity className="size-4" aria-hidden="true" />
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
        </MobileDrawer>
    );
}
