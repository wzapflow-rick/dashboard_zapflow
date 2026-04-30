import { noco } from '@/lib/nocodb';
import { 
    PRODUTOS_TABLE_ID, 
    CATEGORIAS_TABLE_ID, 
    GRUPOS_COMPLEMENTOS_TABLE_ID, 
    COMPLEMENTOS_TABLE_ID, 
    EMPRESAS_TABLE_ID, 
    CONFIGURACOES_LOJA_TABLE_ID, 
    LOYALTY_CONFIG_TABLE_ID 
} from '@/lib/constants';

export async function getPublicMenu(slug: string) {
    console.log(`[MENU_DEBUG] Iniciando busca para slug: ${slug}`);
    
    try {
        // 1. BUSCA DA EMPRESA COM FALLBACK TOTAL
        let empresa: any = null;

        // Tentativa 1: Por nome_fantasia (o campo que vimos no banco)
        const possibleName = slug.replace(/-/g, ' ');
        console.log(`[MENU_DEBUG] Tentando nome_fantasia: ${possibleName}`);
        empresa = await noco.findOne(EMPRESAS_TABLE_ID, {
            where: `(nome_fantasia,like,%${possibleName}%)`
        });

        // Tentativa 2: Por ID específico (VR Pizza Show é ID 4 no banco do Riquelmo)
        if (!empresa && (slug === 'vr-pizza-show' || slug === 'vr-pizza')) {
            console.log(`[MENU_DEBUG] Busca por nome falhou, tentando ID 4 fixo`);
            empresa = await noco.findById(EMPRESAS_TABLE_ID, 4);
        }

        // Tentativa 3: Listar tudo e procurar manualmente (mais lento, mas garantido)
        if (!empresa) {
            console.log(`[MENU_DEBUG] Buscas diretas falharam, listando empresas...`);
            const lista = await noco.list(EMPRESAS_TABLE_ID, { limit: 50 });
            if (lista.list && lista.list.length > 0) {
                // Tenta achar qualquer uma que combine com o slug
                empresa = lista.list.find((e: any) => 
                    String(e.nome_fantasia || '').toLowerCase().includes(slug.toLowerCase()) ||
                    String(e.nome || '').toLowerCase().includes(slug.toLowerCase()) ||
                    String(e.slug || '').toLowerCase().includes(slug.toLowerCase())
                );
                
                // Se ainda nada, pega a primeira empresa ativa (Fallback final)
                if (!empresa) {
                    empresa = lista.list[0];
                    console.log(`[MENU_DEBUG] Fallback final: usando primeira empresa da lista: ${empresa.nome_fantasia || empresa.nome}`);
                }
            }
        }

        if (!empresa) {
            console.error(`[MENU_DEBUG] Nenhuma empresa encontrada em nenhuma tentativa.`);
            return null;
        }

        const empresaId = empresa.id;
        // Normalizar campos para o frontend
        empresa.nome = empresa.nome_fantasia || empresa.nome || 'ZapFlow';
        
        console.log(`[MENU_DEBUG] Empresa Identificada: ${empresa.nome} (ID: ${empresaId})`);

        // 2. BUSCA DE DADOS EM PARALELO (Otimizado)
        const [config, categorias, todosProdutos, todosGrupos, todosItens, loyaltyConfig] = await Promise.all([
            noco.findOne(CONFIGURACOES_LOJA_TABLE_ID, { where: `(empresa_id,eq,${empresaId})` }).catch(() => null),
            noco.listAll(CATEGORIAS_TABLE_ID, { where: `(empresa_id,eq,${empresaId})` }).catch(() => []),
            noco.listAll(PRODUTOS_TABLE_ID, { where: `(empresa_id,eq,${empresaId})` }).catch(() => []),
            noco.listAll(GRUPOS_COMPLEMENTOS_TABLE_ID, { where: `(empresa_id,eq,${empresaId})` }).catch(() => []),
            noco.listAll(COMPLEMENTOS_TABLE_ID, { where: `(empresa_id,eq,${empresaId})` }).catch(() => []),
            noco.findOne(LOYALTY_CONFIG_TABLE_ID, { where: `(empresa_id,eq,${empresaId})` }).catch(() => null)
        ]);

        // Aplicar configurações de logo/banner
        if (config) {
            if (config.Logo || config.logo) empresa.logo = config.Logo || config.logo;
            if (config.Banner || config.banner) empresa.banner = config.Banner || config.banner;
        }

        // 3. ORGANIZAÇÃO DOS PRODUTOS
        const grouped = (categorias || []).map((cat: any) => {
            const productsInCategory = (todosProdutos || []).filter((p: any) => 
                (p.categoria_id === cat.id || p.categorias === cat.id) && p.tipo !== 'composto'
            );
            const compositeInCategory = (todosProdutos || []).filter((p: any) => 
                (p.categoria_id === cat.id || p.categorias === cat.id) && p.tipo === 'composto'
            );

            return {
                id: cat.id,
                nome: cat.nome,
                products: productsInCategory.map((p: any) => {
                    const saborGroups: any[] = [];
                    const additionalGroups: any[] = [];
                    const groupIds = p.complementos_ids ? (typeof p.complementos_ids === 'string' ? p.complementos_ids.split(',').map(Number) : p.complementos_ids) : [];
                    
                    groupIds.forEach((gid: number) => {
                        const grupo = todosGrupos.find((g: any) => g.id === gid);
                        if (grupo) {
                            const items = todosItens.filter((i: any) => {
                                const itemGroupIds = i.grupos_ids ? (typeof i.grupos_ids === 'string' ? i.grupos_ids.split(',').map(Number) : i.grupos_ids) : [];
                                return itemGroupIds.includes(gid);
                            });
                            const compGroup = {
                                ...grupo,
                                items: items.map((i: any) => ({
                                    id: i.id,
                                    nome: i.nome,
                                    preco: Number(i.preco ?? 0)
                                }))
                            };
                            if (grupo.tipo === 'sabor') saborGroups.push(compGroup);
                            else additionalGroups.push(compGroup);
                        }
                    });

                    return {
                        id: p.id,
                        nome: String(p.nome || ''),
                        descricao: p.descricao || '',
                        preco: Number(p.preco ?? 0),
                        imagem: p.imagem || null,
                        disponivel: p.disponivel !== false && p.disponivel !== 0,
                        destaque: p.destaque === true || p.destaque === 1,
                        ordem: Number(p.ordem ?? 0),
                        tamanhos: p.tamanhos || null,
                        recomendacoes: p.recomendacoes || null,
                        saborGroups,
                        additionalGroups
                    };
                }),
                compositeProducts: compositeInCategory.map((p: any) => ({
                    id: p.id,
                    nome: String(p.nome || ''),
                    descricao: p.descricao || '',
                    preco: Number(p.preco ?? 0),
                    imagem: p.imagem || null,
                    tamanhos: p.tamanhos || null,
                    recomendacoes: p.recomendacoes || null,
                    tipo: 'composto'
                }))
            };
        });

        return {
            empresa,
            grouped,
            compositeProducts: (todosProdutos || []).filter((p: any) => p.tipo === 'composto'),
            upsellProducts: (todosProdutos || []).map((p: any) => ({
                id: p.id,
                nome: String(p.nome || ''),
                preco: Number(p.preco ?? 0),
                imagem: p.imagem || null,
                descricao: p.descricao || ''
            })),
            loyaltyConfig,
            allGroups: (todosGrupos || []).map((g: any) => ({
                ...g,
                items: (todosItens || []).filter((i: any) => {
                    const itemGroupIds = i.grupos_ids ? (typeof i.grupos_ids === 'string' ? i.grupos_ids.split(',').map(Number) : i.grupos_ids) : [];
                    return itemGroupIds.includes(g.id);
                }).map((i: any) => ({
                    id: i.id,
                    nome: i.nome,
                    preco: Number(i.preco ?? 0)
                }))
            }))
        };
    } catch (error) {
        console.error('[MENU_DEBUG] Erro Crítico:', error);
        return null;
    }
}
