'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import Image from 'next/image';
import { useCart } from './cart-context';
import { toast } from 'sonner';
import MenuProductSelection from './menu-product-selection';
import MenuProductSelectionModal from './menu-product-selection-modal';
import CompositeProductModal from './composite-product-modal';

interface Product {
    id: number;
    nome: string;
    descricao?: string;
    preco: number;
    imagem?: string | null;
    complementGroups?: any[];
}

interface CategoryGroup {
    id: number;
    name: string;
    products: Product[];
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
    minimo: number;
    maximo: number;
    items: any[];
}

interface MenuFilterProps {
    grouped: CategoryGroup[];
    compositeProducts: CompositeProduct[];
    upsellProducts: any[];
    whatsappNumber: string;
    empresaNome: string;
}

const fmt = (price: number) => `R$ ${price.toFixed(2).replace('.', ',')}`;

function ProductCard({ product, onClick }: { product: Product; onClick: () => void }) {
    const hasComplements = product.complementGroups && product.complementGroups.length > 0;
    
    return (
        <div 
            onClick={onClick}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm p-3 flex gap-3 hover:shadow-md transition-all cursor-pointer"
        >
            <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                <Image
                    src={product.imagem || `https://picsum.photos/seed/${product.id}/200/200`}
                    alt={product.nome}
                    fill
                    className="object-cover"
                    referrerPolicy="no-referrer"
                />
            </div>
            <div className="flex flex-col flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">{product.nome}</h3>
                {product.descricao && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{product.descricao}</p>
                )}
                <div className="mt-auto pt-1 flex items-center justify-between">
                    <span className="text-base font-black text-violet-600">{fmt(product.preco)}</span>
                    <span className="text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-lg">
                        {hasComplements ? 'Escolher' : 'Adicionar'}
                    </span>
                </div>
            </div>
        </div>
    );
}

