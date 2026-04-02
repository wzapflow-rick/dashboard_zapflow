import React from 'react';
import Image from 'next/image';

interface TopProductsListProps {
    products: {
        name: string;
        sales: number;
        price: string;
        image: string;
    }[];
}

export function TopProductsList({ products }: TopProductsListProps) {
    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-600 ">
            <h4 className="font-bold text-slate-800 mb-6 dark:text-slate-200">Top 5 Produtos</h4>
            <div className="space-y-4">
                {products.map((product) => (
                    <div key={product.name} className="flex items-center gap-3 group cursor-pointer">
                        <div className="relative size-12 rounded-lg overflow-hidden shrink-0">
                            <Image src={product.image} alt={product.name} fill className="object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-primary dark:hover:text-blue-300 transition-colors dark:text-slate-200">
                                {product.name}
                            </p>
                            <p className="text-xs text-slate-500">{product.sales} vendas</p>
                        </div>
                        <span className="text-sm font-bold text-primary dark:text-blue-400 ">{product.price}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
