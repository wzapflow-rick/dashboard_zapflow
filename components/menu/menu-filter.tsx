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
        (product.additionalGroups && product.additionalGroups.length > 0);

    const hasDiscount = product.preco_original && product.preco_original > product.preco;
    const imgSrc = getProductImage(product);

    return (
        <div
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onClick()}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-3 flex gap-3 hover:shadow-md hover:border-violet-200 dark:hover:border-violet-700 transition-all cursor-pointer active:scale-[0.99] group"
        >
            {/* Imagem */}
            <div className="relative w-[88px] h-[88px] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0">
                <Image
                    src={imgSrc}
                    alt={product.nome}
                    fill
                    sizes="88px"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMG;
                    }}
                />
                {/* Badge destaque */}
                {product.destaque && (
                    <div className="absolute top-1.5 left-1.5 bg-amber-400 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                        <Star className="size-2.5 fill-current" />
                        Top
                    </div>
                )}
            </div>

            {/* Conteúdo */}
            <div className="flex flex-col flex-1 min-w-0 py-0.5">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight line-clamp-2">
                    {product.nome}
                </h3>
                {product.descricao && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {product.descricao}
                    </p>
                )}
                <div className="mt-auto pt-2 flex items-end justify-between gap-2">
                    <div>
                        {hasDiscount && (
                            <p className="text-xs text-slate-400 line-through leading-none mb-0.5">
                                {fmt(product.preco_original!)}
                            </p>
                        )}
                        <span className="text-base font-black text-violet-600 dark:text-violet-400 leading-none">
                            {fmt(product.preco)}
                        </span>
                    </div>
                    <span
                        className={`text-xs font-bold px-2.5 py-1.5 rounded-xl shrink-0 transition-colors ${
                            hasComplements
                                ? 'text-violet-600 bg-violet-50 dark:bg-violet-900/20 dark:text-violet-400 group-hover:bg-violet-100'
                                : 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 group-hover:bg-green-100'
                        }`}
                    >
                        {hasComplements ? 'Escolher' : '+ Adicionar'}
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
            className="bg-white dark:bg-slate-800 rounded-2xl border border-amber-200 dark:border-amber-700/50 shadow-sm p-3 flex gap-3 hover:shadow-md hover:border-amber-300 dark:hover:border-amber-600 transition-all cursor-pointer active:scale-[0.99] group"
        >
            {/* Ícone */}
            <div className="relative w-[88px] h-[88px] rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20 flex items-center justify-center shrink-0 border border-amber-100 dark:border-amber-800/30">
                <span className="text-4xl group-hover:scale-110 transition-transform duration-200">🍕</span>
            </div>

            {/* Conteúdo */}
            <div className="flex flex-col flex-1 min-w-0 py-0.5">
                <div className="flex items-start gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight flex-1 line-clamp-2">
                        {product.nome}
                    </h3>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                    {saborLabel}
                </p>
                {product.descricao && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                        {product.descricao}
                    </p>
                )}
                <div className="mt-auto pt-2 flex items-end justify-between gap-2">
                    <span className="text-base font-black text-amber-600 dark:text-amber-400 leading-none">
                        {minPrice > 0 ? `A partir de ${fmt(minPrice)}` : 'Consulte o preço'}
                    </span>
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-2.5 py-1.5 rounded-xl shrink-0 group-hover:bg-amber-100 transition-colors">
                        Montar
                    </span>
                </div>
            </div>
        </div>
    );
}

// ── Componente: Chip de Categoria ─────────────────────────────────────────────

