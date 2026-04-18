import { getPublicMenu } from '@/app/actions/public-menu';
import { UtensilsCrossed } from 'lucide-react';
import MenuClientWrapper from '@/components/menu/menu-client-wrapper';
import MenuFilter from '@/components/menu/menu-filter';

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

    const { empresa, grouped, compositeProducts, upsellProducts, loyaltyConfig } = data;
    const whatsappNumber = empresa.telefone?.replace(/\D/g, '');
    const pontosPorReal = loyaltyConfig?.ativo ? Number(loyaltyConfig.pontos_por_real || 1) : 0;

    return (
        <MenuClientWrapper 
            whatsappNumber={whatsappNumber || ''} 
            empresaNome={empresa.nome}
            empresaId={empresa.id}
            pontosPorReal={pontosPorReal}
            upsellProducts={upsellProducts || []}
        >
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
                    </div>
                </div>

                <div className="max-w-2xl mx-auto px-4 py-8">
                    {grouped.length === 0 && (!compositeProducts || compositeProducts.length === 0) ? (
                        <div className="text-center py-20">
                            <UtensilsCrossed className="size-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500">Nenhum produto disponível no momento.</p>
                        </div>
                    ) : (
                        <MenuFilter
                            grouped={grouped}
                            compositeProducts={compositeProducts || []}
                            upsellProducts={upsellProducts || []}
                            whatsappNumber={whatsappNumber || ''}
                            empresaNome={empresa.nome}
                            allComposites={compositeProducts || []}
                        />
                    )}

                    <footer className="text-center pt-8 pb-8">
                        <p className="text-xs text-slate-400">Cardápio digital por <span className="font-bold text-violet-500">ZapFlow</span></p>
                    </footer>
                </div>
            </div>
        </MenuClientWrapper>
    );
}
