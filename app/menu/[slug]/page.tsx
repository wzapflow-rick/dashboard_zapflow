import { getPublicMenu } from '@/app/actions/public-menu';
import { UtensilsCrossed, MapPin, AlertCircle, Clock } from 'lucide-react';
import MenuClientWrapper from '@/components/menu/menu-client-wrapper';
import MenuFilter from '@/components/menu/menu-filter';
import type { Metadata } from 'next';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

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
    
    let data = null;
    let errorDetail = null;
    
    try {
        data = await getPublicMenu(slug);
    } catch (e: any) {
        errorDetail = e.message || 'Erro desconhecido na conexão';
    }

    if (!data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4">
                <div className="text-center p-8 max-w-sm bg-[#1a1a1a] rounded-3xl shadow-xl border border-[#2a2a2a]">
                    <div className="size-20 rounded-2xl bg-red-900/20 flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="size-10 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">
                        Cardapio Indisponivel
                    </h1>
                    <p className="text-gray-400 text-sm leading-relaxed mb-6">
                        Nao conseguimos localizar as informacoes da loja.
                    </p>
                    <div className="mt-6 pt-6 border-t border-[#2a2a2a] text-left">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Diagnostico:</p>
                        <div className="bg-[#0a0a0a] p-3 rounded-lg font-mono text-[10px] text-gray-500 break-all">
                            <p>Slug: {slug}</p>
                            <p>Status: {errorDetail ? 'Falha na API' : 'Empresa nao encontrada'}</p>
                            {errorDetail && <p className="text-red-500 mt-1">Erro: {errorDetail}</p>}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Verificar se empresa esta bloqueada (sem plano pago)
    if ('blocked' in data && data.blocked) {
        const empresaInfo = data.empresa as { nome?: string; logo?: string };
        const nomeLoja = empresaInfo?.nome || 'Esta loja';
        const logoLoja = empresaInfo?.logo;
        const inicialLoja = nomeLoja.charAt(0).toUpperCase();
        
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4">
                <div className="text-center p-8 max-w-md bg-[#1a1a1a] rounded-3xl shadow-xl border border-[#2a2a2a]">
                    {/* Logo da loja */}
                    <div 
                        className="size-24 rounded-2xl flex items-center justify-center mx-auto mb-6 overflow-hidden border-4 border-[#2a2a2a]"
                        style={{ background: logoLoja ? '#0a0a0a' : 'linear-gradient(135deg, #22c55e, #16a34a)' }}
                    >
                        {logoLoja ? (
                            <Image src={logoLoja} alt={nomeLoja} width={96} height={96} className="size-full object-cover" />
                        ) : (
                            <span className="text-white font-bold text-3xl">{inicialLoja}</span>
                        )}
                    </div>
                    
                    <div className="size-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-6">
                        <Clock className="size-8 text-amber-500" />
                    </div>
                    
                    <h1 className="text-2xl font-bold text-white mb-3">
                        Cardapio em Configuracao
                    </h1>
                    <p className="text-gray-400 text-sm leading-relaxed mb-6">
                        <span className="font-semibold text-white">{nomeLoja}</span> esta finalizando a configuracao do cardapio digital. Em breve estara disponivel para voce!
                    </p>
                    
                    <div className="bg-[#0a0a0a] rounded-2xl p-4 border border-[#2a2a2a]">
                        <p className="text-xs text-gray-500 mb-2">Enquanto isso, entre em contato:</p>
                        <a 
                            href="https://wzapflow.com.br" 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors"
                        >
                            Conheca o ZapFlow
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    const { empresa, grouped, compositeProducts, upsellProducts, loyaltyConfig, allGroups } = data;

    const empresaNome = String(empresa.nome || 'ZapFlow');
    const empresaBanner = typeof empresa.banner === 'string' ? empresa.banner : null;
    const empresaLogo = typeof empresa.logo === 'string' ? empresa.logo : null;
    const empresaNincho = typeof empresa.nincho === 'string' ? empresa.nincho : null;
    const empresaCidade = typeof empresa.cidade === 'string' ? empresa.cidade : null;
    const empresaEstado = typeof empresa.estado === 'string' ? empresa.estado : null;
    
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

    return (
        <MenuClientWrapper
            whatsappNumber={whatsappNumber}
            empresaNome={empresaNome}
            empresaId={empresaId}
            empresaCidade={empresaCidade}
            empresaEstado={empresaEstado}
            pontosPorReal={pontosPorReal}
            upsellProducts={safeUpsell}
        >
            <div className="min-h-screen bg-[#0a0a0a] pb-32">
                {/* Header */}
                <header>
                    {/* Banner com Logo sobreposta */}
                    <div className="relative">
                        {/* Banner Image */}
                        <div className="h-44 sm:h-56 bg-[#1a1a1a] relative overflow-hidden">
                            {empresaBanner ? (
                                <>
                                    <Image 
                                        src={empresaBanner} 
                                        alt={`Banner de ${empresaNome}`} 
                                        fill 
                                        className="object-cover" 
                                        priority 
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/50 to-transparent" />
                                </>
                            ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a]" />
                            )}
                        </div>
                        
                        {/* Logo - Posicionada para sobrepor o banner */}
                        <div className="flex justify-center -mt-12 relative z-10">
                            <div
                                className="size-24 sm:size-28 rounded-2xl flex items-center justify-center text-white font-bold text-3xl sm:text-4xl shadow-2xl border-4 border-[#0a0a0a] overflow-hidden"
                                style={{ background: empresaLogo ? '#1a1a1a' : 'linear-gradient(135deg, #22c55e, #16a34a)' }}
                            >
                                {empresaLogo ? (
                                    <Image src={empresaLogo} alt={empresaNome} width={112} height={112} className="size-full object-cover" />
                                ) : (
                                    <span>{inicial}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Info da empresa */}
                    <div className="max-w-2xl mx-auto px-4 pt-4 pb-6 text-center">
                        <h1 className="font-black text-2xl sm:text-3xl text-white leading-tight mb-4 uppercase tracking-tight">
                            {empresaNome}
                        </h1>
                        
                        {/* Tags */}
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            {empresaNincho && (
                                <span className="text-xs text-gray-300 font-medium bg-[#1a1a1a] px-3 py-1.5 rounded-full border border-[#2a2a2a]">
                                    {empresaNincho}
                                </span>
                            )}
                            {empresaCidade && (
                                <span className="flex items-center gap-1.5 text-xs text-gray-300 font-medium bg-[#1a1a1a] px-3 py-1.5 rounded-full border border-[#2a2a2a]">
                                    <MapPin className="size-3" />
                                    {empresaCidade}
                                </span>
                            )}
                            <span className="flex items-center gap-1.5 text-xs text-[#22c55e] font-semibold bg-[#22c55e]/10 px-3 py-1.5 rounded-full border border-[#22c55e]/20">
                                <Clock className="size-3" />
                                Aberto agora
                            </span>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="max-w-2xl mx-auto px-4 py-4">
                    {safeGrouped.length === 0 && safeComposites.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="size-16 rounded-2xl bg-[#1a1a1a] flex items-center justify-center mx-auto mb-5 border border-[#2a2a2a]">
                                <UtensilsCrossed className="size-8 text-gray-600" />
                            </div>
                            <h2 className="text-lg font-bold text-white mb-2">Nenhum produto disponível</h2>
                            <p className="text-sm text-gray-500">O cardápio está sendo atualizado.</p>
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
                    
                    <footer className="text-center pt-12 pb-6 mt-8 border-t border-[#1a1a1a]">
                        <p className="text-xs text-gray-600">
                            Cardápio digital por <span className="font-bold text-[#22c55e]">ZapFlow</span>
                        </p>
                    </footer>
                </main>
            </div>
        </MenuClientWrapper>
    );
}
