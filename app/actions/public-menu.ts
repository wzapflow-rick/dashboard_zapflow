'use server';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const EMPRESAS_TABLE_ID = 'mrlxbm1guwn9iv8';
const PRODUCTS_TABLE_ID = 'mu3kfx4zilr5401';
const CATEGORIES_TABLE_ID = 'mv81fy54qtamim2';
const GRUPOS_TABLE_ID = 'mqo0m1qpbxueoox';
const COMPLEMENTOS_TABLE_ID = 'mde9hhb5oho8dsv';
const P_GRUPOS_TABLE_ID = 'mm1zymth858by6q';

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

export async function getPublicMenu(slug: string) {
    try {
        // Find company by slug (match normalized nome_fantasia)
        const empresasData = await nocoFetch(EMPRESAS_TABLE_ID, '/records?limit=200');
        if (!empresasData?.list) return null;

        const empresa = empresasData.list.find((e: any) => {
            const nomeSlug = toSlug(e.nome_fantasia || '');
            return nomeSlug === slug || e.slug === slug;
        });

        if (!empresa) return null;

        // Fetch products and categories for this company
        const [productsData, categoriesData, produtoGruposData, gruposData, complementosData] = await Promise.all([
            nocoFetch(PRODUCTS_TABLE_ID, `/records?where=(empresa_id,eq,${empresa.id})&limit=500`),
            nocoFetch(CATEGORIES_TABLE_ID, `/records?where=(empresa_id,eq,${empresa.id})&limit=100`),
            nocoFetch(P_GRUPOS_TABLE_ID, '/records?limit=1000'), // We might need to filter this by product IDs later if it's too big
            nocoFetch(GRUPOS_TABLE_ID, '/records?limit=200'),
            nocoFetch(COMPLEMENTOS_TABLE_ID, '/records?limit=1000'),
        ]);

        const products = (productsData?.list || []).filter((p: any) => p.disponivel !== false);
        const categories = categoriesData?.list || [];
        const produtoGrupos = produtoGruposData?.list || [];
        const grupos = gruposData?.list || [];
        const complementos = complementosData?.list || [];

        // Attach groups and items to each product
        const productsWithComplements = products.map((p: any) => {
            const linkedGroupIds = produtoGrupos
                .filter((pg: any) => pg.produto_id === p.id)
                .map((pg: any) => pg.grupo_id);

            const productGroups = grupos
                .filter((g: any) => linkedGroupIds.includes(g.id))
                .map((g: any) => ({
                    ...g,
                    items: complementos
                        .filter((c: any) => c.grupo_id === g.id)
                        .map((c: any) => ({ ...c, id: c.Id || c.id })) // Normalize ID
                }));

            return { ...p, complementGroups: productGroups };
        });

        // Group products by category
        const grouped = categories
            .map((cat: any) => ({
                id: cat.id,
                name: cat.nome,
                products: productsWithComplements.filter((p: any) => p.categoria_id === cat.id),
            }))
            .filter((g: any) => g.products.length > 0);

        // Uncategorized products
        const uncategorized = productsWithComplements.filter(
            (p: any) => !categories.find((c: any) => c.id === p.categoria_id)
        );
        if (uncategorized.length > 0) {
            grouped.push({ id: 0, name: 'Outros', products: uncategorized });
        }

        return {
            empresa: {
                nome: empresa.nome_fantasia,
                telefone: empresa.telefone || empresa.login || '',
                nincho: empresa.nincho || '',
            },
            grouped,
            slug,
        };
    } catch (err) {
        console.error('getPublicMenu error:', err);
        return null;
    }
}
