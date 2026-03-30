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
    deleteItemComplemento
} from '@/app/actions/complements';
import { getInsumos, type Insumo } from '@/app/actions/insumos';
import { getProducts } from '@/app/actions/products';

export default function ComplementsManagement() {
    const [grupos, setGrupos] = useState<any[]>([]);
    const [insumosList, setInsumosList] = useState<Insumo[]>([]);
    const [produtos, setProdutos] = useState<any[]>([]);
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

    // Import Mass State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedProdutosToImport, setSelectedProdutosToImport] = useState<number[]>([]);
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [gruposData, insumosData, produtosData] = await Promise.all([
                getGruposComplementos(),
                getInsumos(),
                getProducts()
            ]);
            setGrupos(gruposData);
            setInsumosList(insumosData);
            setProdutos(produtosData);
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
        if (!confirm('Deseja excluir este item?')) return;
        try {
            await deleteItemComplemento(id);
            setItens(itens.filter(i => i.id !== id));
            toast.success('Item excluído!');
        } catch {
            toast.error('Erro ao excluir item.');
        }
    };

    // --- Import Mass Handlers ---
    const handleImportItems = async () => {
        if (!activeGrupo || selectedProdutosToImport.length === 0) return;
        try {
            setImporting(true);
            const toImport = produtos.filter(p => selectedProdutosToImport.includes(p.id));

            const newItems = await Promise.all(
                toImport.map(p => upsertItemComplemento({
                    grupo_id: activeGrupo.id,
                    nome: p.nome,
                    preco: p.preco || 0,
                    status: true
                }))
            );

            setItens([...newItems, ...itens]);
            setIsImportModalOpen(false);
            setSelectedProdutosToImport([]);
            toast.success(`${newItems.length} opções importadas com sucesso!`);
        } catch {
            toast.error('Erro ao importar algumas opções.');
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-120px)]">
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
                                            <div className="flex items-center">
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
            <AnimatePresence>
                {isGrupoModalOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsGrupoModalOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-xl z-50 overflow-hidden">
                            <form onSubmit={handleSaveGrupo}>
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                    <h3 className="text-xl font-bold text-slate-800">{editingGrupo ? 'Editar Grupo' : 'Novo Grupo'}</h3>
                                    <button type="button" onClick={() => setIsGrupoModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="size-5" /></button>
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
                                </div>
                                <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
                                    <button type="button" onClick={() => setIsGrupoModalOpen(false)} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
                                    <button type="submit" className="px-5 py-2.5 text-sm font-semibold bg-primary text-white hover:bg-primary/90 rounded-lg transition-colors shadow-sm">Salvar Grupo</button>
                                </div>
                            </form>
                        </motion.div>
                    </>
                )}

                {isItemModalOpen && activeGrupo && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsItemModalOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-xl z-50 overflow-hidden">
                            <form onSubmit={handleSaveItem}>
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                    <h3 className="text-xl font-bold text-slate-800">{editingItem ? 'Editar Opção' : 'Nova Opção'}</h3>
                                    <button type="button" onClick={() => setIsItemModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="size-5" /></button>
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
                                    <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                                        <input name="status" type="checkbox" defaultChecked={editingItem ? editingItem.status : true} className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary" />
                                        <span className="text-sm font-semibold text-slate-700">Ativo no Cardápio</span>
                                    </label>
                                </div>
                                <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
                                    <button type="button" onClick={() => setIsItemModalOpen(false)} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
                                    <button type="submit" className="px-5 py-2.5 text-sm font-semibold bg-primary text-white hover:bg-primary/90 rounded-lg transition-colors shadow-sm">Salvar Opção</button>
                                </div>
                            </form>
                        </motion.div>
                    </>
                )}

                {isImportModalOpen && activeGrupo && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsImportModalOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl bg-white rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[85vh]">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Importar Produtos do Cardápio</h3>
                                    <p className="text-sm text-slate-500 mt-1">Selecione os produtos que deseja clonar como opções para <b>{activeGrupo.nome}</b>.</p>
                                </div>
                                <button type="button" onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="size-5" /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
                                {produtos.length === 0 ? (
                                    <div className="text-center py-10">
                                        <p className="text-slate-500">Nenhum produto cadastrado no catálogo.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {produtos.map(p => {
                                            const alreadyImported = itens.some(i => i.nome === p.nome);
                                            return (
                                                <label key={p.id} className={cn(
                                                    "flex items-start gap-3 p-3 border rounded-lg transition-colors",
                                                    alreadyImported ? "opacity-50 cursor-not-allowed border-slate-200 bg-slate-50" : "cursor-pointer bg-white hover:border-primary/50",
                                                    selectedProdutosToImport.includes(p.id) ? "border-primary bg-primary/5" : ""
                                                )}>
                                                    <input
                                                        type="checkbox"
                                                        disabled={alreadyImported}
                                                        className="w-4 h-4 mt-0.5 text-primary rounded border-slate-300 focus:ring-primary focus:ring-offset-0 disabled:opacity-50"
                                                        checked={selectedProdutosToImport.includes(p.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedProdutosToImport([...selectedProdutosToImport, p.id]);
                                                            else setSelectedProdutosToImport(selectedProdutosToImport.filter(id => id !== p.id));
                                                        }}
                                                    />
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                                            {p.nome}
                                                            {alreadyImported && <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Já Adicionado</span>}
                                                        </p>
                                                        <p className="text-xs text-slate-500 font-medium">+ R$ {(Number(p.preco) || 0).toFixed(2).replace('.', ',')}</p>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-white shrink-0">
                                <p className="text-sm text-slate-500">
                                    <span className="font-bold text-slate-800">{selectedProdutosToImport.length}</span> selecionados
                                </p>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setIsImportModalOpen(false)} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                                    <button
                                        onClick={handleImportItems}
                                        disabled={selectedProdutosToImport.length === 0 || importing}
                                        className="px-5 py-2.5 text-sm font-semibold bg-primary text-white hover:bg-primary/90 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {importing ? 'Importando...' : 'Importar Opções'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
