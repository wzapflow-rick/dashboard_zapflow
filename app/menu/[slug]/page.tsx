import { getPublicMenu } from '@/app/actions/public-menu';
import { UtensilsCrossed, MapPin, Clock } from 'lucide-react';
import MenuClientWrapper from '@/components/menu/menu-client-wrapper';
import MenuFilter from '@/components/menu/menu-filter';
import type { Metadata } from 'next';
import Image from 'next/image';

// Forçar renderização dinâmica para refletir mudanças instantâneas no cardápio
export const dynamic = 'force-dynamic';

// Gerar metadata dinâmico para SEO
export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const data = await getPublicMenu(slug);

    if (!data) {
        return {
            title: 'Cardápio não encontrado',
            description: 'O cardápio solicitado não foi encontrado.',
        };
    }

    const { empresa } = data;
    return {
        title: `Cardápio — ${empresa.nome}`,
        description: `Veja o cardápio completo de ${empresa.nome}${empresa.cidade ? ` em ${empresa.cidade}` : ''}. Peça agora pelo WhatsApp!`,
        openGraph: {
            title: `Cardápio — ${empresa.nome}`,
            description: `Peça agora pelo WhatsApp!`,
            type: 'website',
            images: empresa.logo ? [empresa.logo] : [],
        },
    };
}

export default async function PublicMenuPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const data = await getPublicMenu(slug);

    // ── Estado de erro: empresa não encontrada ────────────────────────────────
    if (!data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <div className="text-center p-8 max-w-sm">
                    <div className="size-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-6">
                        <UtensilsCrossed className="size-10 text-slate-300 dark:text-slate-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                        Cardápio não encontrado
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                        O link pode estar incorreto ou a loja ainda não configurou seu cardápio.
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-600 mt-4">
                        Slug: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{slug}</code>
                    </p>
                </div>
            </div>
        );
    }

    const { empresa, grouped, compositeProducts, upsellProducts, loyaltyConfig, allGroups } = data;

    const whatsappNumber = empresa.telefone?.replace(/\D/g, '') ?? '';
    const pontosPorReal = loyaltyConfig?.ativo ? Number(loyaltyConfig.pontos_por_real || 1) : 0;

    // Inicial do nome para o avatar (fallback se não tiver logo)
    const inicial = empresa.nome?.charAt(0)?.toUpperCase() ?? '?';

    // Total de produtos disponíveis
    const totalProdutos = grouped.reduce((acc, cat) => acc + cat.products.length + cat.compositeProducts.length, 0);

    return (
        <MenuClientWrapper
            whatsappNumber={whatsappNumber}
            empresaNome={empresa.nome}
            empresaId={empresa.id}
            pontosPorReal={pontosPorReal}
            upsellProducts={upsellProducts}
        >
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors pb-24">

                {/* ── Header fixo ──────────────────────────────────────────── */}
                <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="max-w-2xl mx-auto px-4 py-2 sm:py-3 flex items-center gap-3">
                        {/* Logo ou Avatar com inicial */}
                        <div
                            className="size-10 sm:size-11 rounded-xl flex items-center justify-center text-white font-bold text-base sm:text-lg shrink-0 shadow-sm overflow-hidden"
                            style={!empresa.logo ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' } : {}}
                            aria-hidden="true"
                        >
                            {empresa.logo ? (
                                <Image 
                                    src={empresa.logo} 
                                    alt={empresa.nome} 
                                    width={44} 
                                    height={44} 
                                    className="size-full object-cover"
                                />
                            ) : (
                                inicial
                            )}
                        </div>

                        {/* Info da empresa */}
                        <div className="flex-1 min-w-0">
                            <h1 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base leading-tight truncate">
                                {empresa.nome}
                            </h1>
                            <div className="flex items-center gap-2 sm:gap-3 mt-0.5">
                                {empresa.nincho && (
                                    <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 capitalize truncate max-w-[80px] sm:max-w-none">
                                        {empresa.nincho}
                                    </span>
                                )}
                                {empresa.cidade && (
                                    <span className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 truncate">
                                        <MapPin className="size-2.5 sm:size-3" />
                                        {empresa.cidade}
                                    </span>
                                )}
                                {totalProdutos > 0 && (
                                    <span className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 shrink-0">
                                        • {totalProdutos} {totalProdutos === 1 ? 'item' : 'itens'}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Badge de fidelidade se ativo - Escondido em telas muito pequenas */}
                        {loyaltyConfig?.ativo && (
                            <div className="hidden xs:flex shrink-0 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 text-[10px] sm:text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-full border border-violet-200 dark:border-violet-800">
                                🌟 <span className="hidden sm:inline ml-1">Fidelidade</span>
                            </div>
                        )}
                    </div>
                </header>

                {/* ── Conteúdo principal ───────────────────────────────────── */}
                <main className="max-w-2xl mx-auto px-4 py-4 sm:py-6">
                    {grouped.length === 0 && compositeProducts.length === 0 ? (
                        /* Estado vazio */
                        <div className="text-center py-20 sm:py-24">
                            <div className="size-16 sm:size-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-5">
                                <UtensilsCrossed className="size-8 sm:size-10 text-slate-300 dark:text-slate-600" />
                            </div>
                            <h2 className="text-base sm:text-lg font-bold text-slate-700 dark:text-white mb-2">
                                Nenhum produto disponível
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                                O cardápio está sendo atualizado. Volte em breve!
                            </p>
                            <div className="flex items-center justify-center gap-1.5 mt-4 text-[10px] sm:text-xs text-slate-400 dark:text-slate-500">
                                <Clock className="size-3 sm:size-3.5" />
                                <span>Atualizado automaticamente</span>
                            </div>
                        </div>
                    ) : (
                        <MenuFilter
                            grouped={grouped}
                            compositeProducts={compositeProducts}
                            upsellProducts={upsellProducts}
                            whatsappNumber={whatsappNumber}
                            empresaNome={empresa.nome}
                            allComposites={compositeProducts}
                            allGroups={allGroups}
                        />
                    )}

                    {/* Footer */}
                    <footer className="text-center pt-8 pb-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500">
                            Cardápio digital por{' '}
                            <span className="font-bold text-violet-500">
                                ZapFlow
                            </span>
                        </p>
                    </footer>
                </main>
            </div>
        </MenuClientWrapper>
    );
}