function CategoryChip({
    label,
    isActive,
    onClick,
    imageUrl,
}: {
    label: string;
    isActive: boolean;
    onClick: () => void;
    imageUrl?: string | null;
}) {
    return (
        <button
            onClick={onClick}
            className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold transition-all ${
                isActive
                    ? 'bg-violet-500 text-white shadow-md shadow-violet-200 dark:shadow-violet-900/30'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
        >
            {imageUrl && (
                <div className="relative size-5 rounded-full overflow-hidden shrink-0">
                    <Image
                        src={imageUrl}
                        alt={label}
                        fill
                        sizes="20px"
                        className="object-cover"
                        onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                    />
                </div>
            )}
            {label}
        </button>
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
    const [selectedCategory, setSelectedCategory] = useState<number | 'all' | 'composites'>('all');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedComposite, setSelectedComposite] = useState<CompositeProduct | null>(null);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);

    const { addItem, items } = useCart();

    // ── Escutar evento de edição do carrinho ──────────────────────────────────
    useEffect(() => {
        const handleEdit = (e: CustomEvent) => {
            const { itemId } = e.detail;
            const item = items.find((i) => i.id === itemId);
            if (!item) return;

            setEditingItemId(itemId);

            if (item.isComposite) {
                const composite = allComposites.find((c: any) => c._grupoId === item.grupoId);
                if (composite) {
                    setSelectedComposite({ ...composite, _editingData: item });
                }
            } else {
                const product = grouped.flatMap((g) => g.products).find((p) => p.id === item.productId);
                if (product) {
                    setSelectedProduct({ ...product, _editingData: item });
                }
            }
        };

        window.addEventListener('edit-cart-item', handleEdit as EventListener);
        return () => window.removeEventListener('edit-cart-item', handleEdit as EventListener);
    }, [items, allComposites, grouped]);

    // ── Chips de categoria ─────────────────────
    const categories = useMemo(() => {
        const cats: { id: number | 'composites'; name: string; imageUrl?: string | null }[] = [];

        if (compositeProducts.length > 0) {
            cats.push({ id: 'composites', name: '🍕 Montar' });
        }

        grouped.forEach((g) => {
            const firstProductWithImage = g.products.find(
                (p) => p.imagem && p.imagem.startsWith('http')
            );
            cats.push({
                id: g.id as number,
                name: g.name,
                imageUrl: firstProductWithImage?.imagem ?? null,
            });
        });

        return cats;
    }, [grouped, compositeProducts]);

    // ── Filtro de dados ───────────────────────────────────────────────────────
    const filteredData = useMemo(() => {
        let filteredComposites = compositeProducts;
        let filteredGroups = grouped;

        if (search.trim()) {
            const q = search.toLowerCase().trim();
            filteredComposites = compositeProducts.filter((p) =>
                p.nome.toLowerCase().includes(q) || (p.descricao && p.descricao.toLowerCase().includes(q))
            );
            filteredGroups = grouped
                .map((g) => ({
                    ...g,
                    products: g.products.filter(
                        (p) =>
                            p.nome.toLowerCase().includes(q) ||
                            (p.descricao && p.descricao.toLowerCase().includes(q))
                    ),
                }))
                .filter((g) => g.products.length > 0);
        }

        if (selectedCategory !== 'all') {
            if (selectedCategory === 'composites') {
                return { composites: filteredComposites, groups: [] };
            }
            filteredGroups = filteredGroups.filter((g) => g.id === selectedCategory);
            filteredComposites = [];
        }

        return { composites: filteredComposites, groups: filteredGroups };
    }, [grouped, compositeProducts, search, selectedCategory]);

    const totalResults =
        filteredData.groups.reduce((acc, g) => acc + g.products.length, 0) +
        filteredData.composites.length;

    const hasResults = totalResults > 0;

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleProductClick = useCallback(
        (product: Product) => {
            const hasSaborGroups = product.saborGroups && product.saborGroups.length > 0;
            const hasAdditionalGroups = product.additionalGroups && product.additionalGroups.length > 0;

            if (hasSaborGroups || hasAdditionalGroups) {
                setSelectedProduct(product);
            } else {
                addItem({
                    productId: product.id,
                    nome: product.nome,
                    preco: Number(product.preco || 0),
                    quantidade: 1,
                    imagem: product.imagem || undefined,
                });
                toast.success(`${product.nome} adicionado!`, { duration: 1500 });
            }
        },
        [addItem]
    );

    const handleCompositeClick = useCallback((composite: CompositeProduct) => {
        setSelectedComposite(composite);
    }, []);

    const closeProductModal = useCallback(() => {
        setSelectedProduct(null);
        setEditingItemId(null);
    }, []);

    const closeCompositeModal = useCallback(() => {
        setSelectedComposite(null);
        setEditingItemId(null);
    }, []);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-5">
            {/* Modais */}
            {selectedProduct && (
                <MenuProductSelectionModal
                    product={selectedProduct}
                    whatsappNumber={whatsappNumber}
                    empresaNome={empresaNome}
                    upsellProducts={upsellProducts}
                    onClose={closeProductModal}
                    editingItemId={editingItemId || undefined}
                />
            )}
            {selectedComposite && (
                <CompositeProductModal
                    product={selectedComposite}
                    whatsappNumber={whatsappNumber}
                    empresaNome={empresaNome}
                    allComposites={allComposites}
                    allGroups={
                        allGroups.length > 0
                            ? allGroups
                            : grouped.flatMap((g) =>
                                  g.products.flatMap((p) => [
                                      ...(p.saborGroups || []),
                                      ...(p.additionalGroups || []),
                                  ])
                              )
                    }
                    onClose={closeCompositeModal}
                    editingItemId={editingItemId || undefined}
                />
            )}

            {/* Barra de Busca */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4.5 text-slate-400 pointer-events-none" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar no cardápio..."
                    className="w-full pl-11 pr-10 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all placeholder:text-slate-400 dark:text-white"
                />
                {search && (
                    <button
                        onClick={() => setSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        aria-label="Limpar busca"
                    >
                        <X className="size-4" />
                    </button>
                )}
            </div>

            {/* Chips de Categoria */}
            {categories.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 custom-scrollbar">
                    <CategoryChip
                        label="Todos"
                        isActive={selectedCategory === 'all'}
                        onClick={() => setSelectedCategory('all')}
                    />
                    {categories.map((cat) => (
                        <CategoryChip
                            key={cat.id}
                            label={cat.name}
                            isActive={selectedCategory === cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            imageUrl={cat.imageUrl}
                        />
                    ))}
                </div>
            )}

            {/* Contador de resultados na busca */}
            {search.trim() && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {hasResults ? (
                        <>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{totalResults}</span>{' '}
                            {totalResults === 1 ? 'resultado' : 'resultados'} para{' '}
                            <span className="font-semibold text-violet-600">"{search}"</span>
                        </>
                    ) : (
                        <>Nenhum resultado para <span className="font-semibold">"{search}"</span></>
                    )}
                </p>
            )}

            {/* Produtos Compostos - AGRUPADOS SOB UMA ÚNICA TARJETA */}
            {filteredData.composites.length > 0 && (
                <section>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="h-1 w-6 rounded-full bg-amber-400 shrink-0" />
                        <h2 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-wide">
                            MONTE SEU PEDIDO
                        </h2>
                    </div>
                    <div className="space-y-3">
                        {filteredData.composites.map((composite) => (
                            <CompositeCard
                                key={composite.id}
                                product={composite}
                                onClick={() => handleCompositeClick(composite)}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Produtos por Categoria (Normais) */}
            {filteredData.groups.map((group) => (
                <section key={group.id}>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="h-1 w-6 rounded-full bg-violet-500 shrink-0" />
                        <h2 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-wide flex-1">
                            {group.name}
                        </h2>
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                            {group.products.length} {group.products.length === 1 ? 'item' : 'itens'}
                        </span>
                    </div>
                    <div className="space-y-3">
                        {group.products.map((product) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                onClick={() => handleProductClick(product)}
                            />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
