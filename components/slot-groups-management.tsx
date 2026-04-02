'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    Plus, Edit3, Trash2, ChefHat, Layers, List, Settings, Loader2, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

import { getGruposSlots, deleteGrupoSlot, type GrupoSlot, getCompositeProductsStock } from '@/app/actions/grupos-slots';
import { getItensBase, deleteItemBase, type ItemBase } from '@/app/actions/itens-base';

import { GrupoSlotModal } from './grupo-slot-modal';
import { GrupoSlotItens } from './grupo-slot-itens';
import { BibliotecaItemModal } from './biblioteca-item-modal';

const REGRA_LABELS: Record<string, string> = {
    mais_caro: 'Mais caro',
    media: 'Média',
    soma: 'Soma',
};

export default function SlotGroupsManagement() {
    const [activeTab, setActiveTab] = useState<'grupos' | 'biblioteca'>('grupos');
    const driverRef = useRef<any>(null);

    // --- Grupos ---
    const [grupos, setGrupos] = useState<GrupoSlot[]>([]);
    const [loadingGrupos, setLoadingGrupos] = useState(true);
    const [isGrupoModalOpen, setIsGrupoModalOpen] = useState(false);
    const [editingGrupo, setEditingGrupo] = useState<Partial<GrupoSlot> | null>(null);
    const [activeGrupoItens, setActiveGrupoItens] = useState<GrupoSlot | null>(null);
    const [estoqueMap, setEstoqueMap] = useState<Map<number, number>>(new Map());

    // --- Biblioteca ---
    const [itensBase, setItensBase] = useState<ItemBase[]>([]);
    const [loadingBib, setLoadingBib] = useState(false);
    const [isBibModalOpen, setIsBibModalOpen] = useState(false);
    const [editingItemBase, setEditingItemBase] = useState<Partial<ItemBase> | null>(null);

    useEffect(() => {
        fetchGrupos();
        fetchBiblioteca();
    }, []);

    // Driver.js tour for grupos e opcionais
    useEffect(() => {
        const tourSteps = activeTab === 'grupos' ? [
            {
                element: '#slot-header',
                popover: {
                    title: '🍕 Grupos de Slots (Complementos)',
                    description: 'Crie grupos de opcionais para produtos como pizzas, burgers, etc. Ex: adicionais de pizza.',
                    side: 'bottom' as const,
                    align: 'start' as const
                }
            },
            {
                element: '#btn-novo-grupo',
                popover: {
                    title: '➕ Criar Grupo',
                    description: 'Crie um novo grupo de opcionais. Defina nome, tipo de seleção (múltipla, única), preço, estoque, etc.',
                    side: 'bottom' as const,
                    align: 'center' as const
                }
            },
            {
                element: '#grupos-list',
                popover: {
                    title: '📋 Lista de Grupos',
                    description: 'Aqui estão todos os seus grupos. Clique em "Itens" para configurar os opcionais de cada grupo.',
                    side: 'top' as const,
                    align: 'start' as const
                }
            },
            {
                element: '#grupo-items',
                popover: {
                    title: '🎯 Configurar Itens',
                    description: 'Adicione os itens/opções que o cliente pode escolher. Cada item pode ter preço adicional e controle de estoque.',
                    side: 'top' as const,
                    align: 'center' as const
                }
            },
            {
                element: '#estoque-info',
                popover: {
                    title: '📦 Controle de Estoque',
                    description: 'O sistema calcula automaticamente quantos produtos podem ser feitos com base nos ingredientes.',
                    side: 'left' as const,
                    align: 'start' as const
                }
            },
            {
                element: '#biblioteca-tab',
                popover: {
                    title: '📚 Biblioteca de Itens',
                    description: 'Crie Itens Base reutilizáveis. Útil quando o mesmo item (ex: bacon) é usado em vários grupos diferentes.',
                    side: 'bottom' as const,
                    align: 'center' as const
                }
            },
            {
                popover: {
                    title: '💡 Dicas Finais',
                    description: '• Use "Regra de Preço" para definir como o preço é calculado\n• Configure "Quantidade Mínima/Máxima" para limitar escolhas\n• O sistema integra automaticamente com os produtos',
                    side: 'top' as const,
                    align: 'center' as const
                }
            }
        ] : [
            {
                element: '#biblioteca-header',
                popover: {
                    title: '📚 Biblioteca de Itens Base',
                    description: 'Crie itens reutilizáveis que podem ser usados em qualquer grupo. Ex: Queijo mussarela, Bacon, Cebola, etc.',
                    side: 'bottom' as const,
                    align: 'start' as const
                }
            },
            {
                element: '#btn-novo-item',
                popover: {
                    title: '➕ Novo Item Base',
                    description: 'Crie um item base com nome e custo. Depois você pode usar este mesmo item em diferentes grupos.',
                    side: 'bottom' as const,
                    align: 'center' as const
                }
            },
            {
                element: '#biblioteca-list',
                popover: {
                    title: '📋 Itens Cadastrados',
                    description: 'Lista de todos os itens base. Você pode editar ou excluir. Um item pode ser usado em quantos grupos quiser.',
                    side: 'top' as const,
                    align: 'start' as const
                }
            }
        ];

        driverRef.current = driver({
            showProgress: true,
            animate: true,
            allowClose: true,
            overlayOpacity: 0.7,
            smoothScroll: true,
            steps: tourSteps as any
        });
    }, [activeTab]);

    const startTour = () => {
        if (driverRef.current) {
            driverRef.current.destroy();
            setTimeout(() => {
                driverRef.current.drive();
            }, 100);
        }
    };

    const fetchGrupos = async () => {
        setLoadingGrupos(true);
        try {
            const [data, estoqueData] = await Promise.all([
                getGruposSlots(),
                getCompositeProductsStock(),
            ]);
            setGrupos(data);
            const map = new Map<number, number>();
            estoqueData.forEach(item => map.set(item.grupoId, item.estoquePossivel));
            setEstoqueMap(map);
        } catch {
            toast.error('Erro ao carregar grupos.');
        } finally {
            setLoadingGrupos(false);
        }
    };

    const fetchBiblioteca = async () => {
        setLoadingBib(true);
        try {
            const data = await getItensBase();
            setItensBase(data);
        } catch {
            toast.error('Erro ao carregar biblioteca.');
        } finally {
            setLoadingBib(false);
        }
    };

    // --- Handlers Grupos ---
    const handleNewGrupo = () => {
        setEditingGrupo(null);
        setIsGrupoModalOpen(true);
    };

    const handleEditGrupo = (grupo: GrupoSlot) => {
        setEditingGrupo(grupo);
        setIsGrupoModalOpen(true);
    };

    const handleGrupoSaved = (saved: GrupoSlot) => {
        setGrupos(prev => {
            const idx = prev.findIndex(g => g.id === saved.id);
            if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = saved;
                return updated;
            }
            return [saved, ...prev];
        });
        setIsGrupoModalOpen(false);
        setEditingGrupo(null);
    };

    const handleDeleteGrupo = async (grupo: GrupoSlot) => {
        if (!confirm(`Deletar o grupo "${grupo.nome}"? Os itens vinculados serão desvinculados.`)) return;
        try {
            await deleteGrupoSlot(grupo.id);
            setGrupos(prev => prev.filter(g => g.id !== grupo.id));
            toast.success('Grupo deletado.');
        } catch (e: any) {
            toast.error(e.message || 'Erro ao deletar grupo.');
        }
    };

    // --- Handlers Biblioteca ---
    const handleNewItemBase = () => {
        setEditingItemBase(null);
        setIsBibModalOpen(true);
    };

    const handleEditItemBase = (item: ItemBase) => {
        setEditingItemBase(item);
        setIsBibModalOpen(true);
    };

    const handleItemBaseSaved = (saved: ItemBase) => {
        setItensBase(prev => {
            const idx = prev.findIndex(i => i.id === saved.id);
            if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = saved;
                return updated;
            }
            return [saved, ...prev];
        });
        setIsBibModalOpen(false);
        setEditingItemBase(null);
    };

    const handleDeleteItemBase = async (item: ItemBase) => {
        if (!confirm(`Deletar o sabor "${item.nome}"? Ele será removido da biblioteca.`)) return;
        try {
            await deleteItemBase(item.id);
            setItensBase(prev => prev.filter(i => i.id !== item.id));
            toast.success('Sabor removido da biblioteca.');
        } catch (e: any) {
            toast.error(e.message || 'Erro ao deletar sabor.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <header id="slot-header" className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                        <Layers className="w-7 h-7 text-primary" />
                        Sistema de Opcionais
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Gerencie sabores, frações e grupos de opcionais para seus produtos.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={startTour}
                        className="bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2"
                    >
                        <Sparkles className="w-4 h-4" />
                        Tour
                    </button>
                    <button
                        id={activeTab === 'grupos' ? 'btn-novo-grupo' : 'btn-novo-item'}
                        onClick={activeTab === 'grupos' ? handleNewGrupo : handleNewItemBase}
                        className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-primary/20 flex items-center gap-2 transition-all active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        {activeTab === 'grupos' ? 'Novo Grupo' : 'Novo Sabor'}
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 border border-slate-200 rounded-xl p-1 w-fit">
                {([
                    { key: 'grupos', label: 'Grupos de Opcionais', icon: List },
                    { key: 'biblioteca', label: 'Biblioteca de Sabores', icon: ChefHat },
                ] as const).map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                            activeTab === key
                                ? 'bg-primary text-white shadow'
                                : 'text-slate-500 hover:text-slate-700'
                        )}
                    >
                        <Icon className="w-4 h-4" />
                        {label}
                    </button>
                ))}
            </div>

            {/* Tab: Grupos */}
            <AnimatePresence mode="wait">
                {activeTab === 'grupos' && (
                    <motion.div
                        key="grupos"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-3"
                    >
                        {loadingGrupos ? (
                            <div className="flex items-center justify-center py-20 text-slate-500">
                                <Loader2 className="w-6 h-6 animate-spin mr-3 text-primary" />
                                Carregando grupos...
                            </div>
                        ) : grupos.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-500 border-2 border-dashed border-slate-200 rounded-xl">
                                <Layers className="w-16 h-16 mb-4 text-slate-300" />
                                <p className="text-lg font-medium text-slate-600">Nenhum grupo criado ainda</p>
                                <p className="text-sm mt-1 text-slate-400">Crie seu primeiro grupo de opcionais</p>
                                <button
                                    onClick={handleNewGrupo}
                                    className="mt-4 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-lg shadow-primary/20 flex items-center gap-2 transition-all active:scale-95"
                                >
                                    <Plus className="w-4 h-4" />
                                    Criar Grupo
                                </button>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {grupos.map(grupo => (
                                    <motion.div
                                        key={grupo.id}
                                        layout
                                        className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all"
                                    >
                                        {/* Icon */}
                                        <div className={cn(
                                            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg',
                                            grupo.tipo === 'fracionado'
                                                ? 'bg-orange-100 text-orange-600'
                                                : 'bg-blue-100 text-blue-600'
                                        )}>
                                            {grupo.tipo === 'fracionado' ? '🍕' : '➕'}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-semibold text-slate-900">{grupo.nome}</p>
                                                <span className={cn(
                                                    'text-xs px-2 py-0.5 rounded-full font-medium',
                                                    grupo.tipo === 'fracionado'
                                                        ? 'bg-orange-100 text-orange-700'
                                                        : 'bg-blue-100 text-blue-700'
                                                )}>
                                                    {grupo.tipo === 'fracionado' ? `${grupo.qtd_slots} slots` : 'Adicional'}
                                                </span>
                                                <span className="text-xs text-slate-500">
                                                    Preço: {REGRA_LABELS[grupo.regra_preco] || grupo.regra_preco}
                                                </span>
                                                <span className="text-xs text-slate-500">
                                                    Min {grupo.min_slots} / Max {grupo.max_slots}
                                                </span>
                                                {estoqueMap.has(grupo.id) && (
                                                    <span className={cn(
                                                        'text-xs px-2 py-0.5 rounded-full font-medium',
                                                        estoqueMap.get(grupo.id)! === 0 
                                                            ? 'bg-red-100 text-red-700' 
                                                            : 'bg-emerald-100 text-emerald-700'
                                                    )}>
                                                        Estoque: {estoqueMap.get(grupo.id)} unid.
                                                    </span>
                                                )}
                                            </div>
                                            {grupo.descricao && (
                                                <p className="text-xs text-slate-500 mt-0.5 truncate">{grupo.descricao}</p>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <button
                                                onClick={() => setActiveGrupoItens(grupo)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-medium transition-all"
                                            >
                                                <Settings className="w-3.5 h-3.5" />
                                                Gerenciar Itens
                                            </button>
                                            <button
                                                onClick={() => handleEditGrupo(grupo)}
                                                className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                                title="Editar grupo"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteGrupo(grupo)}
                                                className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                                                title="Deletar grupo"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Tab: Biblioteca */}
                {activeTab === 'biblioteca' && (
                    <motion.div
                        key="biblioteca"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-3"
                    >
                        {loadingBib ? (
                            <div className="flex items-center justify-center py-20 text-slate-500">
                                <Loader2 className="w-6 h-6 animate-spin mr-3 text-primary" />
                                Carregando biblioteca...
                            </div>
                        ) : itensBase.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-500 border-2 border-dashed border-slate-200 rounded-xl">
                                <ChefHat className="w-16 h-16 mb-4 text-slate-300" />
                                <p className="text-lg font-medium text-slate-600">Biblioteca vazia</p>
                                <p className="text-sm mt-1 text-slate-400">Cadastre seus sabores aqui para reutilizá-los em múltiplos grupos</p>
                                <button
                                    onClick={handleNewItemBase}
                                    className="mt-4 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-lg shadow-primary/20 flex items-center gap-2 transition-all active:scale-95"
                                >
                                    <Plus className="w-4 h-4" />
                                    Criar Sabor
                                </button>
                            </div>
                        ) : (
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {itensBase.map(item => (
                                    <motion.div
                                        key={item.id}
                                        layout
                                        className="flex flex-col p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all"
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-slate-900 truncate">{item.nome}</p>
                                            </div>
                                            <div className="flex gap-1 flex-shrink-0">
                                                <button
                                                    onClick={() => handleEditItemBase(item)}
                                                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteItemBase(item)}
                                                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
                                            <div>
                                                <p className="text-xs text-slate-500">Preço sugerido</p>
                                                <p className="text-sm font-semibold text-primary">
                                                    R$ {Number(item.preco_sugerido).toFixed(2)}
                                                </p>
                                            </div>
                                            {item.preco_custo != null && (
                                                <div className="text-right">
                                                    <p className="text-xs text-slate-500">Custo</p>
                                                    <p className="text-xs text-slate-600">R$ {Number(item.preco_custo).toFixed(2)}</p>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modals */}
            <GrupoSlotModal
                isOpen={isGrupoModalOpen}
                editingGrupo={editingGrupo}
                onClose={() => { setIsGrupoModalOpen(false); setEditingGrupo(null); }}
                onSaved={handleGrupoSaved}
            />

            <BibliotecaItemModal
                isOpen={isBibModalOpen}
                editingItem={editingItemBase}
                onClose={() => { setIsBibModalOpen(false); setEditingItemBase(null); }}
                onSaved={handleItemBaseSaved}
            />

            {activeGrupoItens && (
                <GrupoSlotItens
                    grupo={activeGrupoItens}
                    onClose={() => setActiveGrupoItens(null)}
                />
            )}
        </div>
    );
}
