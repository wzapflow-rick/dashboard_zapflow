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
    console.log(`[DEBUG] Iniciando busca de menu para o slug: ${slug}`);
    console.log(`[DEBUG] Usando EMPRESAS_TABLE_ID: ${EMPRESAS_TABLE_ID}`);
    
    try {
        // 1. Buscar Empresa pelo Slug ou Nome
        // Tentamos busca exata pelo slug primeiro
        let empresa = await noco.findOne(EMPRESAS_TABLE_ID, {
            where: `(slug,eq,${slug})`
        });
        
        if (empresa) console.log(`[DEBUG] Empresa encontrada por slug exato: ${empresa.nome}`);

        // Se não encontrar pelo slug, tentamos pelo nome da unidade (convertendo o slug de volta ou busca aproximada)
        if (!empresa) {
            console.log(`[DEBUG] Slug exato falhou, tentando busca aproximada (like)`);
            empresa = await noco.findOne(EMPRESAS_TABLE_ID, {
                where: `(slug,like,%${slug}%)`
            });
            if (empresa) console.log(`[DEBUG] Empresa encontrada por slug aproximado: ${empresa.nome}`);
        }

        // Se ainda não encontrar, tentamos buscar pelo nome da unidade que você informou
        if (!empresa) {
            const possibleName = slug.replace(/-/g, ' ');
            console.log(`[DEBUG] Slug aproximado falhou, tentando busca por nome: ${possibleName}`);
            empresa = await noco.findOne(EMPRESAS_TABLE_ID, {
                where: `(nome,like,%${possibleName}%)`
            });
            if (empresa) console.log(`[DEBUG] Empresa encontrada por nome aproximado: ${empresa.nome}`);
        }

        // Última tentativa: buscar qualquer empresa se houver apenas uma (fallback de segurança)
        if (!empresa) {
            console.log(`[DEBUG] Todas as buscas falharam, tentando fallback para empresa única`);
            const todasEmpresas = await noco.list(EMPRESAS_TABLE_ID, { limit: 10 });
            console.log(`[DEBUG] Total de empresas encontradas no banco: ${todasEmpresas.list.length}`);
            if (todasEmpresas.list.length === 1) {
                empresa = todasEmpresas.list[0] as any;
                console.log(`[DEBUG] Fallback ativado: Usando única empresa disponível: ${empresa.nome}`);
            } else if (todasEmpresas.list.length > 1) {
                console.log(`[DEBUG] Múltiplas empresas encontradas: ${todasEmpresas.list.map((e:any) => e.nome).join(', ')}`);
            }
        }

        if (!empresa) {
            console.error(`Empresa não encontrada para o slug: ${slug}`);
            return null;
        }

        const empresaId = empresa.id as number;

        // 2. Buscar Configurações da Empresa (Banner e Logo oficiais)
        const config = await noco.findOne(CONFIGURACOES_LOJA_TABLE_ID, {
            where: `(empresa_id,eq,${empresaId})`
        });

        if (config) {
            if (config.Logo || config.logo) empresa.logo = config.Logo || config.logo;
            if (config.Banner || config.banner) empresa.banner = config.Banner || config.banner;
        }

        // 3. Buscar Categorias
        const categorias = await noco.listAll(CATEGORIAS_TABLE_ID, {
            where: `(empresa_id,eq,${empresaId})`,
            sort: 'ordem'
        });

        // 4. Buscar Todos os Produtos
        const todosProdutos = await noco.listAll(PRODUTOS_TABLE_ID, {
            where: `(empresa_id,eq,${empresaId})`,
            sort: 'ordem'
        });

        // 5. Buscar Todos os Grupos de Complementos da Empresa
        const todosGrupos = await noco.listAll(GRUPOS_COMPLEMENTOS_TABLE_ID, {
            where: `(empresa_id,eq,${empresaId})`
        });

        // 6. Buscar Todos os Itens de Complementos
        const todosItens = await noco.listAll(COMPLEMENTOS_TABLE_ID, {
            where: `(empresa_id,eq,${empresaId})`
        });

        // 7. Buscar Configuração de Fidelidade
        const loyaltyConfig = await noco.findOne(LOYALTY_CONFIG_TABLE_ID, {
            where: `(empresa_id,eq,${empresaId})`
        });

        // Processar produtos recomendados (Upsell)
        const upsellProducts = todosProdutos.map((p: any) => ({
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
        console.error('Erro ao buscar menu público:', error);
        return null;
    }
}
