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
    console.log(`[MENU_DEBUG] EMPRESAS_TABLE_ID: ${EMPRESAS_TABLE_ID}`);
    
    try {
        let empresa: any = null;
        const normalizedSlug = slug.replace(/-/g, ' ').toLowerCase();

        // TENTATIVA 1: Buscar por nome_fantasia (mais provável de estar preenchido e ser o identificador)
        console.log(`[MENU_DEBUG] Tentando buscar por nome_fantasia com: ${normalizedSlug}`);
        const empresasByFantasia = await noco.list(EMPRESAS_TABLE_ID, {
            where: `(LOWER(nome_fantasia),like,%${normalizedSlug}%)`,
            limit: 1
        });
        if (empresasByFantasia.list.length > 0) {
            empresa = empresasByFantasia.list[0];
            console.log(`[MENU_DEBUG] Empresa encontrada por nome_fantasia: ${empresa.nome_fantasia}`);
        }

        // TENTATIVA 2: Fallback para VR Pizza Show (ID 4) se o slug for específico e ainda não encontrou
        if (!empresa && (slug === 'vr-pizza-show' || slug === 'vr-pizza')) {
            console.log(`[MENU_DEBUG] Buscas por nome_fantasia falharam, tentando ID fixo 4 para VR Pizza Show`);
            empresa = await noco.findById(EMPRESAS_TABLE_ID, 4);
            if (empresa) console.log(`[MENU_DEBUG] VR Pizza Show encontrada por ID fixo: ${empresa.nome_fantasia}`);
        }

        // TENTATIVA 3: Buscar por slug (se a coluna slug existir e estiver preenchida - menos provável no seu caso)
        if (!empresa) {
            console.log(`[MENU_DEBUG] ID fixo falhou, tentando buscar por coluna 'slug': ${slug}`);
            try {
                const empresasBySlug = await noco.list(EMPRESAS_TABLE_ID, {
                    where: `(slug,eq,${slug})`,
                    limit: 1
                });
                if (empresasBySlug.list.length > 0) {
                    empresa = empresasBySlug.list[0];
                    console.log(`[MENU_DEBUG] Empresa encontrada por coluna 'slug': ${empresa.slug}`);
                }
            } catch (e) {
                console.log(`[MENU_DEBUG] Coluna 'slug' pode não existir ou busca falhou.`);
            }
        }

        // TENTATIVA 4: Fallback final - pegar a primeira empresa ativa se houver apenas uma
        if (!empresa) {
            console.log(`[MENU_DEBUG] Todas as buscas falharam, tentando fallback para empresa única`);
            const todasEmpresas = await noco.list(EMPRESAS_TABLE_ID, { limit: 2 }); // Limite 2 para verificar se é única
            console.log(`[MENU_DEBUG] Resultado de todasEmpresas.list: ${JSON.stringify(todasEmpresas.list.map((e:any) => ({id: e.id, nome_fantasia: e.nome_fantasia})))}`);
            if (todasEmpresas.list.length === 1) {
                empresa = todasEmpresas.list[0];
                console.log(`[MENU_DEBUG] Fallback ativado: Usando única empresa disponível: ${empresa.nome_fantasia || empresa.nome}`);
            } else if (todasEmpresas.list.length > 1) {
                console.log(`[MENU_DEBUG] Múltiplas empresas encontradas, fallback único não aplicável.`);
            }
        }

        if (!empresa) {
            console.error(`[MENU_DEBUG] Nenhuma empresa encontrada no banco de dados para o slug: ${slug}`);
            return null;
        }

        const empresaId = empresa.id;
        // Normalizar o nome para o restante do código, priorizando nome_fantasia
        empresa.nome = empresa.nome_fantasia || empresa.nome || 'ZapFlow';
        
        console.log(`[MENU_DEBUG] Empresa selecionada: ${empresa.nome} (ID: ${empresaId})`);

        // 2. BUSCA DE DADOS EM PARALELO (Otimizado)
        const [configData, categorias, todosProdutos, todosGrupos, todosItens, loyaltyConfig] = await Promise.all([
            noco.list(CONFIGURACOES_LOJA_TABLE_ID, { 
                where: `(Empresa ID,eq,${empresaId})` 
            }).catch(() => ({ list: [] })),
            noco.listAll(CATEGORIAS_TABLE_ID, { where: `(empresa_id,eq,${empresaId})` }).catch(() => []),
            noco.listAll(PRODUTOS_TABLE_ID, { where: `(empresa_id,eq,${empresaId})` }).catch(() => []),
            noco.listAll(GRUPOS_COMPLEMENTOS_TABLE_ID, { where: `(empresa_id,eq,${empresaId})` }).catch(() => []),
            noco.listAll(COMPLEMENTOS_TABLE_ID, { where: `(empresa_id,eq,${empresaId})` }).catch(() => []),
            noco.findOne(LOYALTY_CONFIG_TABLE_ID, { where: `(empresa_id,eq,${empresaId})` }).catch(() => null)
        ]);

        // Pegar a primeira configuração encontrada
        const config = configData.list && configData.list.length > 0 ? configData.list[0] : null;

        // Mapeamento exato baseado na inspeção do banco: "Logo" (L maiúsculo) e "banner" (b minúsculo)
        if (config) {
            console.log(`[MENU_DEBUG] Configurações encontradas. Logo: ${!!config.Logo}, Banner: ${!!config.banner}`);
            if (config.Logo) empresa.logo = config.Logo;
            if (config.banner) empresa.banner = config.banner;
            // Fallbacks caso os nomes variem (mantido para segurança extra)
            if (!empresa.logo && config.logo) empresa.logo = config.logo;
            if (!empresa.banner && config.Banner) empresa.banner = config.Banner;
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
