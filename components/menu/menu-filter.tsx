'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, X, Star } from 'lucide-react';
import Image from 'next/image';
import { useCart } from './cart-context';
import { toast } from 'sonner';
import MenuProductSelectionModal from './menu-product-selection-modal';
import CompositeProductModal from './composite-product-modal';

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface Product {
    id: number;
    nome: string;
    descricao?: string;
    preco: number;
    preco_original?: number;
    imagem?: string | null;
    disponivel?: boolean;
    destaque?: boolean;
    complementGroups?: any[];
    saborGroups?: any[];
    additionalGroups?: any[];
    tamanhos?: string | null;
    _editingData?: any;
}

interface CompositeProduct {
    id: string;
    _grupoId: number;
    _isComposite: true;
    nome: string;
    descricao?: string;
    imagem?: string;
    tipo_calculo?: string;
    cobrar_mais_caro?: boolean;
    preco_fixo?: number;
    completamentos_ids?: number[];
    minimo: number;
    maximo: number;
    items: any[];
    _editingData?: any;
}

interface CategoryGroup {
    id: number | string;
    name: string;
    icone?: string | null;
    cor?: string | null;
    ordem?: number;
    products: Product[];
    compositeProducts?: CompositeProduct[];
}

interface MenuFilterProps {
    grouped: CategoryGroup[];
    compositeProducts: CompositeProduct[];
    upsellProducts: any[];
    whatsappNumber: string;
    empresaNome: string;
    allComposites?: any[];
    allGroups?: any[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (price: number) => `R$ ${price.toFixed(2).replace('.', ',')}`;

const PLACEHOLDER_IMG = '/images/produto-placeholder.svg';

function getProductImage(product: Product): string {
    if (product.imagem && product.imagem.startsWith('http')) {
        return product.imagem;
    }
    return PLACEHOLDER_IMG;
}

// ── Componente: Card de Produto ────────────────────────────────────────────────

function ProductCard({ product, onClick }: { product: Product; onClick: () => void }) {
    const hasComplements =
        (product.complementGroups && product.complementGroups.length > 0) ||
        (product.saborGroups && product.saborGroups.length > 0) ||
        (product.additionalGroups && product.additionalGroups.length > 0) ||
        (!!product.tamanhos && product.tamanhos !== '[]') ||
        (product.descricao?.includes('[[SIZES:'));

    const hasDiscount = product.preco_original && product.preco_original > product.preco;
    const imgSrc = getProductImage(product);

    return (
        <div
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onClick()}
            className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-2 sm:p-3 flex gap-3 hover:shadow-md hover:border-violet-200 dark:hover:border-violet-700 transition-all cursor-pointer active:scale-[0.98] group"
        >
            {/* Imagem */}
            <div className="relative w-20 h-20 sm:w-[88px] sm:h-[88px] rounded-lg sm:rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0">
                <Image
                    src={imgSrc}
                    alt={product.nome}
                    fill
                    sizes="(max-width: 640px) 80px, 88px"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMG;
                    }}
                />
                {/* Badge destaque */}
                {product.destaque && (
                    <div className="absolute top-1 left-1 bg-amber-400 text-amber-900 text-[8px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                        <Star className="size-2 sm:size-2.5 fill-current" />
                        Top
                    </div>
                )}
            </div>

            {/* Conteúdo */}
            <div className="flex flex-col flex-1 min-w-0 py-0.5">
                <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm leading-tight line-clamp-2">
                    {product.nome}
                </h3>
                {product.descricao && (
                    <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-tight sm:leading-relaxed">
                        {product.descricao.split('[[SIZES:')[0].trim()}
                    </p>
                )}
                <div className="mt-auto pt-1 sm:pt-2 flex items-end justify-between gap-2">
                    <div className="shrink-0">
                        {hasDiscount && (
                            <p className="text-[10px] text-slate-400 line-through leading-none mb-0.5">
                                {fmt(product.preco_original!)}
                            </p>
                        )}
                        <span className="text-sm sm:text-base font-black text-violet-600 dark:text-violet-400 leading-none">
                            {fmt(product.preco)}
                        </span>
                    </div>
                    <span
                        className={`text-[10px] sm:text-xs font-bold px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl shrink-0 transition-colors ${
                            hasComplements
                                ? 'text-violet-600 bg-violet-50 dark:bg-violet-900/20 dark:text-violet-400'
                                : 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400'
                        }`}
                    >
                        {hasComplements ? 'Escolher' : '+ Add'}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ── Componente: Card de Produto Composto ──────────────────────────────────────

function CompositeCard({ product, onClick }: { product: CompositeProduct; onClick: () => void }) {
    const prices = product.items.map((i: any) => i.preco).filter((p: number) => p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;

    const saborLabel =
        product.minimo === product.maximo
            ? `${product.minimo} sabor${product.minimo > 1 ? 'es' : ''}`
            : `${product.minimo} a ${product.maximo} sabores`;

    return (
        <div
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onClick()}
            className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-amber-200 dark:border-amber-700/50 shadow-sm p-2 sm:p-3 flex gap-3 hover:shadow-md hover:border-amber-300 dark:hover:border-amber-600 transition-all cursor-pointer active:scale-[0.98] group"
        >
            {/* Ícone */}
            <div className="relative w-20 h-20 sm:w-[88px] sm:h-[88px] rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20 flex items-center justify-center shrink-0 border border-amber-100 dark:border-amber-800/30">
                <span className="text-3xl sm:text-4xl group-hover:scale-110 transition-transform duration-200">🍕</span>
            </div>

            {/* Conteúdo */}
            <div className="flex flex-col flex-1 min-w-0 py-0.5">
                <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm leading-tight line-clamp-2">
                    {product.nome}
                </h3>
                <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                    {saborLabel}
                </p>
                {product.descricao && (
                    <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                        {product.descricao}
                    </p>
                )}
                <div className="mt-auto pt-1 sm:pt-2 flex items-end justify-between gap-2">
                    <span className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400 leading-none">
                        {minPrice > 0 ? `${fmt(minPrice)}` : 'Ver'}
                    </span>
                    <span className="text-[10px] sm:text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl shrink-0 group-hover:bg-amber-100 transition-colors">
                        Montar
                    </span>
                </div>
            </div>
        </div>
    );
}

// ── Componente Principal ───────────────────────────────────────────────────────

export default function MenuFilter({
    grouped,
    compositeProducts,
    upsellProducts,
    whatsappNumber,
    empresaNome,
    allComposites = [],
    allGroups = [],
}: MenuFilterProps) {
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<number | string | 'all'>('all');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedComposite, setSelectedComposite] = useState<CompositeProduct | null>(null);

