'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Minus, ChefHat, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { getItensBase, type ItemBase } from '@/app/actions/itens-base';
import {
    getItensDoGrupoSlot,
    addItemBaseAoGrupo,
    removeItemBaseDoGrupo,
    type GrupoSlot,
} from '@/app/actions/grupos-slots';

interface GrupoSlotItensProps {
    grupo: GrupoSlot;
    onClose: () => void;
}

export function GrupoSlotItens({ grupo, onClose }: GrupoSlotItensProps) {
    const [biblioteca, setBiblioteca] = useState<ItemBase[]>([]);
    const [vinculados, setVinculados] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [busca, setBusca] = useState('');
    const [actionMap, setActionMap] = useState<Record<number, boolean>>({});

    useEffect(() => {
        load();
    }, [grupo.id]);

    const load = async () => {
        setLoading(true);
        try {
            const [bib, vin] = await Promise.all([
                getItensBase(),
                getItensDoGrupoSlot(Number(grupo.id)),
            ]);
            setBiblioteca(bib);
            setVinculados(vin);
        } catch {
            toast.error('Erro ao carregar itens');
        } finally {
            setLoading(false);
        }
    };

    const vinculadosIds = useMemo(
        () => new Set(vinculados),
        [vinculados]
    );

    const bibliotecaFiltrada = useMemo(
        () =>
            biblioteca.filter(item =>
                item.nome.toLowerCase().includes(busca.toLowerCase())
            ),
        [biblioteca, busca]
    );

    const handleAdd = async (itemBaseId: number) => {
        setActionMap(m => ({ ...m, [itemBaseId]: true }));
        try {
            await addItemBaseAoGrupo(Number(grupo.id), itemBaseId);
            const updatedVin = await getItensDoGrupoSlot(Number(grupo.id));
            setVinculados(updatedVin);
            toast.success('Item adicionado ao grupo!');
        } catch (e: any) {
            toast.error(e.message || 'Erro ao adicionar item');
        } finally {
            setActionMap(m => ({ ...m, [itemBaseId]: false }));
        }
    };

    const handleRemove = async (itemBaseId: number) => {
        setActionMap(m => ({ ...m, [itemBaseId]: true }));
        try {
            await removeItemBaseDoGrupo(Number(grupo.id), itemBaseId);
            setVinculados(prev => prev.filter(id => id !== itemBaseId));
            toast.success('Item removido do grupo!');
        } catch (e: any) {
            toast.error(e.message || 'Erro ao remover item');
        } finally {
            setActionMap(m => ({ ...m, [itemBaseId]: false }));
        }
    };

    const regraLabel: Record<string, string> = {
        mais_caro: 'Mais caro',
        media: 'Média',
        soma: 'Soma',
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                />
                <motion.div
                    className="relative bg-white dark:bg-slate-800 rounded-2xl w-full max-w-3xl shadow-xl flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-700"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-200">{grupo.nome}</h2>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                <span className={cn(
                                    'px-2 py-0.5 rounded-full font-medium',
                                    grupo.tipo === 'fracionado'
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-blue-100 text-blue-700'
                                )}>
                                    {grupo.tipo === 'fracionado' ? `🍕 ${grupo.qtd_slots} slots` : '➕ Adicional'}
                                </span>
                                <span>Preço: {regraLabel[grupo.regra_preco]}</span>
                                <span>Min {grupo.min_slots} / Max {grupo.max_slots}</span>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body: duas colunas */}
                    <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                        {/* Coluna Esquerda: Biblioteca */}
                        <div className="flex flex-col flex-1 p-4 border-b md:border-b-0 md:border-r border-slate-200 overflow-hidden">
                            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2 dark:text-zinc-200">
                                <ChefHat className="w-4 h-4 text-primary" />
                                Biblioteca de Sabores
                            </h3>
                            <div className="relative mb-3">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={busca}
                                    onChange={e => setBusca(e.target.value)}
                                    placeholder="Buscar sabor..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors dark:bg-slate-800 dark:text-zinc-200 dark:border-slate-700 dark:placeholder-slate-400"
                                />
                            </div>
                            {loading ? (
                                <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                                    <Loader2 className="w-5 h-5 animate-spin mr-2 text-primary" />
                                    Carregando...
                                </div>
                            ) : (
                                <div className="overflow-y-auto flex-1 space-y-1.5 pr-1">
                                    {bibliotecaFiltrada.length === 0 ? (
                                        <p className="text-center text-slate-500 text-sm py-8">Nenhum sabor encontrado na biblioteca.</p>
                                    ) : (
                                        bibliotecaFiltrada.map(item => {
                                            const isVinculado = vinculadosIds.has(item.id);
                                            const isLoading = actionMap[item.id];
                                            return (
                                                <div
                                                    key={item.id}
                                                    className={cn(
                                                        'flex items-center justify-between p-3 rounded-xl border transition-all',
                                                        isVinculado
                                                            ? 'border-orange-200 bg-orange-50 opacity-60 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-slate-600'
                                                            : 'border-slate-200 bg-slate-50 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-slate-600 dark:text-zinc-200 dark:hover:border-slate-60'
                                                    )}
                                                >
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-slate-900 truncate dark:text-zinc-200">{item.nome}</p>
                                                        <p className="text-xs text-slate-500 dark:text-zinc-200">R$ {Number(item.preco_sugerido).toFixed(2)}</p>
                                                    </div>
                                                    <button
                                                        disabled={isVinculado || isLoading}
                                                        onClick={() => handleAdd(item.id)}
                                                        className={cn(
                                                            'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                                                            isVinculado
                                                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                                : 'bg-primary hover:bg-primary/90 text-white'
                                                        )}
                                                    >
                                                        {isLoading ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Plus className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Coluna Direita: Itens no Grupo */}
                        <div className="flex flex-col flex-1 p-4 overflow-hidden">
                            <h3 className="text-sm font-semibold text-slate-700 mb-3 dark:text-zinc-200">
                                Itens neste Grupo
                                <span className="ml-2 text-xs font-normal text-slate-500 dark:text-zinc-200">({vinculados.length})</span>
                            </h3>
                            <div className="overflow-y-auto flex-1 space-y-1.5 pr-1">
                                {vinculados.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center py-10 text-slate-500 text-sm text-center dark:text-zinc-200">
                                        <ChefHat className="w-10 h-10 mb-3 text-slate-300" />
                                        <p>Nenhum item neste grupo ainda.</p>
                                        <p className="text-xs mt-1 text-slate-400 dark:text-zinc-200">Adicione sabores da biblioteca ao lado.</p>
                                    </div>
                                ) : (
                                    vinculados.map(itemId => {
                                        const item = biblioteca.find(b => b.id === itemId);
                                        const isLoading = actionMap[itemId];
                                        return (
                                            <div
                                                key={itemId}
                                                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-slate-600 dark:text-zinc-200"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-slate-900 truncate dark:text-zinc-200">
                                                        {item?.nome || `Item #${itemId}`}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-zinc-200">
                                                        R$ {Number(item?.preco_sugerido ?? 0).toFixed(2)}
                                                    </p>
                                                </div>
                                                <button
                                                    disabled={isLoading}
                                                    onClick={() => handleRemove(itemId)}
                                                    className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-600 flex items-center justify-center transition-all"
                                                >
                                                    {isLoading ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Minus className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-200 flex-shrink-0">
                        <button
                            onClick={onClose}
                            className="w-full py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors text-sm font-medium dark:bg-slate-800 dark:border-slate-700 dark:text-zinc-200 dark:hover:border-slate-600 dark:hover:text-zinc-200"
                        >
                            Fechar
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
