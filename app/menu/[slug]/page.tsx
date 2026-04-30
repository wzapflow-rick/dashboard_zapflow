import { getPublicMenu } from '@/app/actions/public-menu';
import { UtensilsCrossed, MapPin, AlertCircle } from 'lucide-react';
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
    try {
        const data = await getPublicMenu(slug);
        if (!data) return { title: 'Cardápio não encontrado' };
        const { empresa } = data;
        const logoUrl = typeof empresa.logo === 'string' ? empresa.logo : undefined;
        const nomeEmpresa = typeof empresa.nome === 'string' ? empresa.nome : 'ZapFlow';
        return {
            title: `Cardápio — ${nomeEmpresa}`,
            description: `Veja o cardápio completo de ${nomeEmpresa}. Peça agora pelo WhatsApp!`,
            openGraph: {
                title: `Cardápio — ${nomeEmpresa}`,
                description: `Peça agora pelo WhatsApp!`,
                images: logoUrl ? [logoUrl] : [],
            },
        };
    } catch {
        return { title: 'Erro no Cardápio' };
    }
}

export default async function PublicMenuPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    
    // Capturar erro técnico para diagnóstico
    let data = null;
    let errorDetail = null;
    
    try {
        data = await getPublicMenu(slug);
    } catch (e: any) {
        errorDetail = e.message || 'Erro desconhecido na conexão';
    }

    // ── Estado de erro: empresa não encontrada ────────────────────────────────
    if (!data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
                <div className="text-center p-8 max-w-sm bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700">
                    <div className="size-20 rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="size-10 text-rose-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                        Cardápio Indisponível
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
                        Não conseguimos localizar as informações da loja. Isso pode ser um problema temporário de conexão.
                    </p>
                    
                    {/* Painel de Diagnóstico para o Riquelmo */}
                    <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700 text-left">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Diagnóstico Técnico:</p>
                        <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg font-mono text-[10px] text-slate-600 dark:text-slate-400 break-all">
                            <p>Slug: {slug}</p>
                            <p>Status: {errorDetail ? 'Falha na API' : 'Empresa não encontrada no banco'}</p>
                            {errorDetail && <p className="text-rose-500 mt-1">Erro: {errorDetail}</p>}
                        </div>
                        <p className="mt-4 text-[10px] text-slate-400 leading-tight">
                            Verifique se as variáveis NOCODB_URL e NOCODB_TOKEN estão configuradas no Vercel.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const { empresa, grouped, compositeProducts, upsellProducts, loyaltyConfig, allGroups } = data;

    // ── Extração Segura de Dados ──────────────────
    const empresaNome = String(empresa.nome || 'ZapFlow');
    const empresaBanner = typeof empresa.banner === 'string' ? empresa.banner : null;
    const empresaLogo = typeof empresa.logo === 'string' ? empresa.logo : null;
    const empresaNincho = typeof empresa.nincho === 'string' ? empresa.nincho : null;
    const empresaCidade = typeof empresa.cidade === 'string' ? empresa.cidade : null;
    
    let empresaId: number | undefined = undefined;
    if (typeof empresa.id === 'number') empresaId = empresa.id;
    else if (typeof empresa.id === 'string') empresaId = parseInt(empresa.id, 10);
    
    const rawTelefone = typeof empresa.telefone === 'string' ? empresa.telefone : '';
    const whatsappNumber = rawTelefone.replace(/\D/g, '');
    const pontosPorReal = loyaltyConfig?.ativo ? Number(loyaltyConfig.pontos_por_real || 1) : 0;
    const inicial = empresaNome.charAt(0).toUpperCase();
    
    const transformComposite = (p: any) => ({
        ...p,
        id: String(p.id),
        _grupoId: Number(p.id), 
        _isComposite: true as const,
        nome: String(p.nome || ''),
        descricao: String(p.descricao || ''),
        imagem: String(p.imagem || ''),
        minimo: Number(p.minimo || 1),
        maximo: Number(p.maximo || 1),
        items: Array.isArray(p.items) ? p.items : [],
        preco_fixo: Number(p.preco || 0),
        tipo_calculo: String(p.tipo_calculo || 'fixo')
    });

    const safeGrouped = (grouped || []).map((cat: any) => ({
        ...cat,
        name: String(cat.nome || cat.name || 'Categoria'),
        products: Array.isArray(cat.products) ? cat.products : [],
        compositeProducts: Array.isArray(cat.compositeProducts) 
            ? cat.compositeProducts.map(transformComposite)
            : []
    }));

    const safeComposites = (compositeProducts || []).map(transformComposite);
    const safeUpsell = Array.isArray(upsellProducts) ? upsellProducts : [];
    const safeAllGroups = Array.isArray(allGroups) ? allGroups : [];
    const totalProdutos = safeGrouped.reduce((acc: number, cat: any) => acc + (cat.products?.length || 0) + (cat.compositeProducts?.length || 0), 0);

    return (
        <MenuClientWrapper
            whatsappNumber={whatsappNumber}
            empresaNome={empresaNome}
            empresaId={empresaId}
            pontosPorReal={pontosPorReal}
            upsellProducts={safeUpsell}
        >
            <div className="min-h-screen bg-slate-50 dark:bg-[#1a0f2e] transition-colors pb-24">
                <header className="relative bg-white dark:bg-[#2d1b4e] rounded-b-3xl shadow-lg overflow-hidden">
                    <div className="relative h-48 sm:h-64 bg-gradient-to-br from-violet-400/40 via-purple-400/30 to-indigo-400/40 dark:from-purple-700/50 dark:via-purple-600/40 dark:to-indigo-700/40 overflow-hidden">
                        {empresaBanner ? (
                            <Image src={empresaBanner} alt={`Banner de ${empresaNome}`} fill className="object-cover" priority />
                        ) : (
                            <div className="absolute inset-0 opacity-30">
                                <div className="absolute top-0 right-0 w-96 h-96 bg-violet-300 rounded-full mix-blend-multiply filter blur-3xl dark:opacity-20"></div>
                                <div className="absolute -bottom-8 left-20 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl dark:opacity-20"></div>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/20 dark:to-slate-900/40"></div>
                    </div>

                    <div className="max-w-2xl mx-auto px-4 pb-6 sm:pb-8">
                        <div className="relative flex flex-col items-center sm:items-start text-center sm:text-left">
                            <div
                                className="size-32 sm:size-40 rounded-full flex items-center justify-center text-white font-bold text-5xl sm:text-7xl shrink-0 shadow-2xl border-4 border-white dark:border-slate-800 bg-white dark:bg-slate-800 overflow-hidden -mt-16 sm:-mt-20 transition-transform hover:scale-105 z-10 backdrop-blur-sm"
                                style={!empresaLogo ? { background: 'linear-gradient(135deg, #a78bfa, #c084fc)' } : { background: 'white' }}
                            >
                                {empresaLogo ? (
                                    <Image src={empresaLogo} alt={empresaNome} width={160} height={160} className="size-full object-cover" />
                                ) : (
                                    <span style={{ color: '#a78bfa' }}>{inicial}</span>
                                )}
                            </div>

                            <div className="mt-5 sm:mt-7 w-full">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <h1 className="font-black text-4xl sm:text-6xl text-slate-900 dark:text-white leading-tight mb-4">
                                            {empresaNome}
                                        </h1>
                                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3">
                                            {empresaNincho && (
                                                <span className="text-[11px] sm:text-sm text-slate-700 dark:text-slate-200 capitalize font-semibold bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm px-4 py-2 rounded-full border border-white/40 dark:border-slate-700/40 shadow-sm">
                                                    🏪 {empresaNincho}
                                                </span>
                                            )}
                                            {empresaCidade && (
                                                <span className="flex items-center gap-1.5 text-[11px] sm:text-sm text-slate-700 dark:text-slate-200 font-semibold bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm px-4 py-2 rounded-full border border-white/40 dark:border-slate-700/40 shadow-sm">
                                                    <MapPin className="size-3.5 sm:size-4" />
                                                    {empresaCidade}
                                                </span>
                                            )}
                                            {totalProdutos > 0 && (
                                                <span className="text-[11px] sm:text-sm text-slate-700 dark:text-slate-200 font-semibold bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm px-4 py-2 rounded-full border border-white/40 dark:border-slate-700/40 shadow-sm">
                                                    📦 {totalProdutos} {totalProdutos === 1 ? 'item' : 'itens'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="max-w-2xl mx-auto px-4 py-6">
                    {safeGrouped.length === 0 && safeComposites.length === 0 ? (
                        <div className="text-center py-20 sm:py-24">
                            <div className="size-16 sm:size-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-5">
                                <UtensilsCrossed className="size-8 sm:size-10 text-slate-300 dark:text-slate-600" />
                            </div>
                            <h2 className="text-base sm:text-lg font-bold text-slate-700 dark:text-white mb-2">Nenhum produto disponível</h2>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">O cardápio está sendo atualizado. Volte em breve!</p>
                        </div>
                    ) : (
                        <MenuFilter
                            grouped={safeGrouped}
                            compositeProducts={safeComposites}
                            upsellProducts={safeUpsell}
                            whatsappNumber={whatsappNumber}
                            empresaNome={empresaNome}
                            allComposites={safeComposites}
                            allGroups={safeAllGroups}
                        />
                    )}
                    <footer className="text-center pt-12 pb-6 mt-8 border-t border-slate-200 dark:border-slate-800">
                        <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500">Cardápio digital por <span className="font-bold text-violet-500">ZapFlow</span></p>
                    </footer>
                </main>
            </div>
        </MenuClientWrapper>
    );
}
