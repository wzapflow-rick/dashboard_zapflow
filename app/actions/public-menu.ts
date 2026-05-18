import { pg } from '@/lib/postgres';
import { 
    PRODUTOS_TABLE, 
    CATEGORIAS_TABLE, 
    GRUPOS_COMPLEMENTOS_TABLE, 
    COMPLEMENTOS_TABLE, 
    EMPRESAS_TABLE, 
    CONFIGURACOES_LOJA_TABLE, 
    LOYALTY_CONFIG_TABLE,
    PRODUTOS_METADADOS_TABLE,
} from '@/lib/tables';
import { isPaidPlan } from '@/lib/constants';
import { getAssinaturaByEmpresaId } from '@/lib/assinaturas';

export async function getPublicMenu(slug: string) {
    console.log(`[MENU_DEBUG] Iniciando busca para slug: ${slug}`);
    
    try {
        let empresa: any = null;
        const possibleName = slug.replace(/-/g, ' ');

        // TENTATIVA 1: Busca simples por nome_fantasia
        console.log(`[MENU_DEBUG] Tentando buscar por nome_fantasia: ${possibleName}`);
        const empresasByFantasia = await pg.list(EMPRESAS_TABLE, {
            where: `(nome_fantasia,ilike,%${possibleName}%)`,
            limit: 1
        });
        
        if (empresasByFantasia.list.length > 0) {
            empresa = empresasByFantasia.list[0];
            console.log(`[MENU_DEBUG] Empresa encontrada por nome_fantasia: ${empresa.nome_fantasia}`);
        }

        // TENTATIVA 2: Fallback para ID fixo 4 (VR Pizza Show)
        if (!empresa && (slug === 'vr-pizza-show' || slug === 'vr-pizza')) {
            console.log(`[MENU_DEBUG] Fallback ID 4 ativado`);
            empresa = await pg.findById(EMPRESAS_TABLE, 4);
        }

        // TENTATIVA 3: Fallback final - pegar a primeira se for a única
        if (!empresa) {
            const todas = await pg.list(EMPRESAS_TABLE, { limit: 2 });
            if (todas.list.length === 1) {
                empresa = todas.list[0];
                console.log(`[MENU_DEBUG] Fallback única empresa: ${empresa.nome_fantasia}`);
            }
        }

        if (!empresa) {
            console.error(`[MENU_DEBUG] Nenhuma empresa encontrada.`);
            return null;
        }

        const empresaId = empresa.id;
        empresa.nome = empresa.nome_fantasia || empresa.nome || 'ZapFlow';
        
        console.log(`[MENU_DEBUG] Empresa: ${empresa.nome} (ID: ${empresaId})`);
        
        // Verificar se empresa tem assinatura ativa na tabela assinaturas (PostgreSQL)
        let hasActiveSubscription = false;
        let planoAtivo = 'iniciante';
        
        try {
            const assinatura = await getAssinaturaByEmpresaId(empresaId);
            
            if (assinatura && assinatura.status === 'authorized') {
                planoAtivo = assinatura.plano || 'iniciante';
                
                // Verificar se nao esta vencida (se data_proxima_cobranca > hoje)
                const dataProxima = assinatura.data_proxima_cobranca ? new Date(assinatura.data_proxima_cobranca) : null;
                const hoje = new Date();
                
                if (isPaidPlan(planoAtivo)) {
                    if (!dataProxima || dataProxima > hoje) {
                        hasActiveSubscription = true;
                        console.log(`[MENU_DEBUG] Assinatura ativa: ${planoAtivo}, vence em ${dataProxima?.toISOString() || 'N/A'}`);
                    } else {
                        console.log(`[MENU_DEBUG] Assinatura vencida: ${planoAtivo}, venceu em ${dataProxima.toISOString()}`);
                    }
                } else {
                    console.log(`[MENU_DEBUG] Plano ${planoAtivo} nao e um plano pago`);
                }
            } else {
                console.log(`[MENU_DEBUG] Nenhuma assinatura ativa encontrada para empresa ${empresaId}`);
            }
        } catch (pgError) {
            console.error(`[MENU_DEBUG] Erro ao verificar assinatura no PostgreSQL:`, pgError);
            // Fallback: verificar campo plano da empresa
            const planoEmpresa = empresa.planos || empresa.plano || 'iniciante';
            if (isPaidPlan(planoEmpresa)) {
                hasActiveSubscription = true;
                planoAtivo = planoEmpresa;
            }
        }
        
        if (!hasActiveSubscription) {
            console.log(`[MENU_DEBUG] Empresa sem plano pago ativo`);
            return {
                blocked: true,
                reason: 'no_subscription',
                empresa: {
                    id: empresaId,
                    nome: empresa.nome,
                    logo: empresa.logo || null,
                }
            };
        }

        // 2. BUSCA DE DADOS EM PARALELO
        const [configData, categorias, todosProdutos, todosGrupos, todosItens, loyaltyConfig, produtosMetadados] = await Promise.all([
            pg.list(CONFIGURACOES_LOJA_TABLE, { 
                where: { empresa_id: empresaId } 
            }).catch(() => ({ list: [] })),
            pg.listAll(CATEGORIAS_TABLE, { where: { empresa_id: empresaId } }).catch(() => []),
            pg.listAll(PRODUTOS_TABLE, { where: { empresa_id: empresaId } }).catch(() => []),
            pg.listAll(GRUPOS_COMPLEMENTOS_TABLE, { where: { empresa_id: empresaId } }).catch(() => []),
            pg.listAll(COMPLEMENTOS_TABLE, { where: { empresa_id: empresaId } }).catch(() => []),
            pg.findOne(LOYALTY_CONFIG_TABLE, { where: { empresa_id: empresaId } }).catch(() => null),
            pg.listAll(PRODUTOS_METADADOS_TABLE).catch(() => []),
        ]);

        const config = configData.list && configData.list.length > 0 ? configData.list[0] : null;

        if (config) {
            if (config.logo) empresa.logo = config.logo;
            if (config.banner) empresa.banner = config.banner;
        }

        // 3. ORGANIZAÇÃO DOS PRODUTOS (ordenar categorias pela ordem)
        const categoriasOrdenadas = [...(categorias || [])].sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0));
        
        const grouped = categoriasOrdenadas.map((cat: any) => {
            const productsInCategory = (todosProdutos || []).filter((p: any) => 
                (p.categoria_id === cat.id) && p.tipo !== 'composto'
            );
            const compositeInCategory = (todosProdutos || []).filter((p: any) => 
                (p.categoria_id === cat.id) && p.tipo === 'composto'
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

                    const metadata = (produtosMetadados || []).find((m: any) => 
                        Number(m.produto_id) === Number(p.id)
                    );
                    
                    let recomendacoes = null;
                    let tamanhos = null;

                    const rawRecom = metadata?.recomendacoes;
                    const rawTamanhos = metadata?.tamanhos;

                    try {
                        if (rawRecom && typeof rawRecom === 'string') {
                            recomendacoes = JSON.parse(rawRecom);
                        } else if (rawRecom && typeof rawRecom === 'object') {
                            recomendacoes = rawRecom;
                        }
                        
                        if (rawTamanhos && typeof rawTamanhos === 'string') {
                            tamanhos = JSON.parse(rawTamanhos);
                        } else if (rawTamanhos && typeof rawTamanhos === 'object') {
                            tamanhos = rawTamanhos;
                        }
                    } catch (e) {
                        console.error('Error parsing metadata JSON', e);
                    }

                    return {
                        id: p.id,
                        nome: String(p.nome || ""),
                        descricao: p.descricao || "",
                        preco: Number(p.preco ?? 0),
                        imagem: p.imagem || null,
                        disponivel: p.disponivel !== false && p.disponivel !== 0,
                        destaque: p.destaque === true || p.destaque === 1,
                        tag: p.tag || null,
                        ordem: Number(p.ordem ?? 0),
                        tamanhos: tamanhos || null,
                        recomendacoes: recomendacoes || null,
                        saborGroups,
                        additionalGroups
                    };
                }),
                compositeProducts: compositeInCategory.map((p: any) => {
                    const metadata = (produtosMetadados || []).find((m: any) => 
                        Number(m.produto_id) === Number(p.id)
                    );
                    
                    let recomendacoes = null;
                    let tamanhos = null;

                    const rawRecom = metadata?.recomendacoes;
                    const rawTamanhos = metadata?.tamanhos;

                    try {
                        if (rawRecom && typeof rawRecom === 'string') {
                            recomendacoes = JSON.parse(rawRecom);
                        } else if (rawRecom && typeof rawRecom === 'object') {
                            recomendacoes = rawRecom;
                        }
                        
                        if (rawTamanhos && typeof rawTamanhos === 'string') {
                            tamanhos = JSON.parse(rawTamanhos);
                        } else if (rawTamanhos && typeof rawTamanhos === 'object') {
                            tamanhos = rawTamanhos;
                        }
                    } catch (e) {
                        console.error('Error parsing metadata JSON', e);
                    }

                    return {
                        id: p.id,
                        nome: String(p.nome || ""),
                        descricao: p.descricao || "",
                        preco: Number(p.preco ?? 0),
                        imagem: p.imagem || null,
                        tag: p.tag || null,
                        tamanhos: tamanhos || null,
                        recomendacoes: recomendacoes || null,
                        tipo: 'composto'
                    };
                })
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
                descricao: p.descricao || '',
                tag: p.tag || null
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