function CompositeCard({ product, onClick }: { product: CompositeProduct; onClick: () => void }) {
    const prices = product.items.map(i => i.preco).filter(p => p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    
    return (
        <div 
            onClick={onClick}
            className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-700 shadow-sm p-3 flex gap-3 hover:shadow-md transition-all cursor-pointer"
        >
            <div className="relative w-20 h-20 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <span className="text-3xl">🍕</span>
            </div>
            <div className="flex flex-col flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">{product.nome}</h3>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                    {product.minimo === product.maximo ? `${product.minimo} sabor` : `${product.minimo} a ${product.maximo} sabores`}
                </p>
                <div className="mt-auto pt-1 flex items-center justify-between">
                    <span className="text-base font-black text-amber-600">A partir de {fmt(minPrice)}</span>
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg">
                        Montar
                    </span>
                </div>
            </div>
        </div>
    );
}

export default function MenuFilter({
    grouped,
    compositeProducts,
    upsellProducts,
    whatsappNumber,
    empresaNome
}: MenuFilterProps) {
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<number | 'all' | 'composites'>('all');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedComposite, setSelectedComposite] = useState<CompositeProduct | null>(null);
    const { addItem } = useCart();

    const categories = useMemo(() => {
        const cats: { id: number | 'composites'; name: string }[] = [];
        
        if (compositeProducts.length > 0) {
            cats.push({ id: 'composites', name: 'Montar Pedido' });
        }
        
        grouped.forEach((g: CategoryGroup) => {
            cats.push({ id: g.id, name: g.name });
        });
        
        return cats;
    }, [grouped, compositeProducts]);

    const filteredData = useMemo(() => {
        let filteredComposites = compositeProducts;
        let filteredGroups = grouped;

        if (search) {
            const searchLower = search.toLowerCase();
            
            filteredComposites = compositeProducts.filter((p: CompositeProduct) =>
                p.nome.toLowerCase().includes(searchLower)
            );
            
            filteredGroups = grouped.map((g: CategoryGroup) => ({
                ...g,
                products: g.products.filter((p: Product) =>
                    p.nome.toLowerCase().includes(searchLower) ||
                    p.descricao?.toLowerCase().includes(searchLower)
                )
            })).filter((g: CategoryGroup) => g.products.length > 0);
        }

        if (selectedCategory !== 'all') {
            if (selectedCategory === 'composites') {
                return { composites: filteredComposites, groups: [] };
            }
            filteredGroups = filteredGroups.filter((g: CategoryGroup) => g.id === selectedCategory);
            filteredComposites = [];
        }

        return { composites: filteredComposites, groups: filteredGroups };
    }, [grouped, compositeProducts, search, selectedCategory]);

    const hasProducts = filteredData.groups.length > 0 || filteredData.composites.length > 0;

    const handleProductClick = (product: Product) => {
        const hasComplements = product.complementGroups && product.complementGroups.length > 0;
        
        if (hasComplements) {
            setSelectedProduct(product);
        } else {
            addItem({
                productId: product.id,
                nome: product.nome,
                preco: Number(product.preco || 0),
                quantidade: 1,
                imagem: product.imagem || undefined
            });
            toast.success(`${product.nome} adicionado ao carrinho!`);
        }
    };

    const handleCompositeClick = (composite: CompositeProduct) => {
        setSelectedComposite(composite);
    };

    const closeProductModal = () => {
        setSelectedProduct(null);
    };

    const closeCompositeModal = () => {
        setSelectedComposite(null);
    };

    return (
        <div className="space-y-6">
            {/* Product Selection Modal */}
            {selectedProduct && (
                <MenuProductSelectionModal
                    product={selectedProduct}
                    whatsappNumber={whatsappNumber}
                    empresaNome={empresaNome}
                    upsellProducts={upsellProducts}
                    onClose={closeProductModal}
                />
            )}

            {/* Composite Selection Modal */}
            {selectedComposite && (
                <CompositeProductModal
                    product={selectedComposite}
                    whatsappNumber={whatsappNumber}
                    empresaNome={empresaNome}
                    onClose={closeCompositeModal}
                />
            )}

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar produtos..."
                    className="w-full pl-12 pr-12 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 dark:text-white"
                />
                {search && (
                    <button
                        onClick={() => setSearch('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                    >
                        <X className="size-4" />
                    </button>
                )}
            </div>

            {/* Category Filters */}
            {categories.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    <button
                        onClick={() => setSelectedCategory('all')}
                        className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                            selectedCategory === 'all'
                                ? 'bg-violet-500 text-white'
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                    >
                        Todos
                    </button>
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                                selectedCategory === cat.id
                                    ? 'bg-violet-500 text-white'
                                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Results Count */}
            {search && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {hasProducts 
                        ? `${filteredData.groups.reduce((acc, g) => acc + g.products.length, 0) + filteredData.composites.length} produto(s) encontrado(s)`
                        : 'Nenhum produto encontrado'}
                </p>
            )}

            {/* Composite Products */}
            {filteredData.composites.length > 0 && (
                <section>
                    <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="h-1 w-6 rounded-full bg-amber-400 inline-block" />
                        Monte seu Pedido
                    </h2>
                    <div className="space-y-3">
                        {filteredData.composites.map((composite: CompositeProduct) => (
                            <CompositeCard
                                key={composite.id}
                                product={composite}
                                onClick={() => handleCompositeClick(composite)}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Products by Category */}
            {filteredData.groups.map((group: CategoryGroup) => (
                <section key={group.id}>
                    <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="h-1 w-6 rounded-full bg-violet-500 inline-block" />
                        {group.name}
                    </h2>
                    <div className="space-y-3">
                        {group.products.map((product: Product) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                onClick={() => handleProductClick(product)}
                            />
                        ))}
                    </div>
                </section>
            ))}

            {/* No Results */}
            {!hasProducts && search && (
                <div className="text-center py-12">
                    <Search className="size-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">Nenhum produto encontrado para "{search}"</p>
                </div>
            )}
        </div>
    );
}
