'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { getCategories, upsertCategory, deleteCategory, type Category } from '@/app/actions/products';
import { toast } from 'sonner';

export default function CategoryManagement() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getCategories();
            setCategories(data);
        } catch (error) {
            console.error('Erro ao buscar categorias:', error);
            toast.error('Erro ao carregar categorias.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleDelete = async (id: number) => {
        if (confirm('Tem certeza que deseja excluir esta categoria? Os produtos vinculados perderão a referência.')) {
            try {
                await deleteCategory(id);
                setCategories(categories.filter(c => c.id !== id));
                toast.success('Categoria excluída com sucesso!');
            } catch (error) {
                console.error('Erro ao excluir:', error);
                toast.error('Erro ao excluir a categoria.');
            }
        }
    };

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data: Partial<Category> = {
            id: editingCategory?.id,
            nome: formData.get('nome') as string,
            ordem: Number(formData.get('ordem') || 0)
        };

        try {
            const saved = await upsertCategory(data);
            if (editingCategory) {
                setCategories(categories.map(c => c.id === editingCategory.id ? saved as Category : c));
                toast.success('Categoria atualizada!');
            } else {
                setCategories([...categories, saved as Category]);
                toast.success('Categoria criada!');
            }
            setIsModalOpen(false);
            setEditingCategory(null);
        } catch (error) {
            toast.error('Erro ao salvar categoria.');
        }
    };

    return (
        <div className="space-y-8">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Categorias</h1>
                    <p className="text-slate-500 text-sm mt-1 font-medium">Gerencie as categorias do seu cardápio</p>
                </div>
                <button
                    onClick={() => { setEditingCategory(null); setIsModalOpen(true); }}
                    className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-primary/20 flex items-center gap-2 transition-all active:scale-95"
                >
                    <Plus className="size-4" />
                    Nova Categoria
                </button>
            </header>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative min-h-[300px]">
                {loading && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                        <Loader2 className="size-8 text-primary animate-spin" />
                    </div>
                )}
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 w-16">ID</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Nome</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 w-24">Ordem</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right w-32">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {categories.map((cat) => (
                            <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4 text-sm text-slate-500">{cat.id}</td>
                                <td className="px-6 py-4 font-semibold text-slate-900">{cat.nome}</td>
                                <td className="px-6 py-4 text-sm font-medium text-slate-600">{cat.ordem || 0}</td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => { setEditingCategory(cat); setIsModalOpen(true); }}
                                            className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                        >
                                            <Edit3 className="size-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(cat.id)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {!loading && categories.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">Nenhuma categoria encontrada.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsModalOpen(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                        >
                            <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h2 className="text-lg font-bold text-slate-900">{editingCategory ? 'Editar' : 'Nova'} Categoria</h2>
                                <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                    <X className="size-5 text-slate-500" />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider">Nome</label>
                                    <input
                                        name="nome"
                                        defaultValue={editingCategory?.nome}
                                        required
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                        placeholder="Ex: Pizzas Salgadas"
                                        autoFocus
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider">Ordem de Exibição</label>
                                    <input
                                        name="ordem"
                                        type="number"
                                        defaultValue={editingCategory?.ordem || 0}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    />
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        className="w-full px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 text-sm"
                                    >
                                        <Check className="size-4" />
                                        Salvar
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
