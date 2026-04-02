'use server';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';

const EMPRESAS_TABLE_ID = 'mrlxbm1guwn9iv8';
const PRODUCTS_TABLE_ID = 'mu3kfx4zilr5401';
const CATEGORIES_TABLE_ID = 'mv81fy54qtamim2';
const GRUPOS_SLOTS_TABLE_ID = 'momln55c27s3k9j';
const ITENS_BASE_TABLE_ID = 'micgsgj6jtr8i8m';
const ITEM_BASE_INSUMO_TABLE_ID = 'mlfza849t9slguc';
const LOYALTY_CONFIG_TABLE_ID = 'mdgax4hwh9lrnfo';

async function nocoFetch(tableId: string, endpoint: string) {
    const url = `${NOCODB_URL}/api/v2/tables/${tableId}${endpoint}`;
    const res = await fetch(url, {
        headers: { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' },
        cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
}

function toSlug(text: string) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
}

function parseJsonArray(value: any): number[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export async function getPublicMenu(slug: string) {
    console.log('>>> getPublicMenu START for slug:', slug);
    try {
        // Find company by slug
        console.log('>>> Fetching companies...');
        const empresasData = await nocoFetch(EMPRESAS_TABLE_ID, '/records?limit=200');
        console.log('>>> Empresas found:', empresasData?.list?.length);
        if (!empresasData?.list) return null;

        const empresa = empresasData.list.find((e: any) => {
            const nomeSlug = toSlug(e.nome_fantasia || '');
            return nomeSlug === slug || e.slug === slug;
        });

        if (!empresa) return null;

        // 2. Fetch dados em paralelo
        const [productsData, categoriesData, gruposSlotsData, itensBaseData, itemBaseInsumosData] = await Promise.all([
            nocoFetch(PRODUCTS_TABLE_ID, `/records?where=(empresa_id,eq,${empresa.id})&limit=500`),
            nocoFetch(CATEGORIES_TABLE_ID, `/records?where=(empresa_id,eq,${empresa.id})&limit=100`),
            nocoFetch(GRUPOS_SLOTS_TABLE_ID, `/records?limit=1000`),
            nocoFetch(ITENS_BASE_TABLE_ID, `/records?limit=2000`),
            nocoFetch(ITEM_BASE_INSUMO_TABLE_ID, `/records?limit=5000&where=(empresa,eq,${empresa.id})`),
        ]);

        const products = (productsData?.list || []).filter((p: any) => p.disponivel !== false);
        const categories = categoriesData?.list || [];
        
        // Debug: mostra primeiro produto
        if (products.length > 0) {
            console.log('Primeiro produto - grupos:', products[0].grupos);
        }
        
        // Processar grupos_slots
        
        // Processar grupos_slots - filtrar pela empresa
        const gruposSlots = (gruposSlotsData?.list || [])
            .filter((g: any) => Number(g.empresa) === Number(empresa.id))
            .map((g: any) => ({
                id: g.id,
                nome: g.nome,
                descricao: g.descricao,
                tipo: g.tipo || 'fracionado',
                qtd_slots: Number(g.qtd_slots || 2),
                regra_preco: g.regra_preco || 'mais_caro',
                min_slots: Number(g.min_slots || 1),
                max_slots: Number(g.max_slots || 2),
                itens: parseJsonArray(g.itens),
            }));
        console.log('GruposSlots found:', gruposSlots.length, 'for empresa', empresa.id);

        // Processar itens_base
        const itensBaseMap = new Map<number, any>();
        const itensBaseIds = new Set<number>();
        (itensBaseData?.list || []).forEach((item: any) => {
            if (Number(item.empresa) === Number(empresa.id)) {
                itensBaseMap.set(item.id, {
                    id: item.id,
                    nome: item.nome,
                    preco_sugerido: Number(item.preco_sugerido || 0),
                    preco_custo: Number(item.preco_custo || 0),
                });
                itensBaseIds.add(item.id);
            }
        });

        // Processar insumos dos itens base
        const itemBaseInsumosMap = new Map<number, { insumo_id: number; quantidade: number }[]>();
        (itemBaseInsumosData?.list || []).forEach((rel: any) => {
            const itemId = Number(rel.id_item_base);
            if (itensBaseIds.has(itemId)) {
                if (!itemBaseInsumosMap.has(itemId)) {
                    itemBaseInsumosMap.set(itemId, []);
                }
                itemBaseInsumosMap.get(itemId)!.push({
                    insumo_id: Number(rel.id_insumo),
                    quantidade: Number(rel.quantidade_necessaria || 0),
                });
            }
        });

        // 3. Montar produtos com seus grupos de slots
        const productsWithGroups = products.map((p: any) => {
            const gruposVinculados = parseJsonArray(p.grupos);
            console.log('Product', p.id, '- grupos:', p.grupos, '-> parsed:', gruposVinculados);
            
            // Filtrar grupos que estão vinculados ao produto
            const productGroups = gruposSlots
                .filter((g: any) => gruposVinculados.includes(g.id))
                .map((g: any) => {
                    // Buscar itens desse grupo na biblioteca
                    const groupItems = g.itens
                        .map((itemId: number) => itensBaseMap.get(itemId))
                        .filter(Boolean);
                    
                    return {
                        id: g.id,
                        nome: g.nome,
                        minimo: g.min_slots,
                        maximo: g.max_slots,
                        obrigatorio: false,
                        tipo_calculo: g.regra_preco === 'mais_caro' ? 'maior_valor' : g.regra_preco,
                        cobrar_mais_caro: g.regra_preco === 'mais_caro',
                        total_slots: g.qtd_slots,
                        items: groupItems.map((item: any) => ({
                            id: item.id,
                            nome: item.nome,
                            preco: item.preco_sugerido,
                            fator_proporcao: 1,
                        })),
                    };
                });

            return { 
                ...p, 
                id: p.id, 
                complementGroups: productGroups 
            };
        });

        // 4. Agrupar produtos por categoria
        const grouped = categories
            .map((cat: any) => ({
                id: cat.id,
                name: cat.nome,
                products: productsWithGroups.filter((p: any) => String(p.categoria_id) === String(cat.id)),
            }))
            .filter((g: any) => g.products.length > 0);

        // Produtos sem categoria
        const uncategorized = productsWithGroups.filter(
            (p: any) => !categories.find((c: any) => String(c.id) === String(p.categoria_id))
        );
        if (uncategorized.length > 0) {
            grouped.push({ id: 0, name: 'Outros', products: uncategorized });
        }

        // 5. Montar produtos compostos (grupos de slots do tipo fracionado)
        const compositeProducts = gruposSlots
            .filter((g: any) => g.tipo === 'fracionado' && g.itens.length > 0)
            .map((g: any) => {
                const items = g.itens
                    .map((itemId: number) => {
                        const itemBase = itensBaseMap.get(itemId);
                        if (!itemBase) return null;
                        const insumos = itemBaseInsumosMap.get(itemId) || [];
                        return {
                            id: itemBase.id,
                            nome: itemBase.nome,
                            preco: itemBase.preco_sugerido,
                            descricao: '',
                            imagem: '',
                            fator_proporcao: 1,
                            grupo_id: g.id,
                            insumos, // Array de { insumo_id, quantidade }
                        };
                    })
                    .filter(Boolean);

                return {
                    id: `composite-${g.id}`,
                    _grupoId: g.id,
                    _isComposite: true,
                    nome: g.nome,
                    descricao: g.descricao || '',
                    imagem: '',
                    tipo_calculo: g.regra_preco === 'mais_caro' ? 'maior_valor' : g.regra_preco,
                    cobrar_mais_caro: g.regra_preco === 'mais_caro',
                    minimo: g.min_slots,
                    maximo: g.max_slots,
                    items,
                };
            });

        // 6. Buscar configuração de fidelidade
        const loyaltyData = await nocoFetch(LOYALTY_CONFIG_TABLE_ID, `/records?where=(empresa_id,eq,${empresa.id})`);
        const loyaltyConfig = loyaltyData?.list?.[0] || null;

        // 7. Buscar produtos para upsell (bebidas, sobremesas e complementos baratos)
        // Identifica categorias que contenham palavras como "bebida", "refrigerante", "suco", "sobremesa", "doce", "adicional"
        const upsellKeywords = ['bebida', 'refrigerante', 'suco', 'soda', 'cerveja', 'água', 'sobremesa', 'doce', 'brownie', 'petit', 'adicional', 'extra'];
        const upsellProducts = productsWithGroups
            .filter((p: any) => {
                const nome = (p.nome || '').toLowerCase();
                const catName = categories.find((c: any) => String(c.id) === String(p.categoria_id))?.nome?.toLowerCase() || '';
                return upsellKeywords.some(kw => nome.includes(kw) || catName.includes(kw));
            })
            .slice(0, 5) // Limitar a 5 sugestões
            .map((p: any) => ({
                id: p.id,
                nome: p.nome,
                preco: Number(p.preco || 0),
                imagem: p.imagem || null,
                descricao: p.descricao || '',
            }));

        return {
            empresa: {
                id: empresa.id,
                nome: empresa.nome_fantasia,
                telefone: empresa.telefone || empresa.login || '',
                nincho: empresa.nincho || '',
            },
            grouped,
            compositeProducts,
            upsellProducts,
            loyaltyConfig: loyaltyConfig ? {
                pontos_por_real: Number(loyaltyConfig.pontos_por_real || 1),
                ativo: loyaltyConfig.ativo === true || loyaltyConfig.ativo === 1,
            } : null,
            slug,
        };
    } catch (err) {
        console.error('getPublicMenu error:', err);
        console.log('Slug:', slug);
        return null;
    }
}