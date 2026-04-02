'use client';

import React from 'react';
import Image from 'next/image';
import { Loader2, Edit3, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Category } from '@/app/actions/products';

interface ProductTableProps {
    loading: boolean;
    products: any[];
    paginatedProducts: any[];
    categories: Category[];
    insumosList: any[];
    productRecipes: any[];
    totalFiltered: number;
    currentPage: number;
    totalPages: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onEdit: (product: any) => void;
    onDelete: (id: number | string) => void;
    onToggleAvailability: (id: number | string, currentStatus: boolean) => void;
    user: any;
}

export default function ProductTable({
    loading,
    products,
    paginatedProducts,
    categories,
    insumosList,
    productRecipes,
    totalFiltered,
    currentPage,
    totalPages,
    itemsPerPage,
    onPageChange,
    onEdit,
    onDelete,
    onToggleAvailability,
    user
}: ProductTableProps) {

    const getCategoryName = (id: number | string) => {
        const cat = categories.find(c => String(c.id) === String(id));
        return cat ? cat.nome : 'Sem Categoria';
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden overflow-x-auto custom-scrollbar relative min-h-[300px]">
            {loading && (
                <div className="absolute inset-0 bg-white/50 dark:bg-slate-800/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="size-8 text-primary animate-spin" />
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Carregando...</p>
                    </div>
                </div>
            )}
            <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Produto</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Categoria</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Preço</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Disponibilidade</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {paginatedProducts.length > 0 ? paginatedProducts.map((product) => {
                        const productReceita = productRecipes.filter(r => r.produto_id === product.id);
                        let maxMakers = -1;
                        if (productReceita.length > 0) {
                            let minPossible = Infinity;
                            for (const item of productReceita) {
                                const insumoItem = insumosList.find(i => i.id === item.insumo_id);
                                if (insumoItem) {
                                    const possible = Math.floor(insumoItem.quantidade_atual / item.quantidade_necessaria);
                                    if (possible < minPossible) minPossible = possible;
                                }
                            }
                            maxMakers = minPossible === Infinity ? -1 : minPossible;
                        }

                        const isOutOfStock = maxMakers === 0;
                        const isEffectivelyUnavailable = !product.disponivel || isOutOfStock;

                        return (
                            <tr key={product.id} className={cn("hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors group", isEffectivelyUnavailable && "opacity-75")}>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "size-12 rounded-lg bg-slate-100 dark:bg-slate-700 overflow-hidden border border-slate-200 dark:border-slate-600 shrink-0 relative",
                                            isEffectivelyUnavailable && "grayscale"
                                        )}>
                                            <Image
                                                src={product.imagem || 'https://picsum.photos/seed/food/200/200'}
                                                alt={product.nome}
                                                fill
                                                className="object-cover"
                                                referrerPolicy="no-referrer"
                                            />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-slate-900 dark:text-white border-b-0">{product.nome}</span>
                                            <span className="text-xs text-slate-500 dark:text-slate-400">Cod: {product.id}</span>
                                            {user?.controle_estoque && maxMakers !== -1 && (
                                                <span className={cn("text-[10px] sm:text-xs font-bold mt-1 max-w-fit px-1.5 py-0.5 rounded-md flex items-center gap-1", isOutOfStock ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400" : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400")}>
                                                    {isOutOfStock ? "Insumos Esgotados!" : `Estoque: ${maxMakers} unid.`}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                        {getCategoryName(product.categoria_id)}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">R$ {product.preco}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={product.disponivel}
                                            disabled={isOutOfStock}
                                            onChange={() => onToggleAvailability(product.id, product.disponivel)}
                                        />
                                        <div className={cn("w-11 h-6 bg-slate-200 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all", product.disponivel ? "peer-checked:bg-primary" : "", isOutOfStock && "opacity-50 cursor-not-allowed")}></div>
                                    </label>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => onEdit(product)}
                                            className="p-2 text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20 rounded-lg transition-all"
                                        >
                                            <Edit3 className="size-4" />
                                        </button>
                                        <button
                                            onClick={() => onDelete(product.id)}
                                            className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    }) : !loading && (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">Nenhum produto encontrado.</td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="px-4 sm:px-6 py-4 bg-slate-50/50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-600 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide uppercase text-center sm:text-left">
                        Mostrando {paginatedProducts.length} de {totalFiltered} produtos
                    </span>
                    <div className="flex items-center gap-1 sm:gap-2">
                        <button
                            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30"
                        >
                            <ChevronLeft className="size-4" />
                        </button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    onClick={() => onPageChange(page)}
                                    className={cn(
                                        "w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors",
                                        currentPage === page ? "bg-primary text-white" : "hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
                                    )}
                                >
                                    {page}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30"
                        >
                            <ChevronRight className="size-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
