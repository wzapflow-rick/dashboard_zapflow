'use client';

import React, { useState, useMemo } from 'react';
import { Search, X, Filter } from 'lucide-react';
import MenuProductSelection from './menu-product-selection';
import CompositeProductCard from './composite-product-card';

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

export default function MenuFilter({
    grouped,
    compositeProducts,
    upsellProducts,
    whatsappNumber,
    empresaNome
}: MenuFilterProps) {
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<number | 'all' | 'composites'>('all');

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

        // Se uma categoria específica está selecionada (não é 'all' nem 'composites')
        if (selectedCategory !== 'all') {
            if (selectedCategory === 'composites') {
                // Mostrar apenas produtos compostos
                return { composites: filteredComposites, groups: [] };
            }
            // Mostrar apenas produtos da categoria selecionada
            filteredGroups = filteredGroups.filter((g: CategoryGroup) => g.id === selectedCategory);
            // Ocultar compostos quando uma categoria específica está selecionada
            filteredComposites = [];
        }

        return { composites: filteredComposites, groups: filteredGroups };
    }, [grouped, compositeProducts, search, selectedCategory]);

    const hasProducts = filteredData.groups.length > 0 || filteredData.composites.length > 0;

    return (
        <div className="space-y-6">
            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar produtos..."
                    className="w-full pl-12 pr-12 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300"
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
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
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
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Results Count */}
            {search && (
                <p className="text-sm text-slate-500">
                    {hasProducts 
                        ? `${filteredData.groups.reduce((acc, g) => acc + g.products.length, 0) + filteredData.composites.length} produto(s) encontrado(s)`
                        : 'Nenhum produto encontrado'}
                </p>
            )}

            {/* Composite Products */}
            {filteredData.composites.length > 0 && (
                <section>
                    <h2 className="text-lg font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="h-1 w-6 rounded-full bg-amber-400 inline-block" />
                        Monte seu Pedido
                    </h2>
                    <div className="space-y-3">
                        {filteredData.composites.map((composite: CompositeProduct) => (
                            <CompositeProductCard
                                key={composite.id}
                                product={composite}
                                whatsappNumber={whatsappNumber}
                                empresaNome={empresaNome}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Products by Category */}
            {filteredData.groups.map((group: CategoryGroup) => (
                <section key={group.id}>
                    <h2 className="text-lg font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="h-1 w-6 rounded-full bg-violet-500 inline-block" />
                        {group.name}
                    </h2>
                    <div className="space-y-3">
                        {group.products.map((product: Product) => (
                            <MenuProductSelection
                                key={product.id}
                                product={product}
                                whatsappNumber={whatsappNumber}
                                empresaNome={empresaNome}
                                upsellProducts={upsellProducts}
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
