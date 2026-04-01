'use client';

import React, { useState, useEffect } from 'react';
import {
    Plus, Edit3, Trash2, Check, X, Tag, List, Layers, Import
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import {
    getGruposComplementos,
    upsertGrupoComplemento,
    deleteGrupoComplemento,
    getItensDoGrupo,
    upsertItemComplemento,
    deleteItemComplemento,
    getReceitaDoComplemento,
    saveReceitaDoComplemento,
    getInsumosDoGrupo,
    saveInsumosDoGrupo,
    bulkCreateComplements
} from '@/app/actions/complements';
import { getInsumos, type Insumo } from '@/app/actions/insumos';
import { getProducts, getCategories } from '@/app/actions/products';
import { Search } from 'lucide-react';
import { GrupoModal } from './grupo-modal';
import { ItemModal } from './item-modal';
import { ImportModal } from './import-modal';
import { RecipeModal } from './recipe-modal';

export default function ComplementsManagement() {
    const [grupos, setGrupos] = useState<any[]>([]);
    const [insumosList, setInsumosList] = useState<Insumo[]>([]);
    const [activeTab, setActiveTab] = useState<'grupos' | 'biblioteca'>('grupos');
    const [produtos, setProdutos] = useState<any[]>([]);
    const [categorias, setCategorias] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Group Form state
    const [isGrupoModalOpen, setIsGrupoModalOpen] = useState(false);
    const [editingGrupo, setEditingGrupo] = useState<any>(null);

    // Items Management state
    const [activeGrupo, setActiveGrupo] = useState<any>(null);
    const [itens, setItens] = useState<any[]>([]);
    const [loadingItens, setLoadingItens] = useState(false);

    // Item Form state
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);

    // Recipe Management state
    const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
    const [editingItemForRecipe, setEditingItemForRecipe] = useState<any>(null);
    const [recipeForGrupo, setRecipeForGrupo] = useState<any>(null); // Se definido, estamos editando a receita do grupo
    const [recipe, setRecipe] = useState<any[]>([]);
    const [savingRecipe, setSavingRecipe] = useState(false);

    // Import modal state
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedProdutosToImport, setSelectedProdutosToImport] = useState<number[]>([]);
    const [importing, setImporting] = useState(false);
    const [importSearch, setImportSearch] = useState('');
    const [importFator, setImportFator] = useState<number>(1);
    const [activeCatTab, setActiveCatTab] = useState<number | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [gruposData, insumosData, produtosData, categoriasData] = await Promise.all([
                getGruposComplementos(),
                getInsumos(),
                getProducts(),
                getCategories()
            ]);
            setGrupos(gruposData);
            setInsumosList(insumosData);
            setProdutos(produtosData);
            setCategorias(categoriasData);
        } catch (e) {
            toast.error('Erro ao buscar grupos de complementos.');
        } finally {
            setLoading(false);
        }
    };

    const carregarItens = async (grupoId: number) => {
        try {
            setLoadingItens(true);
            const data = await getItensDoGrupo(grupoId);
            setItens(data);
        } catch {
            toast.error('Erro ao buscar itens do grupo.');
        } finally {
            setLoadingItens(false);
        }
    };

    // --- Handlers para GRUPOS ---
    const handleSaveGrupo = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const payload = {
            id: editingGrupo?.id,
            nome: formData.get('nome'),
            obrigatorio: formData.get('obrigatorio') === 'on',
            minimo: Number(formData.get('minimo')),
            maximo: Number(formData.get('maximo')),
            tipo_calculo: formData.get('tipo_calculo'),
            cobrar_mais_caro: formData.get('cobrar_mais_caro') === 'on',
            total_slots: Number(formData.get('total_slots') || formData.get('maximo') || 1),
            // Produto Composto: exibe o grupo como produto no cardápio
            produto_composto: formData.get('produto_composto') === 'on',
            descricao: formData.get('descricao') || '',
            imagem: formData.get('imagem') || '',
        };

        try {
            const saved = await upsertGrupoComplemento(payload);
            if (editingGrupo) {
                setGrupos(grupos.map(g => g.id === saved.id ? saved : g));
                toast.success('Grupo atualizado com sucesso!');
            } else {
                setGrupos([saved, ...grupos]);
                toast.success('Grupo criado com sucesso!');
            }
            setIsGrupoModalOpen(false);
        } catch {
            toast.error('Erro ao salvar grupo.');
        }
    };

    const handleDeleteGrupo = async (id: number) => {
        if (!confirm('Deseja excluir este grupo? Pode afetar produtos vinculados.')) return;
        try {
            await deleteGrupoComplemento(id);
            setGrupos(grupos.filter(g => g.id !== id));
            if (activeGrupo?.id === id) {
                setActiveGrupo(null);
                setItens([]);
            }
            toast.success('Grupo excluído!');
        } catch {
            toast.error('Erro ao excluir grupo.');
        }
    };

    // --- Handlers para ITENS ---
    const handleSaveItem = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const payload = {
            id: editingItem?.id,
            grupo_id: activeGrupo?.id,
            nome: formData.get('nome'),
            preco: Number(formData.get('preco')),
            descricao: formData.get('descricao'),
            status: formData.get('status') === 'on',
            // Fator de proporção: define quanto deste item é usado (0.5 = metade, 0.33 = 1/3)
            fator_proporcao: Number(formData.get('fator_proporcao') || 1),
        };

        try {
            const saved = await upsertItemComplemento(payload);
            if (editingItem) {
                setItens(itens.map(i => i.id === saved.id ? saved : i));
                toast.success('Item atualizado com sucesso!');
            } else {
                setItens([saved, ...itens]);
                toast.success('Item criado com sucesso!');
            }
            setIsItemModalOpen(false);
        } catch {
            toast.error('Erro ao salvar item.');
        }
    };

    const handleDeleteItem = async (id: number) => {
        if (!confirm('Tem certeza que deseja excluir esta opção?')) return;
        try {
            await deleteItemComplemento(id);
            setItens(itens.filter(i => i.id !== id));
            toast.success('Opção removida com sucesso!');
        } catch {
            toast.error('Erro ao deletar opção');
        }
    };

    // Recipe (Ficha Técnica) Functions
    const fetchRecipe = async (itemId: number) => {
        try {
            setRecipeForGrupo(null);
            const data = await getReceitaDoComplemento(itemId);
            setRecipe(data);
            setIsRecipeModalOpen(true);
        } catch (e) {
            console.error('fetchRecipe error:', e);
            toast.error('Erro ao carregar ficha técnica');
        }
    };

    const fetchGrupoRecipe = async (grupoId: number) => {
        try {
            setEditingItemForRecipe(null);
            setRecipeForGrupo(grupos.find(g => g.id === grupoId));
            const data = await getInsumosDoGrupo(grupoId);
            setRecipe(data);
            setIsRecipeModalOpen(true);
        } catch (e) {
            console.error('fetchGrupoRecipe error:', e);
            toast.error('Erro ao carregar insumos do grupo');
        }
    };

    const handleSaveRecipe = async () => {
        try {
            setSavingRecipe(true);
            if (editingItemForRecipe) {
                await saveReceitaDoComplemento(editingItemForRecipe.id, recipe);
            } else if (recipeForGrupo) {
                await saveInsumosDoGrupo(recipeForGrupo.id, recipe);
            }
            toast.success('Ficha técnica salva com sucesso!');
            setIsRecipeModalOpen(false);
        } catch (e) {
            console.error('handleSaveRecipe error:', e);
            toast.error('Erro ao salvar ficha técnica');
        } finally {
            setSavingRecipe(false);
        }
    };

    // --- Import Mass Handlers ---
    const handleImportItems = async () => {
        if (!activeGrupo || selectedProdutosToImport.length === 0) return;
        try {
            setImporting(true);
            const toImport = produtos.filter(p => selectedProdutosToImport.includes(p.id));

            await bulkCreateComplements(activeGrupo.id, toImport, importFator);

            // Refresh items list
            const updatedItems = await getItensDoGrupo(activeGrupo.id);
            setItens(updatedItems);
            setIsImportModalOpen(false);
            setSelectedProdutosToImport([]);
            setImportSearch('');
            setActiveCatTab(null);
            toast.success(`${toImport.length} opções importadas com a ficha técnica!`);
        } catch {
            toast.error('Erro ao importar algumas opções.');
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 h-[calc(100vh-120px)]">
            {/* Tabs Superiores */}
            <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('grupos')}
                    className={cn(
                        "px-4 py-2 text-sm font-bold rounded-lg transition-all",
                        activeTab === 'grupos' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    Gestão de Grupos
                </button>
                <button
                    onClick={() => setActiveTab('biblioteca')}
                    className={cn(
                        "px-4 py-2 text-sm font-bold rounded-lg transition-all",
                        activeTab === 'biblioteca' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    Biblioteca de Sabores Base
                </button>
            </div>

            {activeTab === 'grupos' ? (
                <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
                    {/* Coluna Esquerda: Lista de Grupos */}
                    <div className="w-full md:w-1/3 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <Layers className="size-5 text-primary" />
                                Grupos
                            </h2>
                            <button
                                onClick={() => { setEditingGrupo(null); setIsGrupoModalOpen(true); }}
                                className="p-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-colors"
                            >
                                <Plus className="size-4" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {loading ? (
                                <p className="text-center text-slate-500 text-sm mt-4">Carregando grupos...</p>
                            ) : grupos.length === 0 ? (
                                <p className="text-center text-slate-500 text-sm mt-4">Nenhum grupo cadastrado.</p>
                            ) : (
                                grupos.map((grupo) => (
                                    <div
                                        key={grupo.id}
                                        onClick={() => {
                                            setActiveGrupo(grupo);
                                            carregarItens(grupo.id);
                                        }}
                                        className={cn(
                                            "p-3 rounded-lg border cursor-pointer transition-all flex justify-between items-center group",
                                            activeGrupo?.id === grupo.id
                                                ? "border-primary bg-primary/5 shadow-sm"
                                                : "border-slate-200 hover:border-primary/30 hover:bg-slate-50"
                                        )}
                                    >
                                        <div>
                                            <h3 className="font-semibold text-sm text-slate-800">{grupo.nome || 'Sem Nome'}</h3>
                                            <p className="text-xs text-slate-500 uppercase tracking-tight mt-0.5">
                                                Mín {grupo.minimo ?? 0} • Máx {grupo.maximo ?? 0} • {grupo.tipo_calculo === 'soma' ? 'Soma' : grupo.tipo_calculo === 'media' ? 'Média' : 'Maior Valor'}
                                            </p>
                                        </div>
                                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    fetchGrupoRecipe(grupo.id);
                                                }}
                                                className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors"
                                                title="Ficha Técnica do Grupo (Massa, Caixa, etc)"
                                            >
                                                <Layers className="size-4" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setEditingGrupo(grupo); setIsGrupoModalOpen(true); }}
                                                className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                                            >
                                                <Edit3 className="size-4" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteGrupo(grupo.id); }}
                                                className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="size-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Coluna Direita: Itens do Grupo */}
                    <div className="w-full md:w-2/3 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                        {!activeGrupo ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 space-y-3">
                                <List className="size-12 opacity-20" />
                                <p>Selecione um grupo para visualizar suas opções.</p>
                            </div>
                        ) : (
                            <>
                                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 flex-wrap gap-4">
                                    <div>
                                        <h2 className="font-bold text-slate-800 text-lg">{activeGrupo.nome || 'Sem Nome'}</h2>
                                        <p className="text-xs text-slate-500">Adicione as opções que o cliente poderá escolher.</p>
                                    </div>
                                    <div className="flex justify-end gap-2 flex-wrap">
                                        <button
                                            onClick={() => setIsImportModalOpen(true)}
                                            className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm flex items-center gap-2 transition-all hover:bg-slate-50 whitespace-nowrap"
                                        >
                                            <Import className="size-4" />
                                            Importar Produtos
                                        </button>
                                        <button
                                            onClick={() => { setEditingItem(null); setIsItemModalOpen(true); }}
                                            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-md flex items-center gap-2 transition-all hover:bg-primary/90 whitespace-nowrap"
                                        >
                                            <Plus className="size-4" />
                                            Nova Opção
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                    {loadingItens ? (
                                        <p className="text-center text-slate-500 text-sm mt-4">Carregando opções...</p>
                                    ) : itens.length === 0 ? (
                                        <div className="text-center py-10 space-y-2">
                                            <Tag className="size-8 text-slate-300 mx-auto" />
                                            <p className="text-slate-500 text-sm">Este grupo ainda não possui opções (ex: Sabores).</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                            {itens.map((item) => (
                                                <div key={item.id} className="border border-slate-200 rounded-lg p-3 flex justify-between items-start hover:border-slate-300 transition-colors">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="font-semibold text-slate-800 text-sm">{item.nome || 'Opção sem nome'}</h3>
                                                            {!(item.status ?? true) && <span className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">Inativo</span>}
                                                        </div>
                                                        <p className="text-slate-600 font-medium text-sm mt-1">
                                                            + R$ {Number(item.preco ?? 0).toFixed(2).replace('.', ',')}
                                                        </p>
                                                        {item.descricao && (
                                                            <p className="text-slate-500 text-xs mt-1 line-clamp-1" title={item.descricao}>{item.descricao}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => {
                                                                setEditingItemForRecipe(item);
                                                                fetchRecipe(item.id);
                                                            }}
                                                            title="Ficha Técnica (Estoque)"
                                                            className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors"
                                                        >
                                                            <Layers className="size-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => { setEditingItem(item); setIsItemModalOpen(true); }}
                                                            className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                                                        >
                                                            <Edit3 className="size-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteItem(item.id)}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Modals */}
                    {/* Modals */}
                    <GrupoModal
                        isOpen={isGrupoModalOpen}
                        onClose={() => setIsGrupoModalOpen(false)}
                        editingGrupo={editingGrupo}
                        onSubmit={handleSaveGrupo}
                    />

                    <ItemModal
                        isOpen={isItemModalOpen}
                        activeGrupo={activeGrupo}
                        onClose={() => setIsItemModalOpen(false)}
                        editingItem={editingItem}
                        onSubmit={handleSaveItem}
                    />

                    <ImportModal
                        isOpen={isImportModalOpen}
                        activeGrupo={activeGrupo}
                        onClose={() => { setIsImportModalOpen(false); setSelectedProdutosToImport([]); setImportSearch(''); }}
                        produtos={produtos}
                        categorias={categorias}
                        itensDoGrupo={itens}
                        selectedProdutosToImport={selectedProdutosToImport}
                        setSelectedProdutosToImport={setSelectedProdutosToImport}
                        importSearch={importSearch}
                        setImportSearch={setImportSearch}
                        importFator={importFator}
                        setImportFator={setImportFator}
                        activeCatTab={activeCatTab}
                        setActiveCatTab={setActiveCatTab}
                        importing={importing}
                        onImport={handleImportItems}
                    />

                    <RecipeModal
                        isOpen={isRecipeModalOpen}
                        editingItemForRecipe={editingItemForRecipe}
                        recipeForGrupo={recipeForGrupo}
                        onClose={() => setIsRecipeModalOpen(false)}
                        recipe={recipe}
                        setRecipe={setRecipe}
                        insumosList={insumosList}
                        savingRecipe={savingRecipe}
                        onSaveRecipe={handleSaveRecipe}
                    />
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col">
                    <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                        <div>
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <Search className="size-5 text-primary" />
                                Biblioteca de Sabores (Catálogo)
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">Estes são os produtos cadastrados no seu menu principal.</p>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                            <input
                                placeholder="Buscar sabor no catálogo..."
                                value={importSearch}
                                onChange={(e) => setImportSearch(e.target.value)}
                                className="w-80 pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/30">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {produtos
                                .filter(p => !importSearch || p.nome.toLowerCase().includes(importSearch.toLowerCase()))
                                .map(produto => (
                                    <div key={produto.id} className="p-4 bg-white border border-slate-200 rounded-2xl hover:border-primary/40 hover:shadow-md transition-all flex flex-col justify-between group">
                                        <div className="mb-4">
                                            <div className="flex justify-between items-start gap-2 mb-2">
                                                <h4 className="font-bold text-sm text-slate-800 leading-snug">{produto.nome}</h4>
                                                <span className="text-[10px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                    R$ {Number(produto.preco_venda || 0).toFixed(2)}
                                                </span>
                                            </div>
                                            <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-lg font-bold uppercase tracking-wider">
                                                {produto.categoria}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            className="w-full flex items-center justify-center text-slate-600 border border-slate-200 bg-white text-xs font-bold gap-2 hover:border-primary hover:bg-primary hover:text-white transition-all h-9 rounded-xl border-dashed"
                                            onClick={async () => {
                                                if (!activeGrupo) {
                                                    toast.error('Selecione um grupo (ex: Meia Meia) na aba "Gestão" primeiro!');
                                                    setActiveTab('grupos');
                                                    return;
                                                }
                                                setImporting(true);
                                                try {
                                                    await bulkCreateComplements(activeGrupo.id, [produto], 1);
                                                    const updated = await getItensDoGrupo(activeGrupo.id);
                                                    setItens(updated);
                                                    toast.success(`"${produto.nome}" adicionado como opção ao grupo ${activeGrupo.nome}`);
                                                } catch (e) {
                                                    toast.error('Erro ao adicionar sabor.');
                                                } finally {
                                                    setImporting(false);
                                                }
                                            }}
                                        >
                                            <Plus className="size-3" /> Adicionar ao Grupo {activeGrupo?.nome ? `(${activeGrupo.nome})` : ''}
                                        </button>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                </div>
            )}


        </div>
    );
}
