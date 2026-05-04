'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, X, Star, Flame } from 'lucide-react';
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
    tag?: 'mais_pedido' | 'recomendado' | null;
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

// ── Componente: Card de Produto (Estilo iFood) ─────────────────────────────────

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
            className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] p-3 flex gap-4 hover:border-[#3a3a3a] transition-all cursor-pointer active:scale-[0.99] group"
        >
            {/* Imagem Grande */}
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden bg-[#2a2a2a] shrink-0">
                <Image
                    src={imgSrc}
                    alt={product.nome}
                    fill
                    sizes="(max-width: 640px) 112px, 128px"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMG;
                    }}
                />
            </div>

            {/* Conteudo */}
            <div className="flex flex-col flex-1 min-w-0 py-1">
                <h3 className="font-bold text-white text-sm sm:text-base leading-tight line-clamp-2">
                    {product.nome}
                </h3>
                {/* Tags do Produto */}
                {(product.tag || product.destaque) && (
                    <div className="flex gap-1.5 mt-1.5">
                        {(product.tag === 'mais_pedido' || product.destaque) && (
                            <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                                <Flame className="size-3" />
                                Mais Pedido
                            </span>
                        )}
                        {product.tag === 'recomendado' && (
                            <span className="inline-flex items-center gap-1 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                                <Star className="size-3 fill-current" />
                                Recomendado
                            </span>
                        )}
                    </div>
                )}
                {product.descricao && product.descricao.split('[[SIZES:')[0].trim() !== '' && (
                    <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">
                        {product.descricao.split('[[SIZES:')[0].trim()}
                    </p>
                )}
                <div className="mt-auto pt-2 flex items-end justify-between gap-3">
                    <div className="flex flex-col">
                        {hasDiscount ? (
                            <p className="text-xs text-gray-500 line-through leading-none mb-1">
                                {fmt(product.preco_original!)}
                            </p>
                        ) : null}
                        <span className="text-base sm:text-lg font-black text-red-500 leading-none">
                            {fmt(product.preco)}
                        </span>
                    </div>
                    <button
                        className="text-xs sm:text-sm font-bold px-4 py-2 rounded-lg bg-[#22c55e] text-white hover:bg-[#1ea34d] transition-colors shadow-lg shadow-green-900/20"
                    >
                        QUERO ESSA
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Componente: Card de Produto Composto (Estilo iFood) ──────────────────────

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
            className="bg-[#1a1a1a] rounded-2xl border border-orange-900/50 p-3 flex gap-4 hover:border-orange-700/50 transition-all cursor-pointer active:scale-[0.99] group"
        >
            {/* Icone */}
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-xl bg-gradient-to-br from-orange-950/50 to-amber-950/50 flex items-center justify-center shrink-0 border border-orange-800/30">
                <span className="text-5xl sm:text-6xl group-hover:scale-110 transition-transform duration-200">🍕</span>
            </div>

            {/* Conteúdo */}
            <div className="flex flex-col flex-1 min-w-0 py-1">
                <h3 className="font-bold text-white text-sm sm:text-base leading-tight line-clamp-2">
                    {product.nome}
                </h3>
                <p className="text-xs text-orange-400 mt-1.5 font-semibold">
                    {saborLabel}
                </p>
                {product.descricao && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                        {product.descricao}
                    </p>
                )}
                <div className="mt-auto pt-2 flex items-end justify-between gap-3">
                    <span className="text-base sm:text-lg font-black text-orange-400 leading-none">
                        {minPrice > 0 ? `${fmt(minPrice)}` : 'Ver'}
                    </span>
                    <button className="text-xs sm:text-sm font-bold text-white bg-[#22c55e] px-4 py-2 rounded-lg hover:bg-[#1ea34d] transition-colors shadow-lg shadow-green-900/20">
                        MONTAR
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Componente: Chip de Categoria (Estilo iFood) ──────────────────────────────

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
            className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all border ${
                isActive
                    ? 'bg-white text-black border-white'
                    : 'bg-transparent border-[#3a3a3a] text-gray-300 hover:border-gray-500'
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
    const [selectedCategory, setSelectedCategory] = useState<number | string | 'all'>('all');
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
        return grouped.map((g) => {
            const firstProductWithImage = (g.products || []).find(
                (p) => p.imagem && p.imagem.startsWith('http')
            );
            return {
                id: g.id,
                name: g.name,
                imageUrl: firstProductWithImage?.imagem ?? null,
            };
        });
    }, [grouped]);

    // ── Filtro de dados ───────────────────────────────────────────────────────
    const filteredGroups = useMemo(() => {
        let results = grouped;

        if (search.trim()) {
            const q = search.toLowerCase().trim();
            results = grouped.map((g) => ({
                ...g,
                products: g.products.filter(
                    (p) =>
                        p.nome.toLowerCase().includes(q) ||
                        (p.descricao && p.descricao.toLowerCase().includes(q))
                ),
                compositeProducts: (g.compositeProducts || []).filter(
                    (cp) =>
                        cp.nome.toLowerCase().includes(q) ||
                        (cp.descricao && cp.descricao.toLowerCase().includes(q))
                )
            })).filter(g => g.products.length > 0 || (g.compositeProducts && g.compositeProducts.length > 0));
        }

        if (selectedCategory !== 'all') {
            results = results.filter((g) => String(g.id) === String(selectedCategory));
        }

        return results;
    }, [grouped, search, selectedCategory]);

    const totalResults = useMemo(() => {
        return filteredGroups.reduce((acc, g) => acc + g.products.length + (g.compositeProducts?.length || 0), 0);
    }, [filteredGroups]);

    const hasResults = totalResults > 0;

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleProductClick = useCallback(
        (product: any) => {
            const hasSaborGroups = product.saborGroups && product.saborGroups.length > 0;
            const hasAdditionalGroups = product.additionalGroups && product.additionalGroups.length > 0;
            const hasSizes = (!!product.tamanhos && product.tamanhos !== '[]') || product.descricao?.includes('[[SIZES:');
            const hasUpsell = !!product.recomendacoes && (typeof product.recomendacoes === 'string' ? product.recomendacoes !== '[]' : Array.isArray(product.recomendacoes) && product.recomendacoes.length > 0);

            if (hasSaborGroups || hasAdditionalGroups || hasSizes || hasUpsell) {
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
        <div className="space-y-6">
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

            {/* Barra de Busca - Estilo iFood */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-500 pointer-events-none" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar no cardápio..."
                    className="w-full pl-12 pr-10 py-3.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#22c55e] focus:border-transparent transition-all placeholder:text-gray-500 text-white"
                />
                {search && (
                    <button
                        onClick={() => setSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-white rounded-full hover:bg-[#2a2a2a] transition-colors"
                        aria-label="Limpar busca"
                    >
                        <X className="size-4" />
                    </button>
                )}
            </div>

            {/* Chips de Categoria - Estilo iFood */}
            {categories.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 custom-scrollbar">
                    <CategoryChip
                        label="Todos"
                        isActive={selectedCategory === 'all'}
                        onClick={() => setSelectedCategory('all')}
                    />
                    {categories.map((cat) => (
                        <CategoryChip
                            key={cat.id}
                            label={cat.name}
                            isActive={String(selectedCategory) === String(cat.id)}
                            onClick={() => setSelectedCategory(cat.id)}
                            imageUrl={cat.imageUrl}
                        />
                    ))}
                </div>
            )}

            {/* Contador de resultados na busca */}
            {search.trim() && (
                <p className="text-sm text-gray-400">
                    {hasResults ? (
                        <>
                            <span className="font-semibold text-white">{totalResults}</span>{' '}
                            {totalResults === 1 ? 'resultado' : 'resultados'} para{' '}
                            <span className="font-semibold text-[#22c55e]">"{search}"</span>
                        </>
                    ) : (
                        <>Nenhum resultado para <span className="font-semibold">"{search}"</span></>
                    )}
                </p>
            )}

            {/* Categorias e seus produtos */}
            {filteredGroups.map((group) => (
                <section key={group.id}>
                    <div className="flex items-center gap-3 mb-4">
                        <Flame className="size-5 text-orange-500" />
                        <h2 className="text-base font-bold text-white uppercase tracking-wide flex-1">
                            {group.name}
                        </h2>
                        <span className="text-xs text-gray-500 font-medium">
                            {(group.products.length + (group.compositeProducts?.length || 0))} {(group.products.length + (group.compositeProducts?.length || 0)) === 1 ? 'item' : 'itens'}
                        </span>
                    </div>
                    <div className="space-y-3">
                        {/* Renderizar Compostos primeiro se houver */}
                        {group.compositeProducts?.map((composite) => (
                            <CompositeCard
                                key={composite.id}
                                product={composite}
                                onClick={() => handleCompositeClick(composite)}
                            />
                        ))}
                        {/* Renderizar Produtos Normais */}
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
