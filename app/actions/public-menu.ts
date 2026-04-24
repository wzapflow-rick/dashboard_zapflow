'use server';

import { noco } from '@/lib/nocodb';
import {
    EMPRESAS_TABLE_ID,
    PRODUTOS_TABLE_ID,
    CATEGORIAS_TABLE_ID,
    GRUPOS_SLOTS_TABLE_ID,
    ITENS_BASE_TABLE_ID,
    LOYALTY_CONFIG_TABLE_ID,
} from '@/lib/constants';

// ============================================================
// HELPERS (RECOMPILE FORCE - v1.0.1)
// ============================================================

function toSlug(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
}

function parseJsonArray(value: unknown): number[] {
    if (!value) return [];
    if (Array.isArray(value)) return value as number[];
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        }
    }
    return [];
}

// ============================================================
// TIPOS
// ============================================================

export interface PublicEmpresa {
    id: number;
    nome: string;
    telefone: string | null;
    nincho: string | null;
    slug: string | null;
    cidade: string | null;
    endereco: string | null;
    cor_primaria?: string | null;
    logo?: string | null;
}

export interface PublicProduct {
    id: number;
    nome: string;
    descricao?: string;
    preco: number;
    preco_original?: number;
    imagem?: string | null;
    disponivel: boolean;
    destaque: boolean;
    ordem: number;
    tamanhos?: string | null;
    saborGroups: PublicGroup[];
    additionalGroups: PublicGroup[];
    complementGroups: PublicGroup[];
}

export interface PublicGroup {
    id: number;
    nome: string;
    tipo: string;
    minimo: number;
    maximo: number;
    obrigatorio: boolean;
    tipo_calculo: string;
    cobrar_mais_caro: boolean;
    total_slots: number;
    preco_fixo: number;
    completamentos_ids: number[];
    items: PublicGroupItem[];
}

export interface PublicGroupItem {
    id: number;
    nome: string;
    preco: number;
    fator_proporcao: number;
}

export interface PublicCategory {
    id: number | string;
    name: string;
    icone?: string | null;
    cor?: string | null;
    ordem: number;
    products: PublicProduct[];
    compositeProducts: PublicCompositeProduct[];
}

export interface PublicCompositeProduct {
    id: string;
    _grupoId: number;
    _isComposite: true;
    _tipo: string;
    nome: string;
    descricao: string;
    imagem: string;
    tipo_calculo: string;
    cobrar_mais_caro: boolean;
    minimo: number;
    maximo: number;
    preco_fixo: number;
    completamentos_ids: number[];
    categoria_id?: number | string | null;
    items: PublicGroupItem[];
}

export interface PublicMenuData {
    empresa: PublicEmpresa;
    grouped: PublicCategory[];
    compositeProducts: PublicCompositeProduct[];
    upsellProducts: PublicProduct[];
    loyaltyConfig: {
        empresa_id: number;
        pontos_por_real: number;
        valor_ponto: number;
        pontos_para_desconto: number;
        desconto_tipo: string;
        desconto_valor: number;
        ativo: boolean;
    };
    allGroups: PublicGroup[];
}

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================

/**
 * Busca todos os dados necessários para renderizar o cardápio público de uma empresa.
 */
