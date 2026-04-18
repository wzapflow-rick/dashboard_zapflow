'use server';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';

const EMPRESAS_TABLE_ID = 'mp08yd7oaxn5xo2';
const PRODUCTS_TABLE_ID = 'mh81t2xp1uml6pc';
const CATEGORIES_TABLE_ID = 'mo5so5g7gvlbwyo';
const GRUPOS_SLOTS_TABLE_ID = 'm1h9jeye8hcd4k6';
const ITENS_BASE_TABLE_ID = 'mfcp67skbxq4nt5';
const ITEM_BASE_INSUMO_TABLE_ID = 'mev9fkmt1jaapiv';
const LOYALTY_CONFIG_TABLE_ID = 'mjzzdfgdohupgjh';

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
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            // Tentar parsear como string de números separados por vírgula
            return value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        }
    }
    return [];
}

export async function getPublicMenu(slug: string) {
    console.log('>>> getPublicMenu START for slug:', slug);
    try {
        // Find company by slug
        const empresasData = await nocoFetch(EMPRESAS_TABLE_ID, '/records?limit=200');
        if (!empresasData?.list) return null;

        const empresa = empresasData.list.find((e: any) => {
            const slugMatch = (e.slug || '').toLowerCase() === slug.toLowerCase();
            const ninchoMatch = (e.nincho || '').toLowerCase() === slug.toLowerCase();
            const nomeMatch = (e.nome_fantasia || '').toLowerCase() === slug.toLowerCase();
            const slugFromNome = toSlug(e.nome_fantasia || '') === slug.toLowerCase();
            return slugMatch || ninchoMatch || nomeMatch || slugFromNome;
        });

        if (!empresa) return null;

        const controleEstoque = empresa.controle_estoque === true || empresa.controle_estoque === 1 || empresa.controle_estoque === '1';

        const [productsData, categoriesData, gruposSlotsData, itensBaseData, itemBaseInsumosData] = await Promise.all([
            nocoFetch(PRODUCTS_TABLE_ID, `/records?where=(empresa_id,eq,${empresa.id})&limit=500`),
            nocoFetch(CATEGORIES_TABLE_ID, `/records?where=(empresa_id,eq,${empresa.id})&limit=100`),
            nocoFetch(GRUPOS_SLOTS_TABLE_ID, `/records?limit=1000`),
            nocoFetch(ITENS_BASE_TABLE_ID, `/records?limit=2000`),
            nocoFetch(ITEM_BASE_INSUMO_TABLE_ID, `/records?limit=5000&where=(empresa_id,eq,${empresa.id})`),
        ]);

        const products = controleEstoque 
            ? (productsData?.list || []).filter((p: any) => p.disponivel !== false)
            : productsData?.list || [];
        
        if (products.length > 0) {
            console.log('[DEBUG] Estrutura bruta do primeiro produto:', JSON.stringify(products[0], null, 2));
        }

        const categories = categoriesData?.list || [];
        
        // Processar grupos_slots
        const gruposSlots = (gruposSlotsData?.list || [])
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
                modo_preco: g.modo_preco || 'por_item',
                preco_fixo: Number(g.preco_fixo || 0),
                completamentos_ids: parseJsonArray(g.completamentos_ids),
            }));

        const itensBaseMap = new Map<number, any>();
        (itensBaseData?.list || []).forEach((item: any) => {
            itensBaseMap.set(item.id, {
                id: item.id,
                nome: item.nome,
                preco_sugerido: Number(item.preco_sugerido || 0),
                preco_custo: Number(item.preco_custo || 0),
            });
        });

        // Mapear todos os grupos por ID para facilitar busca de adicionais vinculados
        const gruposMap = new Map<number, any>();
        gruposSlots.forEach(g => {
            const groupItems = g.itens
                .map((itemId: number) => itensBaseMap.get(itemId))
                .filter(Boolean)
                .map((item: any) => ({
                    id: item.id,
                    nome: item.nome,
                    preco: item.preco_sugerido,
                    fator_proporcao: 1,
                }));

            gruposMap.set(g.id, {
                id: g.id,
                nome: g.nome,
                tipo: g.tipo,
                minimo: g.min_slots,
                maximo: g.max_slots,
                obrigatorio: false,
                tipo_calculo: g.modo_preco === 'fixo' ? 'fixo' : (g.regra_preco === 'mais_caro' ? 'maior_valor' : g.regra_preco),
                cobrar_mais_caro: g.regra_preco === 'mais_caro',
                total_slots: g.qtd_slots,
                preco_fixo: g.modo_preco === 'fixo' ? g.preco_fixo : 0,
                completamentos_ids: g.completamentos_ids || [],
                items: groupItems,
            });
        });

        // Montar produtos simples
        const productsWithGroups = products.map((p: any) => {
            const gruposVinculados = parseJsonArray(p.grupos);
            console.log(`[DEBUG] Produto: ${p.nome}, Grupos Vinculados:`, gruposVinculados);
            
            // Separar grupos de sabor (fracionado) e adicionais vinculados
            const saborGroups: any[] = [];
            const additionalGroups: any[] = [];

            gruposVinculados.forEach((grupoId: number) => {
                const g = gruposMap.get(grupoId);
                if (g) {
                    if (g.tipo === 'fracionado') {
                        saborGroups.push(g);
                    } else {
                        // Qualquer grupo que não seja fracionado entra como adicional no Passo 2
                        if (!additionalGroups.find(ag => ag.id === g.id)) {
                            additionalGroups.push(g);
                        }
                    }

                    // Se o grupo tem adicionais vinculados (completamentos), adicioná-los também
                    if (g.completamentos_ids && g.completamentos_ids.length > 0) {
                        g.completamentos_ids.forEach((compId: number) => {
                            const compGroup = gruposMap.get(compId);
                            if (compGroup && !additionalGroups.find(ag => ag.id === compGroup.id)) {
                                additionalGroups.push(compGroup);
                            }
                        });
                    }
                } else {
                    console.log(`[DEBUG] Grupo ID ${grupoId} não encontrado no gruposMap`);
                }
            });

            console.log(`[DEBUG] Produto: ${p.nome}, saborGroups: ${saborGroups.length}, additionalGroups: ${additionalGroups.length}`);

            return { 
                ...p, 
                id: p.id, 
                saborGroups,
                additionalGroups,
                // Manter compatibilidade se necessário
                complementGroups: [...saborGroups, ...additionalGroups]
            };
        });

        // Agrupar por categoria
        const grouped = categories
            .map((cat: any) => ({
                id: cat.id,
                name: cat.nome,
                products: productsWithGroups.filter((p: any) => String(p.categoria_id) === String(cat.id)),
            }))
            .filter((g: any) => g.products.length > 0);

        const uncategorized = productsWithGroups.filter(
            (p: any) => !categories.find((c: any) => String(c.id) === String(p.categoria_id))
        );
        if (uncategorized.length > 0) {
            grouped.push({ id: 0, name: 'Outros', products: uncategorized });
        }

        // Produtos compostos (fracionados)
        const compositeProducts = gruposSlots
            .filter((g: any) => g.tipo === 'fracionado' && g.itens && g.itens.length > 0)
            .map((g: any) => {
                const groupData = gruposMap.get(g.id);
                return {
                    id: `composite-${g.id}`,
                    _grupoId: g.id,
                    _isComposite: true,
                    _tipo: g.tipo,
                    nome: g.nome,
                    descricao: g.descricao || '',
                    imagem: '',
                    tipo_calculo: groupData.tipo_calculo,
                    cobrar_mais_caro: groupData.cobrar_mais_caro,
                    minimo: groupData.minimo,
                    maximo: groupData.maximo,
                    preco_fixo: groupData.preco_fixo,
                    completamentos_ids: groupData.completamentos_ids,
                    items: groupData.items,
                };
            });

        const loyaltyData = await nocoFetch(LOYALTY_CONFIG_TABLE_ID, `/records?where=(empresa_id,eq,${empresa.id})`);
        const loyaltyConfig = loyaltyData?.list?.[0] || {
            empresa_id: empresa.id,
            pontos_por_real: 1,
            valor_ponto: 0.10,
            pontos_para_desconto: 100,
            desconto_tipo: 'valor_fixo',
            desconto_valor: 10,
            ativo: false,
        };

        // Upsell (lógica simplificada)
        const upsellProducts = productsWithGroups.filter((p: any) => {
            const nome = (p.nome || '').toLowerCase();
            return nome.includes('coca') || nome.includes('suco') || nome.includes('agua') || nome.includes('sobremesa');
        }).slice(0, 4);

        return {
            empresa: {
                id: empresa.id,
                nome: empresa.nome_fantasia,
                telefone: empresa.telefone,
                nincho: empresa.nincho,
                slug: empresa.slug,
            },
            grouped,
            compositeProducts,
            upsellProducts,
            loyaltyConfig,
            allGroups: Array.from(gruposMap.values()),
        };
    } catch (error) {
        console.error('>>> getPublicMenu ERROR:', error);
        return null;
    }
}
