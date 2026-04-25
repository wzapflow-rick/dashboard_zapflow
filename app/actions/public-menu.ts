'use server';

import { noco } from '@/lib/nocodb';
import {
    EMPRESAS_TABLE_ID,
    PRODUTOS_TABLE_ID,
    CATEGORIAS_TABLE_ID,
    GRUPOS_SLOTS_TABLE_ID,
    ITENS_BASE_TABLE_ID,
    LOYALTY_CONFIG_TABLE_ID,
    CONFIGURACOES_LOJA_TABLE_ID,
} from '@/lib/constants';

// ============================================================
// HELPERS
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
    banner?: string | null;
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
    categoria_id?: number | string | null;
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
        const targetSlug = slug.toLowerCase();

        // ── 1. Buscar empresa ──────────────────────────────────────────────────────────
        // Tentativa 1: Busca direta por login (email) ou nome_fantasia exato
        let empresa: Record<string, unknown> | null = await noco.findOne(EMPRESAS_TABLE_ID, {
            where: `(login,eq,${slug})~or(nome_fantasia,eq,${slug})`,
        });

        // Tentativa 2: Busca por slug gerado a partir do nome_fantasia
        if (!empresa) {
            const allEmpresas = await noco.list(EMPRESAS_TABLE_ID, {
                limit: 1000,
                fields: 'id,nome_fantasia,email,telefone_loja,nincho,cidade,endereco,controle_estoque,ativo,login',
            });
            
            empresa = (allEmpresas.list as Record<string, unknown>[]).find((e) => {
                const slugFromNome = toSlug(String(e.nome_fantasia || ''));
                const slugFromLogin = toSlug(String(e.login || ''));
                return slugFromNome === targetSlug || slugFromLogin === targetSlug;
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
            extraConfigData,
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
            noco.findOne(CONFIGURACOES_LOJA_TABLE_ID, {
                where: `(Empresa ID,eq,${empresaId})`
            }),
        ]);

        // ── 3. Processar empresa com logo ────────────────────────────────────
        const publicEmpresa: PublicEmpresa = {
            id: empresaId,
            nome: (empresa.nome_fantasia as string) || (empresa.nome_admin as string) || 'Minha Loja',
            telefone: (empresa.telefone_loja as string) || null,
            nincho: (empresa.nincho as string) || null,
            slug: slug,
            cidade: (empresa.cidade as string) || null,
            endereco: (empresa.endereco as string) || null,
            logo: (extraConfigData?.Logo as string) || (empresa.logo as string) || null,
            banner: (extraConfigData?.banner as string) || (extraConfigData?.Banner as string) || (empresa.banner as string) || null,
        };

        // ── 4. Processar produtos ─────────────────────────────────────────────
        const rawProducts = productsData.list as Record<string, unknown>[];
        const products = controleEstoque
            ? rawProducts.filter((p) => {
                  const controlaProd = p.controla_estoque === true || p.controla_estoque === 1;
                  if (!controlaProd) return true;
                  return Number(p.quantidade_estoque ?? 0) > 0;
              })
            : rawProducts;

        // ── 5. Processar grupos/slots ─────────────────────────────────────────
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

        // ── 6. Mapear itens base ──────────────────────────────────────────────
        const itensBaseMap = new Map<number, PublicGroupItem>();
        (itensBaseData.list as Record<string, unknown>[]).forEach((item) => {
            itensBaseMap.set(item.id as number, {
                id: item.id as number,
                nome: item.nome as string,
                preco: Number(item.preco_sugerido ?? 0),
                fator_proporcao: 1,
            });
        });

        // ── 7. Montar mapa de grupos ──────────────────────────────────────────
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

        // ── 8. Associar grupos aos produtos ──────────────────────────────────────────
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
                    if (compGroup && !additionalGroups.find((ag) => ag.id === compId)) {
                        additionalGroups.push(compGroup);
                    }
                });
            });

            return {
                id: p.id as number,
                nome: p.nome as string,
                descricao: p.descricao as string | undefined,
                preco: Number(p.preco ?? 0),
                preco_original: Number(p.preco_original ?? 0),
                imagem: (p.imagem as string) || (p.imagem_url as string) || null,
                disponivel: true,
                destaque: p.destaque === true || p.destaque === 1,
                ordem: Number(p.ordem ?? 0),
                tamanhos: p.tamanhos as string | null,
                categoria_id: (p.categoria_id as number | string | null) || null,
                saborGroups,
                additionalGroups,
                complementGroups: [],
            };
        });

        // ── 9. Agrupar por categoria ─────────────────────────────────────────
        const categories = (categoriesData.list as Record<string, unknown>[]).map((c) => ({
            id: c.id as number,
            name: c.nome as string,
            icone: c.icone as string | null,
            cor: c.cor as string | null,
            ordem: Number(c.ordem ?? 0),
            products: productsWithGroups.filter((p) => {
                const pCatId = p.categoria_id ?? (rawProducts.find(rp => rp.id === p.id)?.categoria_id);
                return Number(pCatId) === Number(c.id);
            }),
            compositeProducts: [],
        }));

        // ── 10. Produtos compostos (Upsell / Destaques) ──────────────────────
        const compositeProducts: PublicCompositeProduct[] = productsWithGroups
            .filter(p => p.destaque)
            .map(p => ({
                id: String(p.id),
                _grupoId: 0,
                _isComposite: true,
                _tipo: 'destaque',
                nome: p.nome,
                descricao: p.descricao || '',
                imagem: p.imagem || '',
                tipo_calculo: 'soma',
                cobrar_mais_caro: false,
                minimo: 0,
                maximo: 0,
                preco_fixo: p.preco,
                completamentos_ids: [],
                items: [],
            }));

        return {
            empresa: publicEmpresa,
            grouped: categories.sort((a, b) => a.ordem - b.ordem),
            compositeProducts: [],
            upsellProducts: productsWithGroups.filter(p => p.destaque),
            loyaltyConfig: {
                empresa_id: empresaId,
                pontos_por_real: Number(loyaltyData.list[0]?.pontos_por_real ?? 1),
                valor_ponto: Number(loyaltyData.list[0]?.valor_ponto ?? 0.1),
                pontos_para_desconto: Number(loyaltyData.list[0]?.pontos_para_desconto ?? 100),
                desconto_tipo: (loyaltyData.list[0]?.desconto_tipo as string) || 'valor_fixo',
                desconto_valor: Number(loyaltyData.list[0]?.desconto_valor ?? 10),
                ativo: !!loyaltyData.list[0]?.ativo,
            },
            allGroups: Array.from(gruposMap.values()),
        };
    } catch (error) {
        console.error('API Error (getPublicMenu):', error);
        return null;
    }
}