export async function getPublicMenu(slug: string): Promise<PublicMenuData | null> {
    try {
        // ── 1. Buscar empresa ──────────────────────────────────────────────────────────
        let empresa: Record<string, unknown> | null = await noco.findOne(EMPRESAS_TABLE_ID, {
            where: `(login,eq,${slug})`,
        });

        if (!empresa) {
            empresa = await noco.findOne(EMPRESAS_TABLE_ID, {
                where: `(nome_fantasia,eq,${slug})`,
            });
        }

        if (!empresa) {
            const allEmpresas = await noco.list(EMPRESAS_TABLE_ID, {
                limit: 500,
                fields: 'id,nome_fantasia,email,telefone_loja,nincho,cidade,endereco,controle_estoque,ativo,login',
            });
            empresa = (allEmpresas.list as Record<string, unknown>[]).find((e) => {
                const slugFromNome = toSlug(String(e.nome_fantasia || ''));
                const slugFromLogin = toSlug(String(e.login || ''));
                return slugFromNome === slug.toLowerCase() || slugFromLogin === slug.toLowerCase();
            }) ?? null;
        }

        if (!empresa) return null;

        const empresaId = empresa.id as number;
        const controleEstoque =
            empresa.controle_estoque === true ||
            empresa.controle_estoque === 1 ||
            empresa.controle_estoque === '1';

        // ── 2. Buscar todos os dados em paralelo ──
        const [
            productsData,
            categoriesData,
            gruposSlotsData,
            itensBaseData,
            loyaltyData,
        ] = await Promise.all([
            noco.list(PRODUTOS_TABLE_ID, {
                where: `(empresa_id,eq,${empresaId})~and(disponivel,eq,true)`,
                sort: 'ordem',
                limit: 500,
            }),
            noco.list(CATEGORIAS_TABLE_ID, {
                where: `(empresa_id,eq,${empresaId})~and(disponivel,eq,true)`,
                sort: 'ordem',
                limit: 100,
            }),
            noco.list(GRUPOS_SLOTS_TABLE_ID, {
                where: `(empresa_id,eq,${empresaId})`,
                limit: 500,
            }),
            noco.list(ITENS_BASE_TABLE_ID, {
                where: `(empresa_id,eq,${empresaId})`,
                limit: 1000,
            }),
            noco.list(LOYALTY_CONFIG_TABLE_ID, {
                where: `(empresa_id,eq,${empresaId})`,
                limit: 1,
            }),
        ]);

        // ── 3. Processar produtos ─────────────────────────────────────────────
        const rawProducts = productsData.list as Record<string, unknown>[];
        const products = controleEstoque
            ? rawProducts.filter((p) => {
                  const controlaProd = p.controla_estoque === true || p.controla_estoque === 1;
                  if (!controlaProd) return true;
                  return Number(p.quantidade_estoque ?? 0) > 0;
              })
            : rawProducts;

        // ── 4. Processar grupos/slots ─────────────────────────────────────────
        const gruposSlots = (gruposSlotsData.list as Record<string, unknown>[]).map((g) => ({
            id: g.id as number,
            nome: g.nome as string,
            descricao: g.descricao as string | undefined,
            tipo: (g.tipo as string) || 'fracionado',
            qtd_slots: Number(g.qtd_slots ?? 2),
            regra_preco: (g.regra_preco as string) || 'mais_caro',
            min_slots: Number(g.min_slots ?? 1),
            max_slots: Number(g.max_slots ?? 2),
            itens: parseJsonArray(g.itens),
            modo_preco: (g.modo_preco as string) || 'por_item',
            preco_fixo: Number(g.preco_fixo ?? 0),
            completamentos_ids: parseJsonArray(g.completamentos_ids),
            categoria_id: g.categoria_id || null,
        }));

        // ── 5. Mapear itens base ──────────────────────────────────────────────
        const itensBaseMap = new Map<number, PublicGroupItem>();
        (itensBaseData.list as Record<string, unknown>[]).forEach((item) => {
            itensBaseMap.set(item.id as number, {
                id: item.id as number,
                nome: item.nome as string,
                preco: Number(item.preco_sugerido ?? 0),
                fator_proporcao: 1,
            });
        });

        // ── 6. Montar mapa de grupos ──────────────────────────────────────────
        const gruposMap = new Map<number, PublicGroup>();
        gruposSlots.forEach((g) => {
            const groupItems = g.itens
                .map((itemId: number) => itensBaseMap.get(itemId))
                .filter(Boolean) as PublicGroupItem[];

            gruposMap.set(g.id, {
                id: g.id,
                nome: g.nome,
                tipo: g.tipo,
                minimo: g.min_slots,
                maximo: g.max_slots,
                obrigatorio: false,
                tipo_calculo:
                    g.modo_preco === 'fixo'
                        ? 'fixo'
                        : g.regra_preco === 'mais_caro'
                          ? 'maior_valor'
                          : g.regra_preco,
                cobrar_mais_caro: g.regra_preco === 'mais_caro',
                total_slots: g.qtd_slots,
                preco_fixo: g.modo_preco === 'fixo' ? g.preco_fixo : 0,
                completamentos_ids: g.completamentos_ids,
                items: groupItems,
            });
        });

        // ── 7. Associar grupos aos produtos ──────────────────────────────────────────
        const productsWithGroups: PublicProduct[] = products.map((p) => {
            const gruposRaw = p.grupos ?? p.grupos_ids ?? p.grupo_ids ?? null;
            const gruposVinculados = parseJsonArray(gruposRaw);
            
            const saborGroups: PublicGroup[] = [];
            const additionalGroups: PublicGroup[] = [];

            gruposVinculados.forEach((grupoId: number) => {
                const g = gruposMap.get(grupoId);
                if (!g) return;

                if (g.tipo === 'fracionado') {
                    saborGroups.push(g);
                } else {
                    if (!additionalGroups.find((ag) => ag.id === g.id)) {
                        additionalGroups.push(g);
                    }
                }

                g.completamentos_ids.forEach((compId: number) => {
                    const compGroup = gruposMap.get(compId);
                    if (compGroup && !additionalGroups.find((ag) => ag.id === compGroup.id)) {
                        additionalGroups.push(compGroup);
                    }
                });
            });

            const imagemRaw = (p.imagem_url || p.imagem) as string | null | undefined;
            const imagem = imagemRaw && imagemRaw.startsWith('http') ? imagemRaw : null;

            return {
                id: p.id as number,
                nome: p.nome as string,
                descricao: p.descricao as string | undefined,
                preco: Number(p.preco ?? 0),
                preco_original: p.preco_original ? Number(p.preco_original) : undefined,
                imagem,
                disponivel: p.disponivel !== false,
                destaque: p.destaque === true || p.destaque === 1,
                ordem: Number(p.ordem ?? 0),
                tamanhos: p.tamanhos as string | null | undefined,
                saborGroups,
                additionalGroups,
                complementGroups: [...saborGroups, ...additionalGroups],
            };
        });

        // ── 8. Processar produtos compostos ─────────────────────────────────────
        const allCompositeProducts: PublicCompositeProduct[] = gruposSlots
            .filter((g) => g.tipo === 'fracionado' && g.itens.length > 0)
            .map((g) => {
                const groupData = gruposMap.get(g.id)!;
                return {
                    id: `composite-${g.id}`,
                    _grupoId: g.id,
                    _isComposite: true as const,
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
                    categoria_id: g.categoria_id as string | number | null,
                    items: groupData.items,
                };
            });

        // ── 9. Agrupar por categoria ──────────────────────────────────────────
        const categories = categoriesData.list as Record<string, unknown>[];
        const groupedFinal: PublicCategory[] = categories
            .map((cat) => ({
                id: cat.id as number,
                name: cat.nome as string,
                icone: cat.icone as string | null,
                cor: cat.cor as string | null,
                ordem: Number(cat.ordem ?? 0),
                products: productsWithGroups.filter(
                    (p) => {
                        const raw = products.find((r) => r.id === p.id) as Record<string, any>;
                        const catId = raw?.categorias ?? raw?.categoria_id;
                        const finalId = (typeof catId === 'object' && catId !== null) ? (catId.id || catId.Id) : catId;
                        return String(finalId || '') === String(cat.id);
                    }
                ),
                compositeProducts: allCompositeProducts.filter(
                    (cp) => {
                        const catId = cp.categoria_id;
                        if (!catId) return false;
                        const finalId = (typeof catId === 'object' && catId !== null) ? ((catId as any).id || (catId as any).Id) : catId;
                        return String(finalId || '') === String(cat.id);
                    }
                )
            }))
            .filter((g) => g.products.length > 0 || g.compositeProducts.length > 0);

        // Produtos compostos sem categoria (Vão para "Monte seu Pedido")
        const unassignedComposites = allCompositeProducts.filter(cp => {
            const catId = cp.categoria_id;
            if (!catId) return true;
            
            // Se for objeto (NocoDB Link), pega o id
            const finalId = (typeof catId === 'object' && catId !== null) 
                ? (catId as any).id || (catId as any).Id 
                : catId;
                
            return !finalId;
        });
        
        // Produtos normais sem categoria
        const categorizedIds = new Set(
            products
                .filter((p) => {
                    const catId = (p.categorias ?? p.categoria_id) as unknown;
                    return categories.find((c) => String(c.id) === String(catId));
                })
                .map((p) => p.id as number)
        );
        const uncategorized = productsWithGroups.filter((p) => !categorizedIds.has(p.id));

        // Adicionar seção "Monte seu Pedido" se houver compostos não atribuídos
        if (unassignedComposites.length > 0) {
            groupedFinal.unshift({
                id: 'composites-default',
                name: 'Monte seu Pedido',
                icone: '🍕',
                cor: null,
                ordem: -10,
                products: [],
                compositeProducts: unassignedComposites
            });
        }

        // Adicionar "Outros" se houver produtos normais não atribuídos
        if (uncategorized.length > 0) {
            groupedFinal.push({
                id: 0,
                name: 'Outros',
                icone: null,
                cor: null,
                ordem: 9999,
                products: uncategorized,
                compositeProducts: []
            });
        }

        // ── 10. Configuração de fidelidade ────────────────────────────────────
        const loyaltyConfig = (loyaltyData.list[0] as Record<string, unknown>) ?? {
            empresa_id: empresaId,
            pontos_por_real: 1,
            valor_ponto: 0.1,
            pontos_para_desconto: 100,
            desconto_tipo: 'valor_fixo',
            desconto_valor: 10,
            ativo: false,
        };

        // ── 11. Produtos em destaque (upsell) ─────────────────────────────────
        const upsellProducts = productsWithGroups
            .filter((p) => p.destaque)
            .slice(0, 4);

        // ── 12. Retornar dados estruturados ───────────────────────────────────
        return {
            empresa: {
                id: empresaId,
                nome: (empresa.nome_fantasia as string) || '',
                telefone: (empresa.telefone_loja as string) || null,
                nincho: (empresa.nincho as string) || null,
                slug: (empresa.login as string) || null,
                cidade: (empresa.cidade as string) || null,
                endereco: (empresa.endereco as string) || null,
                logo: (empresa.logo as string) || null,
            },
            grouped: groupedFinal,
            compositeProducts: allCompositeProducts,
            upsellProducts,
            loyaltyConfig: {
                empresa_id: loyaltyConfig.empresa_id as number,
                pontos_por_real: Number(loyaltyConfig.pontos_por_real ?? 1),
                valor_ponto: Number(loyaltyConfig.valor_ponto ?? 0.1),
                pontos_para_desconto: Number(loyaltyConfig.pontos_para_desconto ?? 100),
                desconto_tipo: (loyaltyConfig.desconto_tipo as string) || 'valor_fixo',
                desconto_valor: Number(loyaltyConfig.desconto_valor ?? 10),
                ativo: loyaltyConfig.ativo === true || loyaltyConfig.ativo === 1,
            },
            allGroups: Array.from(gruposMap.values()),
        };
    } catch (error) {
        console.error('[getPublicMenu] Erro ao carregar cardápio:', error);
        return null;
    }
}
