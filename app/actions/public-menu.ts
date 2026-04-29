import { getNocoClient } from '@/lib/nocodb';
import { PRODUTOS_TABLE_ID, CATEGORIAS_TABLE_ID, COMPLEMENTOS_GRUPOS_TABLE_ID, COMPLEMENTOS_ITENS_TABLE_ID, EMPRESA_TABLE_ID, CONFIGURACOES_TABLE_ID, LOYALTY_CONFIG_TABLE_ID } from '@/lib/constants';

export async function getPublicMenu(slug: string) {
    try {
        const noco = await getNocoClient();

        // 1. Buscar Empresa pelo Slug
        const empresaList = await noco.dbViewRow.list('v1', 'p8p8973z9152v98', EMPRESA_TABLE_ID, 'MainView', {
            where: `(slug,eq,${slug})`,
            limit: 1
        });

        if (!empresaList.list || empresaList.list.length === 0) {
            return null;
        }

        const empresa = empresaList.list[0];
        const empresaId = empresa.id;

        // 2. Buscar Configurações da Empresa (Banner e Logo oficiais)
        const configList = await noco.dbViewRow.list('v1', 'p8p8973z9152v98', CONFIGURACOES_TABLE_ID, 'MainView', {
            where: `(empresa_id,eq,${empresaId})`,
            limit: 1
        });

        if (configList.list && configList.list.length > 0) {
            const config = configList.list[0];
            // Priorizar campos da tabela de configurações se existirem
            if (config.Logo || config.logo) empresa.logo = config.Logo || config.logo;
            if (config.Banner || config.banner) empresa.banner = config.Banner || config.banner;
        }

        // 3. Buscar Categorias
        const categoriasList = await noco.dbViewRow.list('v1', 'p8p8973z9152v98', CATEGORIAS_TABLE_ID, 'MainView', {
            where: `(empresa_id,eq,${empresaId})`,
            sort: 'ordem'
        });

        const categorias = categoriasList.list || [];

        // 4. Buscar Todos os Produtos
        const produtosList = await noco.dbViewRow.list('v1', 'p8p8973z9152v98', PRODUTOS_TABLE_ID, 'MainView', {
            where: `(empresa_id,eq,${empresaId})`,
            sort: 'ordem'
        });

        const todosProdutos = produtosList.list || [];

        // 5. Buscar Todos os Grupos de Complementos da Empresa
        const gruposList = await noco.dbViewRow.list('v1', 'p8p8973z9152v98', COMPLEMENTOS_GRUPOS_TABLE_ID, 'MainView', {
            where: `(empresa_id,eq,${empresaId})`
        });
        const todosGrupos = gruposList.list || [];

        // 6. Buscar Todos os Itens de Complementos
        const itensList = await noco.dbViewRow.list('v1', 'p8p8973z9152v98', COMPLEMENTOS_ITENS_TABLE_ID, 'MainView', {
            where: `(empresa_id,eq,${empresaId})`
        });
        const todosItens = itensList.list || [];

        // 7. Buscar Configuração de Fidelidade
        const loyaltyList = await noco.dbViewRow.list('v1', 'p8p8973z9152v98', LOYALTY_CONFIG_TABLE_ID, 'MainView', {
            where: `(empresa_id,eq,${empresaId})`,
            limit: 1
        });
        const loyaltyConfig = loyaltyList.list?.[0] || null;

        // Processar produtos recomendados (Upsell)
        const upsellProducts = todosProdutos.map(p => ({
            id: p.id as number,
            nome: p.nome as string,
            preco: Number(p.preco ?? 0),
            imagem: p.imagem as string | null,
            descricao: p.descricao as string | undefined
        }));

        // Organizar Produtos por Categoria e Vincular Complementos
        const grouped = categorias.map((cat: any) => {
            const productsInCategory = todosProdutos.filter((p: any) => p.categoria_id === cat.id && p.tipo !== 'composto');
            const compositeInCategory = todosProdutos.filter((p: any) => p.categoria_id === cat.id && p.tipo === 'composto');

            return {
                id: cat.id,
                nome: cat.nome,
                products: productsInCategory.map((p: any) => {
                    const saborGroups: any[] = [];
                    const additionalGroups: any[] = [];

                    // Vincular grupos de complementos baseados nos IDs salvos no produto
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

                            if (grupo.tipo === 'sabor') {
                                saborGroups.push(compGroup);
                            } else {
                                additionalGroups.push(compGroup);
                            }
                        }
                    });

                    return {
                        id: p.id as number,
                        nome: p.nome as string,
                        descricao: p.descricao as string | undefined,
                        preco: Number(p.preco ?? 0),
                        imagem: p.imagem as string | null,
                        disponivel: true,
                        destaque: p.destaque === true || p.destaque === 1,
                        ordem: Number(p.ordem ?? 0),
                        tamanhos: p.tamanhos as string | null,
                        recomendacoes: p.recomendacoes as string | null,
                        saborGroups,
                        additionalGroups
                    };
                }),
                compositeProducts: compositeInCategory.map((p: any) => {
                    // Lógica para produtos compostos se necessário
                    return {
                        id: p.id,
                        nome: p.nome,
                        descricao: p.descricao,
                        preco: Number(p.preco ?? 0),
                        imagem: p.imagem,
                        tamanhos: p.tamanhos as string | null,
                        recomendacoes: p.recomendacoes as string | null,
                        tipo: 'composto'
                    };
                })
            };
        });

        return {
            empresa,
            grouped,
            compositeProducts: todosProdutos.filter(p => p.tipo === 'composto'),
            upsellProducts,
            loyaltyConfig,
            allGroups: todosGrupos.map(g => ({
                ...g,
                items: todosItens.filter(i => {
                    const itemGroupIds = i.grupos_ids ? (typeof i.grupos_ids === 'string' ? i.grupos_ids.split(',').map(Number) : i.grupos_ids) : [];
                    return itemGroupIds.includes(g.id);
                }).map(i => ({
                    id: i.id,
                    nome: i.nome,
                    preco: Number(i.preco ?? 0)
                }))
            }))
        };

    } catch (error) {
        console.error('Erro ao buscar menu público:', error);
        return null;
    }
}
