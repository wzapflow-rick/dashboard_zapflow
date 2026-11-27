import { cache } from 'react';
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
    PRODUTO_GRUPOS_COMPLEMENTOS_TABLE,
} from '@/lib/tables';
import { isPaidPlan } from '@/lib/constants';
import { getAssinaturaByEmpresaId } from '@/lib/assinaturas';
import { HORARIOS_TABLE } from '@/lib/tables';
import { getStatusLoja, type Horario } from '@/lib/horarios';

// React cache: generateMetadata e a pagina chamam getPublicMenu na mesma
// requisicao; sem isso todas as queries rodavam 2x por acesso ao cardapio.
export const getPublicMenu = cache(loadPublicMenu);

function decodePublicMenuSlug(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function normalizePublicMenuSlug(value: string): string {
    return decodePublicMenuSlug(value)
        .normalize('NFD')
        .replace(/[\\u0300-\\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function loadPublicMenu(slug: string) {
    
    try {
        let empresa: any = null;
        
        const requestedSlug = decodePublicMenuSlug(slug);
        const normalizedSlug = normalizePublicMenuSlug(requestedSlug);
        const possibleNameLower = requestedSlug.replace(/-/g, ' ');

        
        // TENTATIVA 1: Busca slug original ou normalizado (sem acentos).
        const empresaBySlug = await pg.raw<any>(
            `SELECT * FROM "${EMPRESAS_TABLE}"
             WHERE LOWER(COALESCE(slug, '')) IN (LOWER($1), LOWER($2))
             LIMIT 1`,
            [requestedSlug, normalizedSlug]
        );
        if (empresaBySlug.length > 0) {
            empresa = empresaBySlug[0];
        }

        // TENTATIVA 2: Busca exata por instancia_evolution (zapflow_ID).
        if (!empresa && requestedSlug.startsWith('zapflow_')) {
            const empresaByInstance = await pg.raw<any>(
                `SELECT * FROM "${EMPRESAS_TABLE}" WHERE instancia_evolution = $1 LIMIT 1`,
                [requestedSlug]
            );
            if (empresaByInstance.length > 0) {
                empresa = empresaByInstance[0];
            }
        }

        // TENTATIVA 3: Compara o slug sem acentos com o nome fantasia normalizado.
        // Não depende da extensão PostgreSQL unaccent.
        if (!empresa && normalizedSlug) {
            const empresasByFantasia = await pg.raw<any>(
                `SELECT * FROM "${EMPRESAS_TABLE}"
                 WHERE TRIM(BOTH '-' FROM REGEXP_REPLACE(
                     TRANSLATE(LOWER(COALESCE(nome_fantasia, '')),
                         'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
                         'aaaaaaeeeeiiiiooooouuuucnyy'),
                     '[^a-z0-9]+', '-', 'g'
                 )) = $1
                 LIMIT 1`,
                [normalizedSlug]
            );

            if (empresasByFantasia.length > 0) {
                empresa = empresasByFantasia[0];
            }
        }

        // TENTATIVA 4: Busca parcial por nome_fantasia
        if (!empresa) {
            const empresasByFantasiaLike = await pg.raw<any>(
                `SELECT * FROM "${EMPRESAS_TABLE}" WHERE LOWER(nome_fantasia) LIKE LOWER($1) ORDER BY LENGTH(nome_fantasia) ASC LIMIT 1`,
                [`%${possibleNameLower}%`]
            );
            
            if (empresasByFantasiaLike.length > 0) {
                empresa = empresasByFantasiaLike[0];
            }
        }

        // TENTATIVA 5: Fallback para ID numerico (se slug for numero)
        if (!empresa && /^\d+$/.test(slug)) {
            empresa = await pg.findById(EMPRESAS_TABLE, parseInt(slug));
            if (empresa) {
            }
        }

        // TENTATIVA 6: Fallback final - pegar a primeira se for a unica empresa
        if (!empresa) {
            const todas = await pg.list(EMPRESAS_TABLE, { limit: 2 });
            if (todas.list.length === 1) {
                empresa = todas.list[0];
            }
        }

        if (!empresa) {
            console.error(`[MENU_DEBUG] Nenhuma empresa encontrada para slug: ${requestedSlug}`);
            return null;
        }

        const empresaId = empresa.id;
        empresa.nome = empresa.nome_fantasia || empresa.nome || 'ZapFlash';
        
        
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
                    } else {
                    }
                } else {
                }
            } else {
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
        const [configData, categorias, todosProdutos, todosGrupos, todosItens, loyaltyConfig, produtosMetadados, horariosData, vinculosGrupos] = await Promise.all([
            pg.list(CONFIGURACOES_LOJA_TABLE, { 
                where: { empresa_id: empresaId } 
            }).catch(() => ({ list: [] })),
            pg.listAll(CATEGORIAS_TABLE, { where: { empresa_id: empresaId } }).catch(() => []),
            pg.listAll(PRODUTOS_TABLE, { where: { empresa_id: empresaId } }).catch(() => []),
            pg.listAll(GRUPOS_COMPLEMENTOS_TABLE, { where: { empresa_id: empresaId } }).catch(() => []),
            pg.listAll(COMPLEMENTOS_TABLE, { where: { empresa_id: empresaId } }).catch(() => []),
            pg.findOne(LOYALTY_CONFIG_TABLE, { where: { empresa_id: empresaId } }).catch(() => null),
            // Antes carregava os metadados de TODAS as empresas a cada acesso.
            pg.raw<any>(
                `SELECT * FROM "${PRODUTOS_METADADOS_TABLE}"
                 WHERE produto_id::text IN (SELECT id::text FROM "${PRODUTOS_TABLE}" WHERE empresa_id = $1)`,
                [empresaId]
            ).catch(() => []),
            pg.listAll(HORARIOS_TABLE, { where: { empresa_id: empresaId } }).catch(() => []),
            pg.listAll(PRODUTO_GRUPOS_COMPLEMENTOS_TABLE, { where: { empresa_id: empresaId } }).catch(() => []),
        ]);

        const config = configData.list && configData.list.length > 0 ? configData.list[0] : null;

        const parseIds = (raw: unknown): number[] =>
            raw ? (typeof raw === 'string' ? raw.split(',').map(Number) : (raw as number[])) : [];
        const metadataByProduto = new Map<number, any>();
        for (const m of produtosMetadados || []) metadataByProduto.set(Number(m.produto_id), m);
        const grupoById = new Map<number, any>();
        for (const g of todosGrupos || []) grupoById.set(Number(g.id), g);
        const itensByGrupo = new Map<number, { id: any; nome: any; preco: number }[]>();
        for (const i of todosItens || []) {
            if (i.disponivel === false || i.disponivel === 'f' || i.disponivel === 0) continue;
            const item = { id: i.id, nome: i.nome, preco: Number(i.preco ?? 0) };
            const gids = i.grupo_id != null ? [Number(i.grupo_id)] : parseIds(i.grupos_ids);
            for (const gid of gids) {
                const list = itensByGrupo.get(gid);
                if (list) list.push(item);
                else itensByGrupo.set(gid, [item]);
            }
        }
        const gruposByProduto = new Map<number, number[]>();
        for (const v of [...(vinculosGrupos || [])].sort((a: any, b: any) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0))) {
            const pid = Number(v.produto_id);
            const list = gruposByProduto.get(pid);
            if (list) list.push(Number(v.grupo_complemento_id));
            else gruposByProduto.set(pid, [Number(v.grupo_complemento_id)]);
        }

        // Status de funcionamento: respeita os horarios E os overrides manuais do
        // lojista - fechamento manual ("Fechar a Loja", expira na proxima abertura)
        // e abertura manual ("Abrir a Loja", forca aberto fora do horario ate o fim
        // do dia, ex.: feriado).
        const horarios = (horariosData || []) as Horario[];
        const { aberto: lojaAberta, proximaAbertura } = getStatusLoja(
            horarios,
            (config?.fechado_manual_ate as string | null | undefined) ?? null,
            (config?.aberto_manual_ate as string | null | undefined) ?? null,
        );

        if (config) {
            if (config.logo) empresa.logo = config.logo;
            if (config.banner) empresa.banner = config.banner;
        }

        // 3. ORGANIZAÇÃO DOS PRODUTOS (ordenar categorias pela ordem)
        // Produto indisponivel (toggle "Disponibilidade" desligado no admin) NUNCA
        // pode aparecer no cardapio publico. O flag vem do Postgres podendo ser
        // boolean false, 0 ou 'f'/'false'; qualquer um desses conta como esgotado.
        // null/undefined = disponivel (mesmo default usado no admin).
        const isDisponivel = (p: any) =>
            p.disponivel !== false &&
            p.disponivel !== 0 &&
            p.disponivel !== 'f' &&
            p.disponivel !== 'false';

        const categoriasOrdenadas = [...(categorias || [])].sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0));
        
        const grouped = categoriasOrdenadas.map((cat: any) => {
            // Ordena os produtos pela coluna "ordem" (menor primeiro) e, como
            // criterio de desempate, pelo id. Lojas que nao definiram "ordem"
            // (todos os produtos com ordem = 0) mantem a ordem atual.
            const ordenarPorOrdem = (a: any, b: any) => {
                const diff = (Number(a.ordem) || 0) - (Number(b.ordem) || 0);
                return diff !== 0 ? diff : (Number(a.id) || 0) - (Number(b.id) || 0);
            };

            const productsInCategory = (todosProdutos || []).filter((p: any) => 
                (p.categoria_id === cat.id) && p.tipo !== 'composto' && isDisponivel(p)
            ).sort(ordenarPorOrdem);
            const compositeInCategory = (todosProdutos || []).filter((p: any) => 
                (p.categoria_id === cat.id) && p.tipo === 'composto' && isDisponivel(p)
            ).sort(ordenarPorOrdem);

            return {
                id: cat.id,
                nome: cat.nome,
                products: productsInCategory.map((p: any) => {
                    const saborGroups: any[] = [];
                    const additionalGroups: any[] = [];
                    const groupIds = gruposByProduto.get(Number(p.id)) ?? parseIds(p.complementos_ids);
                    
                    groupIds.forEach((gid: number) => {
                        const grupo = grupoById.get(Number(gid));
                        if (grupo) {
                            const compGroup = {
                                ...grupo,
                                items: itensByGrupo.get(Number(gid)) ?? []
                            };
                            if (grupo.tipo === 'sabor') saborGroups.push(compGroup);
                            else additionalGroups.push(compGroup);
                        }
                    });

                    const metadata = metadataByProduto.get(Number(p.id));
                    
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
                    const metadata = metadataByProduto.get(Number(p.id));
                    
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
            lojaAberta,
            proximaAbertura,
            grouped,
            compositeProducts: (todosProdutos || []).filter((p: any) => p.tipo === 'composto' && isDisponivel(p)),
            upsellProducts: (todosProdutos || []).filter(isDisponivel).map((p: any) => ({
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
                items: itensByGrupo.get(Number(g.id)) ?? []
            }))
        };
    } catch (error) {
        console.error('[MENU_DEBUG] Erro Crítico:', error);
        return null;
    }
}