    // Filtragem de produtos
    const filteredGroups = useMemo(() => {
        return grouped.map(group => {
            const filteredProducts = group.products.filter(p => 
                p.nome.toLowerCase().includes(search.toLowerCase()) || 
                p.descricao?.toLowerCase().includes(search.toLowerCase())
            );
            const filteredComposites = (group.compositeProducts || []).filter(p => 
                p.nome.toLowerCase().includes(search.toLowerCase()) || 
                p.descricao?.toLowerCase().includes(search.toLowerCase())
            );

            if (selectedCategory !== 'all' && group.id !== selectedCategory) {
                return { ...group, products: [], compositeProducts: [] };
            }

            return { ...group, products: filteredProducts, compositeProducts: filteredComposites };
        }).filter(group => group.products.length > 0 || (group.compositeProducts && group.compositeProducts.length > 0));
    }, [grouped, search, selectedCategory]);

    // Rolar para a categoria ao clicar no chip
    const scrollToCategory = (id: number | string) => {
        setSelectedCategory(id);
        if (id === 'all') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        const element = document.getElementById(`category-${id}`);
        if (element) {
            const offset = 140; // Header + Chips height
            const bodyRect = document.body.getBoundingClientRect().top;
            const elementRect = element.getBoundingClientRect().top;
            const elementPosition = elementRect - bodyRect;
            const offsetPosition = elementPosition - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div className="space-y-6">
            {/* ── Barra de Busca e Categorias Fixas ─────────────────────────── */}
            <div className="sticky top-[60px] sm:top-[68px] z-40 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md -mx-4 px-4 py-3 space-y-3 border-b border-slate-200 dark:border-slate-800">
                {/* Busca */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="O que você quer comer hoje?"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all dark:text-white"
                    />
                    {search && (
                        <button 
                            onClick={() => setSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"
                        >
                            <X className="size-3 text-slate-400" />
                        </button>
                    )}
                </div>

                {/* Chips de Categoria */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                    <button
                        onClick={() => scrollToCategory('all')}
                        className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                            selectedCategory === 'all'
                                ? 'bg-violet-500 border-violet-500 text-white shadow-md'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                    >
                        Tudo
                    </button>
                    {grouped.map((group) => (
                        <button
                            key={group.id}
                            onClick={() => scrollToCategory(group.id)}
                            className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                                selectedCategory === group.id
                                    ? 'bg-violet-500 border-violet-500 text-white shadow-md'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                            }`}
                        >
                            {group.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Listagem de Produtos ─────────────────────────────────────── */}
            <div className="space-y-10">
                {filteredGroups.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-slate-500 dark:text-slate-400">Nenhum produto encontrado para sua busca.</p>
                    </div>
                ) : (
                    filteredGroups.map((group) => (
                        <section key={group.id} id={`category-${group.id}`} className="scroll-mt-32">
                            <div className="flex items-center gap-3 mb-4">
                                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                    {group.name}
                                </h2>
                                <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:gap-4">
                                {group.compositeProducts?.map((p) => (
                                    <CompositeCard
                                        key={p.id}
                                        product={p}
                                        onClick={() => setSelectedComposite(p)}
                                    />
                                ))}
                                {group.products.map((p) => (
                                    <ProductCard
                                        key={p.id}
                                        product={p}
                                        onClick={() => setSelectedProduct(p)}
                                    />
                                ))}
                            </div>
                        </section>
                    ))
                )}
            </div>

            {/* ── Modais ────────────────────────────────────────────────────── */}
            {selectedProduct && (
                <MenuProductSelectionModal
                    product={selectedProduct}
                    whatsappNumber={whatsappNumber}
                    empresaNome={empresaNome}
                    upsellProducts={upsellProducts}
                    onClose={() => setSelectedProduct(null)}
                />
            )}

            {selectedComposite && (
                <CompositeProductModal
                    product={selectedComposite}
                    whatsappNumber={whatsappNumber}
                    empresaNome={empresaNome}
                    allComposites={allComposites}
                    allGroups={allGroups}
                    onClose={() => setSelectedComposite(null)}
                />
            )}
        </div>
    );
}
