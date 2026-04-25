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

                {/* ── Header Premium com Banner Personalizado ──────────────────────────────────────────── */}
                <header className="relative bg-white dark:bg-slate-900 rounded-b-3xl shadow-lg overflow-hidden">
                    {/* Banner de fundo com gradiente suave ou imagem personalizada */}
                    <div className="relative h-48 sm:h-64 bg-gradient-to-br from-violet-400/40 via-purple-400/30 to-indigo-400/40 dark:from-violet-600/30 dark:via-purple-600/20 dark:to-indigo-600/30 overflow-hidden">
                        {/* Se houver banner personalizado, exibir */}
                        {empresa.banner ? (
                            <Image 
                                src={empresa.banner} 
                                alt={`Banner de ${empresa.nome}`}
                                fill
                                className="object-cover"
                                priority
                            />
                        ) : null}
                        
                        {/* Padrão decorativo suave de fundo (só aparece se não houver banner) */}
                        {!empresa.banner && (
                            <div className="absolute inset-0 opacity-30">
                                <div className="absolute top-0 right-0 w-96 h-96 bg-violet-300 rounded-full mix-blend-multiply filter blur-3xl dark:opacity-20"></div>
                                <div className="absolute -bottom-8 left-20 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl dark:opacity-20"></div>
                            </div>
                        )}
                        
                        {/* Overlay suave para melhorar legibilidade do texto */}
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/20 dark:to-slate-900/40"></div>
                    </div>

                    {/* Conteúdo do header com logo flutuante */}
                    <div className="max-w-2xl mx-auto px-4 pb-6 sm:pb-8">
                        <div className="relative flex flex-col items-center sm:items-start text-center sm:text-left">
                            {/* Logo flutuante com efeito de vidro */}
                            <div
                                className="size-32 sm:size-40 rounded-full flex items-center justify-center text-white font-bold text-5xl sm:text-7xl shrink-0 shadow-2xl border-4 border-white dark:border-slate-800 bg-white dark:bg-slate-800 overflow-hidden -mt-16 sm:-mt-20 transition-transform hover:scale-105 z-10 backdrop-blur-sm"
                                style={!empresa.logo ? { background: 'linear-gradient(135deg, #a78bfa, #c084fc)' } : { background: 'white' }}
                                aria-hidden="true"
                            >
                                {empresa.logo ? (
                                    <Image 
                                        src={empresa.logo} 
                                        alt={empresa.nome} 
                                        width={160} 
                                        height={160} 
                                        className="size-full object-cover"
                                    />
                                ) : (
                                    <span style={{ color: '#a78bfa' }}>{inicial}</span>
                                )}
                            </div>

                            {/* Info da empresa */}
                            <div className="mt-5 sm:mt-7 w-full">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <h1 className="font-black text-4xl sm:text-6xl text-slate-900 dark:text-white leading-tight mb-4">
                                            {empresa.nome}
                                        </h1>
                                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3">
                                            {empresa.nincho && (
                                                <span className="text-[11px] sm:text-sm text-slate-700 dark:text-slate-200 capitalize font-semibold bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm px-4 py-2 rounded-full border border-white/40 dark:border-slate-700/40 shadow-sm">
                                                    🏪 {empresa.nincho}
                                                </span>
                                            )}
                                            {empresa.cidade && (
                                                <span className="flex items-center gap-1.5 text-[11px] sm:text-sm text-slate-700 dark:text-slate-200 font-semibold bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm px-4 py-2 rounded-full border border-white/40 dark:border-slate-700/40 shadow-sm">
                                                    <MapPin className="size-3.5 sm:size-4" />
                                                    {empresa.cidade}
                                                </span>
                                            )}
                                            {totalProdutos > 0 && (
                                                <span className="text-[11px] sm:text-sm text-slate-700 dark:text-slate-200 font-semibold bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm px-4 py-2 rounded-full border border-white/40 dark:border-slate-700/40 shadow-sm">
                                                    📦 {totalProdutos} {totalProdutos === 1 ? 'item' : 'itens'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Badge de fidelidade se ativo */}
                                    {loyaltyConfig?.ativo && (
                                        <div className="self-center sm:self-end shrink-0 bg-gradient-to-r from-amber-300 to-orange-400 text-slate-900 text-xs sm:text-sm font-black px-6 py-3 rounded-full shadow-lg shadow-orange-400/30 border-2 border-white dark:border-slate-900 animate-pulse">
                                            🌟 Fidelidade
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
