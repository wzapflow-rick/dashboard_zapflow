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
    console.log(`[MENU_DEBUG] Buscando cardápio para: ${slug}`);
    
    try {
        // 1. BUSCA ULTRA-RESILIENTE DA EMPRESA
        let empresa: any = null;

        // TENTATIVA A: Busca exata pelo slug
        empresa = await noco.findOne(EMPRESAS_TABLE_ID, {
            where: `(slug,eq,${slug})`
        });

        // TENTATIVA B: Busca por slug aproximado (like)
        if (!empresa) {
            console.log(`[MENU_DEBUG] Slug exato falhou, tentando aproximado`);
            empresa = await noco.findOne(EMPRESAS_TABLE_ID, {
                where: `(slug,like,%${slug}%)`
            });
        }

        // TENTATIVA C: Busca pelo nome da unidade (VR Pizza Show)
        if (!empresa) {
            const possibleName = slug.replace(/-/g, ' ');
            console.log(`[MENU_DEBUG] Slug falhou, tentando por nome: ${possibleName}`);
            empresa = await noco.findOne(EMPRESAS_TABLE_ID, {
                where: `(nome,like,%${possibleName}%)`
            });
        }

        // TENTATIVA D: Fallback de Segurança - Se houver poucas empresas, tenta a primeira
        if (!empresa) {
            console.log(`[MENU_DEBUG] Buscas específicas falharam, tentando listar empresas`);
            const listaEmpresas = await noco.list(EMPRESAS_TABLE_ID, { limit: 10 });
            if (listaEmpresas.list && listaEmpresas.list.length > 0) {
                // Se só tem uma empresa, é ela!
                if (listaEmpresas.list.length === 1) {
                    empresa = listaEmpresas.list[0];
                    console.log(`[MENU_DEBUG] Única empresa encontrada no banco: ${empresa.nome}`);
                } else {
                    // Se tem mais de uma, tenta ver se o slug faz parte de algum nome
                    empresa = listaEmpresas.list.find((e: any) => 
                        String(e.nome || '').toLowerCase().includes(slug.toLowerCase()) ||
                        String(e.slug || '').toLowerCase().includes(slug.toLowerCase())
                    );
                    if (!empresa) {
                        // Se ainda assim não achou, pega a primeira como último recurso para não dar 404
                        empresa = listaEmpresas.list[0];
                        console.log(`[MENU_DEBUG] Usando primeira empresa da lista como último recurso: ${empresa.nome}`);
                    }
                }
            }
        }

        if (!empresa) {
            console.error(`[MENU_DEBUG] Nenhuma empresa encontrada no banco de dados!`);
            return null;
        }

        const empresaId = empresa.id;
        console.log(`[MENU_DEBUG] Empresa selecionada: ${empresa.nome} (ID: ${empresaId})`);

        // 2. BUSCA DE DADOS COMPLEMENTARES
        // Buscamos tudo em paralelo para ser mais rápido
        const [config, categorias, todosProdutos, todosGrupos, todosItens, loyaltyConfig] = await Promise.all([
            noco.findOne(CONFIGURACOES_LOJA_TABLE_ID, { where: `(empresa_id,eq,${empresaId})` }),
            noco.listAll(CATEGORIAS_TABLE_ID, { where: `(empresa_id,eq,${empresaId})`, sort: 'ordem' }),
            noco.listAll(PRODUTOS_TABLE_ID, { where: `(empresa_id,eq,${empresaId})`, sort: 'ordem' }),
            noco.listAll(GRUPOS_COMPLEMENTOS_TABLE_ID, { where: `(empresa_id,eq,${empresaId})` }),
            noco.listAll(COMPLEMENTOS_TABLE_ID, { where: `(empresa_id,eq,${empresaId})` }),
            noco.findOne(LOYALTY_CONFIG_TABLE_ID, { where: `(empresa_id,eq,${empresaId})` })
        ]);

        // Priorizar logo/banner das configurações
        if (config) {
            if (config.Logo || config.logo) empresa.logo = config.Logo || config.logo;
            if (config.Banner || config.banner) empresa.banner = config.Banner || config.banner;
        }

        // Processar produtos recomendados (Upsell)
        const upsellProducts = todosProdutos.map((p: any) => ({
            id: p.id,
            nome: String(p.nome || ''),
            preco: Number(p.preco ?? 0),
            imagem: p.imagem || null,
            descricao: p.descricao || ''
        }));

        // Organizar Produtos por Categoria
        const grouped = categorias.map((cat: any) => {
            const productsInCategory = todosProdutos.filter((p: any) => p.categoria_id === cat.id && p.tipo !== 'composto');
            const compositeInCategory = todosProdutos.filter((p: any) => p.categoria_id === cat.id && p.tipo === 'composto');

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
                        disponivel: true,
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
            compositeProducts: todosProdutos.filter((p: any) => p.tipo === 'composto'),
            upsellProducts,
            loyaltyConfig,
            allGroups: todosGrupos.map((g: any) => ({
                ...g,
                items: todosItens.filter((i: any) => {
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
        console.error('[MENU_DEBUG] Erro crítico ao buscar menu:', error);
        return null;
    }
}
