'use client';

import React, { useState, useEffect } from 'react';
import { Plus, PackageOpen, AlertTriangle, Loader2, Edit3, Trash2, Layers, Package, TrendingDown, DollarSign, Truck } from 'lucide-react';
import { cn, parseCurrency } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Insumo, getInsumos, upsertInsumo, deleteInsumo, setNovoEstoqueInsumo } from '@/app/actions/insumos';
import InsumoFormModal from './insumo-form-modal';
import QuickRestockModal from './quick-restock-modal';
import { toast } from 'sonner';

export default function InsumosManagement() {
    const [insumos, setInsumos] = useState<Insumo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
    const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
    const [restockingInsumo, setRestockingInsumo] = useState<Insumo | null>(null);

    useEffect(() => {
        fetchInsumos();
    }, []);

    const fetchInsumos = async () => {
        try {
            const data = await getInsumos();
            setInsumos(data);
        } catch (error) {
            toast.error('Erro ao carregar insumos');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = (insumo: Insumo) => {
        setEditingInsumo(insumo);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Tem certeza que deseja excluir este insumo? Isso afetará os produtos que o usam.')) return;
        try {
            await deleteInsumo(id);
            toast.success('Insumo excluído');
            setInsumos(prev => prev.filter(i => i.id !== id));
        } catch (error) {
            toast.error('Erro ao excluir');
        }
    };

    const handleQuickRestock = async (id: number, quantity: number) => {
        try {
            await setNovoEstoqueInsumo(id, quantity);
            toast.success('Estoque atualizado com sucesso!');
            setInsumos(prev => prev.map(i => i.id === id ? { ...i, quantidade_atual: quantity } : i));
        } catch (error) {
            toast.error('Erro ao atualizar estoque');
        }
    };

    const handleSubmit = async (formData: FormData) => {
        try {
            const data = {
                id: editingInsumo?.id,
                nome: formData.get('nome') as string,
                quantidade_atual: parseCurrency(formData.get('quantidade_atual') as string),
                unidade_medida: formData.get('unidade_medida') as string,
                estoque_minimo: parseCurrency(formData.get('estoque_minimo') as string),
                custo_por_unidade: parseCurrency(formData.get('custo_por_unidade') as string),
            };

            const saved = await upsertInsumo(data);

            setInsumos(prev => {
                if (editingInsumo) {
                    return prev.map(i => i.id === saved.id ? saved : i);
                }
                return [saved, ...prev];
            });

            toast.success(editingInsumo ? 'Insumo atualizado' : 'Insumo criado');
            setIsModalOpen(false);
            setEditingInsumo(null);
        } catch (error) {
            toast.error('Erro ao salvar Insumo');
        }
    };

    const stats = [
        {
            label: 'Total de Insumos',
            value: insumos.length.toString(),
            icon: Layers,
            color: 'blue'
        },
        {
            label: 'Estoque Baixo',
            value: insumos.filter(i => i.quantidade_atual <= i.estoque_minimo).length.toString(),
            icon: TrendingDown,
            color: 'orange'
        },
        {
            label: 'Valor em Estoque',
            value: insumos.reduce((acc, i) => acc + (Number(i.quantidade_atual) * Number(i.custo_por_unidade)), 0)
                .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            icon: DollarSign,
            color: 'emerald'
        }
    ];

    return (
        <div className="space-y-8">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        Gestão de Insumos
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium tracking-tight">
                        Controle seu estoque, defina o custo e gerencie os ingredientes dos produtos.
                    </p>
                </div>
                <button
                    onClick={() => {
                        setEditingInsumo(null);
                        setIsModalOpen(true);
                    }}
                    className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-primary/20 flex items-center gap-2 transition-all active:scale-95"
                >
                    <Plus className="size-4" />
                    Novo Insumo
                </button>
            </header>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4"
                    >
                        <div className={cn(
                            "p-3 rounded-xl shrink-0",
                            stat.color === 'blue' ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" :
                                stat.color === 'orange' ? "bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" :
                                    "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                        )}>
                            <stat.icon className="size-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{stat.label}</p>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{stat.value}</h3>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden relative min-h-[300px]">
                {isLoading && (
                    <div className="absolute inset-0 bg-white/50 dark:bg-slate-800/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                        <Loader2 className="size-8 text-primary animate-spin" />
                    </div>
                )}
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Insumo</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Estoque Atual</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Estoque Mínimo</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Custo Un.</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {insumos.length === 0 && !isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 font-medium">
                                        Nenhum insumo cadastrado ainda. Comece adicionando os ingredientes dos seus produtos.
                                    </td>
                                </tr>
                            ) : (
                                insumos.map((insumo, idx) => {
                                    const isLowStock = insumo.quantidade_atual <= insumo.estoque_minimo;

                                    return (
                                        <tr
                                            key={insumo.id}
                                            className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors group"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 transition-transform group-hover:scale-110">
                                                        <PackageOpen className="size-5" />
                                                    </div>
                                                    <div className="font-semibold text-slate-900 dark:text-white">{insumo.nome}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className={cn(
                                                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold",
                                                    isLowStock ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                                )}>
                                                    {isLowStock && <AlertTriangle className="size-3" />}
                                                    {Number(insumo.quantidade_atual).toFixed(2)} <span className="opacity-70 text-[10px]">{insumo.unidade_medida}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                                    {Number(insumo.estoque_minimo).toFixed(2)} <span className="text-[10px]">{insumo.unidade_medida}</span>
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-sm font-bold text-slate-900 dark:text-white">
                                                    {(Number(insumo.custo_por_unidade) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setRestockingInsumo(insumo);
                                                            setIsRestockModalOpen(true);
                                                        }}
                                                        className="p-2 text-slate-400 dark:text-slate-500 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-all"
                                                        title="Reposição Rápida"
                                                    >
                                                        <Truck className="size-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleEdit(insumo)}
                                                        className="p-2 text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20 rounded-lg transition-all"
                                                        title="Editar"
                                                    >
                                                        <Edit3 className="size-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(insumo.id)}
                                                        className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <InsumoFormModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingInsumo(null);
                }}
                editingInsumo={editingInsumo}
                onSubmit={handleSubmit}
            />

            <QuickRestockModal
                isOpen={isRestockModalOpen}
                onClose={() => {
                    setIsRestockModalOpen(false);
                    setRestockingInsumo(null);
                }}
                onConfirm={handleQuickRestock}
                insumo={restockingInsumo}
            />
        </div>
    );
}
