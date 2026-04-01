import { getPublicMenu } from '@/app/actions/public-menu';
import { UtensilsCrossed, MessageCircle } from 'lucide-react';
import MenuProductSelection from '@/components/menu/menu-product-selection';
import CompositeProductCard from '@/components/menu/composite-product-card';

export const dynamic = 'force-dynamic';

export default async function PublicMenuPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const data = await getPublicMenu(slug);

    if (!data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center p-8">
                    <UtensilsCrossed className="size-16 text-slate-300 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-slate-700">Cardápio não encontrado</h1>
                    <p className="text-slate-500 mt-2">O link pode estar incorreto ou a loja não existe.</p>
                </div>
            </div>
        );
    }

    const { empresa, grouped, compositeProducts } = data;
    const whatsappNumber = empresa.telefone?.replace(/\D/g, '');
    const hasComposites = compositeProducts && compositeProducts.length > 0;

    return (
        <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
            {/* Header */}
            <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
                    <div className="size-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                        {empresa.nome?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                        <h1 className="font-bold text-slate-900 text-lg leading-tight">{empresa.nome}</h1>
                        {empresa.nincho && (
                            <p className="text-xs text-slate-500 capitalize">{empresa.nincho}</p>
                        )}
                    </div>
                    {whatsappNumber && (
                        <a
                            href={`https://wa.me/${whatsappNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all"
                        >
                            <MessageCircle className="size-4" />
                            Pedir
                        </a>
                    )}
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 py-8 space-y-10">

                {/* Produtos Compostos (Pizzas Meio a Meio, etc.) */}
                {hasComposites && (
                    <section>
                        <h2 className="text-lg font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <span className="h-1 w-6 rounded-full bg-amber-400 inline-block" />
                            🍕 Monte seu Pedido
                        </h2>
                        <div className="space-y-3">
                            {compositeProducts.map((composite: any) => (
                                <CompositeProductCard
                                    key={composite.id}
                                    product={composite}
                                    whatsappNumber={whatsappNumber || ''}
                                    empresaNome={empresa.nome}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* Produtos regulares por categoria */}
                {grouped.length === 0 && !hasComposites ? (
                    <div className="text-center py-20">
                        <UtensilsCrossed className="size-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500">Nenhum produto disponível no momento.</p>
                    </div>
                ) : (
                    grouped.map((group: any) => (
                        <section key={group.id}>
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <span className="h-1 w-6 rounded-full bg-violet-500 inline-block" />
                                {group.name}
                            </h2>
                            <div className="space-y-3">
                                {group.products.map((product: any) => (
                                    <MenuProductSelection
                                        key={product.id}
                                        product={product}
                                        whatsappNumber={whatsappNumber || ''}
                                        empresaNome={empresa.nome}
                                    />
                                ))}
                            </div>
                        </section>
                    ))
                )}

                <footer className="text-center pt-4 pb-8">
                    <p className="text-xs text-slate-400">Cardápio digital por <span className="font-bold text-violet-500">ZapFlow</span></p>
                </footer>
            </div>
        </div>
    );
}
