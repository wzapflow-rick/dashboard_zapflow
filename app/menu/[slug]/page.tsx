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
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors pb-24">

                {/* ── Header Premium com Banner ──────────────────────────────────────────── */}
                <header className="relative bg-white dark:bg-slate-900">
                    {/* Banner de fundo com gradiente */}
                    <div className="relative h-40 sm:h-52 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 dark:from-violet-800 dark:via-purple-800 dark:to-indigo-950 overflow-hidden">
                        {/* Padrão decorativo de fundo */}
                        <div className="absolute inset-0 opacity-20">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full mix-blend-overlay filter blur-3xl"></div>
                            <div className="absolute -bottom-8 left-20 w-64 h-64 bg-white rounded-full mix-blend-overlay filter blur-3xl"></div>
                        </div>
                    </div>

                    {/* Conteúdo do header com logo flutuante */}
                    <div className="max-w-2xl mx-auto px-4 pb-8 sm:pb-10">
                        <div className="relative flex flex-col items-center sm:items-start text-center sm:text-left">
                            {/* Logo flutuante centralizada no mobile e esquerda no desktop */}
                            <div
                                className="size-28 sm:size-36 rounded-3xl flex items-center justify-center text-white font-bold text-4xl sm:text-6xl shrink-0 shadow-2xl border-4 border-white dark:border-slate-900 bg-white dark:bg-slate-800 overflow-hidden -mt-14 sm:-mt-18 transition-transform hover:scale-105 z-10"
                                style={!empresa.logo ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' } : { background: 'white' }}
                                aria-hidden="true"
                            >
                                {empresa.logo ? (
                                    <Image 
                                        src={empresa.logo} 
                                        alt={empresa.nome} 
                                        width={144} 
                                        height={144} 
                                        className="size-full object-cover"
                                    />
                                ) : (
                                    <span style={{ color: '#6366f1' }}>{inicial}</span>
                                )}
                            </div>

                            {/* Info da empresa */}
                            <div className="mt-4 sm:mt-6 w-full">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <h1 className="font-black text-3xl sm:text-5xl text-slate-900 dark:text-white leading-tight mb-3">
                                            {empresa.nome}
                                        </h1>
                                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3">
                                            {empresa.nincho && (
                                                <span className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-300 capitalize font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
                                                    🏪 {empresa.nincho}
                                                </span>
                                            )}
                                            {empresa.cidade && (
                                                <span className="flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-600 dark:text-slate-300 font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
                                                    <MapPin className="size-3 sm:size-3.5" />
                                                    {empresa.cidade}
                                                </span>
                                            )}
                                            {totalProdutos > 0 && (
                                                <span className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-300 font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
                                                    📦 {totalProdutos} {totalProdutos === 1 ? 'item' : 'itens'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Badge de fidelidade se ativo */}
                                    {loyaltyConfig?.ativo && (
                                        <div className="self-center sm:self-end shrink-0 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs sm:text-sm font-black px-5 py-2.5 rounded-2xl shadow-lg shadow-orange-500/20 border-2 border-white dark:border-slate-900 animate-bounce-slow">
                                            🌟 Fidelidade Ativo
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* ── Conteúdo principal ───────────────────────────────────── */}
                <main className="max-w-2xl mx-auto px-4 py-6">
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
                    <footer className="text-center pt-12 pb-6 mt-8 border-t border-slate-200 dark:border-slate-800">
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
