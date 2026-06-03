'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Check, X, Loader2, ImageIcon, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { getCategories, upsertCategory, deleteCategory, uploadImageAction, applyImageToCategory, type Category } from '@/app/actions/products';
import { toast } from 'sonner';

export default function CategoryManagement() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    // Modal "aplicar foto a categoria"
    const [imageCategory, setImageCategory] = useState<Category | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [somenteVazios, setSomenteVazios] = useState(false);
    const [applyingImage, setApplyingImage] = useState(false);

    const openImageModal = (cat: Category) => {
        setImageCategory(cat);
        setSelectedFile(null);
        setPreviewUrl(null);
        setSomenteVazios(false);
    };

    const closeImageModal = () => {
        setImageCategory(null);
        setSelectedFile(null);
        setPreviewUrl(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    };

    const handleApplyImage = async () => {
        if (!imageCategory || !selectedFile) {
            toast.error('Selecione uma imagem primeiro.');
            return;
        }
        setApplyingImage(true);
        try {
            const formData = new FormData();
            formData.append('image', selectedFile);
            const url = await uploadImageAction(formData);
            if (!url) throw new Error('Falha no upload da imagem.');

            const result = await applyImageToCategory(imageCategory.id, url, { somenteVazios });
            toast.success(`Imagem aplicada a ${result.updated} produto(s) de "${imageCategory.nome}".`);
            closeImageModal();
        } catch (error: any) {
            console.error('Erro ao aplicar imagem:', error);
            toast.error(error?.message || 'Erro ao aplicar imagem à categoria.');
        } finally {
            setApplyingImage(false);
        }
    };

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
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Categorias</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">Gerencie as categorias do seu cardápio</p>
                </div>
                <button
                    onClick={() => { setEditingCategory(null); setIsModalOpen(true); }}
                    className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-primary/20 flex items-center gap-2 transition-all active:scale-95"
                >
                    <Plus className="size-4" />
                    Nova Categoria
                </button>
            </header>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden relative min-h-[300px]">
                {loading && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                        <Loader2 className="size-8 text-primary animate-spin" />
                    </div>
                )}
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-16">ID</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Nome</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-24">Ordem</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right w-32">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {categories.map((cat) => (
                            <tr key={cat.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                                <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{cat.id}</td>
                                <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{cat.nome}</td>
                                <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">{cat.ordem || 0}</td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => openImageModal(cat)}
                                            title="Aplicar uma foto a todos os produtos desta categoria"
                                            className="p-2 text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20 rounded-lg transition-all"
                                        >
                                            <ImageIcon className="size-4" />
                                        </button>
                                        <button
                                            onClick={() => { setEditingCategory(cat); setIsModalOpen(true); }}
                                            className="p-2 text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20 rounded-lg transition-all"
                                        >
                                            <Edit3 className="size-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(cat.id)}
                                            className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {!loading && categories.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">Nenhuma categoria encontrada.</td>
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
                            className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700"
                        >
                            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-700/50">
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{editingCategory ? 'Editar' : 'Nova'} Categoria</h2>
                                <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors">
                                    <X className="size-5 text-slate-500 dark:text-slate-400" />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Nome</label>
                                    <input
                                        name="nome"
                                        defaultValue={editingCategory?.nome}
                                        required
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
                                        placeholder="Ex: Pizzas Salgadas"
                                        autoFocus
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Ordem de Exibição</label>
                                    <input
                                        name="ordem"
                                        type="number"
                                        defaultValue={editingCategory?.ordem || 0}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
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

            {/* Modal: aplicar foto a todos os produtos da categoria */}
            <AnimatePresence>
                {imageCategory && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={closeImageModal}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700"
                        >
                            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-700/50">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Foto da categoria</h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{imageCategory.nome}</p>
                                </div>
                                <button type="button" onClick={closeImageModal} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors">
                                    <X className="size-5 text-slate-500 dark:text-slate-400" />
                                </button>
                            </div>

                            <div className="p-4 sm:p-6 space-y-4">
                                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                    A imagem escolhida será aplicada a <strong>todos os produtos</strong> desta categoria.
                                </p>

                                <label className="group relative flex flex-col items-center justify-center gap-2 w-full aspect-video rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-primary cursor-pointer overflow-hidden transition-colors bg-slate-50 dark:bg-slate-700/50">
                                    {previewUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={previewUrl} alt="Pré-visualização" className="absolute inset-0 w-full h-full object-cover" />
                                    ) : (
                                        <>
                                            <UploadCloud className="size-7 text-slate-400 group-hover:text-primary transition-colors" />
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Clique para escolher uma imagem</span>
                                        </>
                                    )}
                                    <input type="file" accept="image/*" onChange={handleFileChange} className="sr-only" />
                                </label>

                                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={somenteVazios}
                                        onChange={(e) => setSomenteVazios(e.target.checked)}
                                        className="size-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                                    />
                                    <span className="text-sm text-slate-600 dark:text-slate-300">Aplicar apenas em produtos sem foto</span>
                                </label>

                                <button
                                    type="button"
                                    onClick={handleApplyImage}
                                    disabled={!selectedFile || applyingImage}
                                    className="w-full px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {applyingImage ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
                                    {applyingImage ? 'Aplicando...' : 'Aplicar a todos os produtos'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
