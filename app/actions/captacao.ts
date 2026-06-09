'use server';

import { pg } from '@/lib/postgres';
import { importarContato } from '@/app/actions/remarketing';

// ---------------------------------------------------------------------------
// Captacao de Delivery ATIVO via OpenStreetMap (Nominatim + Overpass) - GRATIS
// Busca lojas de comida por cidade + tipo, filtra leads com telefone e joga
// no funil de remarketing. Nao usa chave de API nem cobranca.
// ---------------------------------------------------------------------------

const CAPTACAO_TABLE = 'captacao_places';
const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
// User-Agent obrigatorio pela politica de uso do Nominatim/Overpass
const HTTP_UA = 'ZapFlow-Captacao/1.0 (contato@zapflow.app)';

export interface LeadCaptado {
    place_id: string;
    nome: string;
    telefone: string | null;
    endereco: string | null;
    rating: number | null;
    total_avaliacoes: number | null;
    tipo: string | null;
    google_maps_uri: string | null;
    /** ja existe na base (captacao ou remarketing) */
    jaExiste: boolean;
}

interface OsmElement {
    type: 'node' | 'way' | 'relation';
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
}

/** Remove acentos e baixa caixa para comparacoes tolerantes. */
function normalizar(txt: string): string {
    return txt
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Mapa de termos digitados (em pt-BR) -> palavras que aparecem em name/cuisine
 * do OpenStreetMap. Deixa a busca tolerante a sinonimos.
 */
const SINONIMOS: Record<string, string[]> = {
    pizza: ['pizza', 'pizzaria'],
    pizzaria: ['pizza', 'pizzaria'],
    hamburguer: ['burger', 'hamburguer', 'hamburgueria', 'lanche'],
    hamburgueria: ['burger', 'hamburguer', 'hamburgueria', 'lanche'],
    lanche: ['burger', 'hamburguer', 'lanche', 'lanchonete', 'sandwich'],
    lanchonete: ['lanche', 'lanchonete', 'sandwich', 'burger'],
    acai: ['acai', 'ice_cream', 'sorvete'],
    sorvete: ['ice_cream', 'sorvete', 'gelato', 'acai'],
    sushi: ['sushi', 'japanese', 'japones'],
    japones: ['sushi', 'japanese', 'japones'],
    japonesa: ['sushi', 'japanese', 'japones'],
    pastel: ['pastel', 'pastelaria'],
    pastelaria: ['pastel', 'pastelaria'],
    churrasco: ['churrasco', 'barbecue', 'bbq', 'steak', 'grill'],
    marmita: ['marmita', 'comida', 'restaurant', 'self_service', 'brazilian'],
    comida: ['comida', 'restaurant', 'brazilian', 'regional'],
    cafe: ['cafe', 'coffee', 'cafeteria'],
    cafeteria: ['cafe', 'coffee', 'cafeteria'],
    doce: ['doce', 'doceria', 'confeitaria', 'dessert', 'cake'],
    confeitaria: ['confeitaria', 'doceria', 'cake', 'dessert', 'bakery'],
    padaria: ['padaria', 'bakery', 'pao'],
    espetinho: ['espetinho', 'espeto', 'barbecue', 'grill'],
    tapioca: ['tapioca', 'crepe'],
};

/** Tokens de busca a partir do termo digitado (termo + sinonimos conhecidos). */
function tokensDeBusca(termo: string): string[] {
    const base = normalizar(termo);
    const partes = base.split(/\s+/).filter(Boolean);
    const tokens = new Set<string>([base, ...partes]);
    for (const p of partes) {
        const syn = SINONIMOS[p];
        if (syn) syn.forEach((s) => tokens.add(s));
    }
    return [...tokens].filter((t) => t.length >= 3);
}

/** Verifica se o estabelecimento bate com o termo (em name ou cuisine). */
function combinaComTermo(tags: Record<string, string>, tokens: string[]): boolean {
    if (tokens.length === 0) return true;
    const alvo = normalizar(
        [tags.name, tags.cuisine, tags.amenity, tags['cuisine:type']].filter(Boolean).join(' '),
    );
    return tokens.some((t) => alvo.includes(t));
}

/** Monta o endereco a partir das tags addr:* do OSM. */
function montarEndereco(tags: Record<string, string>): string | null {
    const rua = tags['addr:street'];
    const numero = tags['addr:housenumber'];
    const bairro = tags['addr:suburb'] || tags['addr:neighbourhood'];
    const cidade = tags['addr:city'];
    const partes = [
        [rua, numero].filter(Boolean).join(', '),
        bairro,
        cidade,
    ].filter(Boolean);
    return partes.length ? partes.join(' - ') : null;
}

/** Converte telefone em digitos com DDI 55 + remote_jid de WhatsApp. */
function montarWhatsApp(telefone: string | null | undefined): { remote_jid: string; telefone: string } | null {
    if (!telefone) return null;
    // pode vir varios numeros separados por ; - pega o primeiro
    const primeiro = telefone.split(';')[0];
    let digitos = primeiro.replace(/\D/g, '');
    if (digitos.startsWith('55') && digitos.length > 11) {
        digitos = digitos.slice(2);
    }
    if (digitos.length < 10 || digitos.length > 11) return null;
    const comDdi = `55${digitos}`;
    return { remote_jid: `${comDdi}@s.whatsapp.net`, telefone: comDdi };
}

/** Pega o melhor telefone disponivel nas tags. */
function extrairTelefone(tags: Record<string, string>): string | null {
    return (
        tags.phone ||
        tags['contact:phone'] ||
        tags['contact:mobile'] ||
        tags.mobile ||
        tags['phone:mobile'] ||
        null
    );
}

/**
 * Busca lojas no OpenStreetMap por cidade + termo (tipo de comida).
 * 1) Geocodifica a cidade no Nominatim para obter a bounding box.
 * 2) Busca estabelecimentos de comida nessa area via Overpass.
 * NAO grava nada - so retorna os leads, marcando os que ja existem.
 */
export async function buscarLeads(input: {
    cidade: string;
    tipoComida: string;
    soComTelefone?: boolean;
    minAvaliacoes?: number;
}): Promise<{ success: boolean; leads?: LeadCaptado[]; total?: number; error?: string }> {
    try {
        if (!input.cidade.trim() || !input.tipoComida.trim()) {
            return { success: false, error: 'Informe a cidade e o tipo de comida.' };
        }

        const soComTelefone = input.soComTelefone ?? true;

        // 1) Geocodifica a cidade -> bounding box
        const geoUrl =
            `${NOMINATIM_ENDPOINT}?` +
            new URLSearchParams({
                q: input.cidade.trim(),
                format: 'json',
                limit: '1',
                countrycodes: 'br',
                'accept-language': 'pt-BR',
            }).toString();

        const geoResp = await fetch(geoUrl, {
            headers: { 'User-Agent': HTTP_UA, Accept: 'application/json' },
        });
        if (!geoResp.ok) {
            return { success: false, error: 'Falha ao localizar a cidade no mapa. Tente novamente em instantes.' };
        }
        const geoData = (await geoResp.json()) as Array<{ boundingbox?: string[]; display_name?: string }>;
        if (!geoData.length || !geoData[0].boundingbox) {
            return { success: false, error: `Cidade "${input.cidade}" nao encontrada. Tente "Cidade, UF".` };
        }
        // boundingbox = [south, north, west, east]
        const [south, north, west, east] = geoData[0].boundingbox.map(Number);

        // 2) Busca estabelecimentos de comida na bbox via Overpass
        const amenities = 'restaurant|fast_food|cafe|ice_cream|bar|food_court';
        const bbox = `${south},${west},${north},${east}`;
        const query = `
            [out:json][timeout:25];
            (
              node["amenity"~"^(${amenities})$"](${bbox});
              way["amenity"~"^(${amenities})$"](${bbox});
            );
            out tags center 250;
        `.trim();

        const overpassResp = await fetch(OVERPASS_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': HTTP_UA },
            body: 'data=' + encodeURIComponent(query),
        });

        if (!overpassResp.ok) {
            const txt = await overpassResp.text();
            console.error('[Captacao] Overpass erro:', overpassResp.status, txt.slice(0, 300));
            if (overpassResp.status === 429) {
                return {
                    success: false,
                    error: 'O servidor de mapas esta ocupado (muitas buscas). Aguarde alguns segundos e tente de novo.',
                };
            }
            return { success: false, error: 'Falha na busca de estabelecimentos. Tente novamente.' };
        }

        const overpassData = (await overpassResp.json()) as { elements?: OsmElement[] };
        const elementos = overpassData.elements ?? [];
        if (elementos.length === 0) {
            return { success: true, leads: [], total: 0 };
        }

        const tokens = tokensDeBusca(input.tipoComida);

        // Filtros: bate com o termo + (opcional) tem telefone
        const filtrados = elementos.filter((el) => {
            const tags = el.tags;
            if (!tags || !tags.name) return false;
            if (!combinaComTermo(tags, tokens)) return false;
            if (soComTelefone && !extrairTelefone(tags)) return false;
            return true;
        });

        if (filtrados.length === 0) {
            return { success: true, leads: [], total: 0 };
        }

        // place_id estavel: "osm:node:123"
        const placeIdDe = (el: OsmElement) => `osm:${el.type}:${el.id}`;
        const placeIds = filtrados.map(placeIdDe);

        // Dedupe contra captacao (place_id) e remarketing (telefone)
        const jaCaptados = new Set<string>();
        const telefonesExistentes = new Set<string>();

        if (placeIds.length) {
            const existentes = await pg.raw<{ place_id: string }>(
                `SELECT place_id FROM "${CAPTACAO_TABLE}" WHERE place_id = ANY($1)`,
                [placeIds],
            );
            existentes.forEach((e) => jaCaptados.add(e.place_id));

            const telsBusca = filtrados
                .map((el) => montarWhatsApp(extrairTelefone(el.tags!))?.telefone)
                .filter(Boolean) as string[];
            if (telsBusca.length) {
                const remk = await pg.raw<{ telefone: string }>(
                    `SELECT telefone FROM "remarketing_contatos" WHERE telefone = ANY($1)`,
                    [telsBusca],
                );
                remk.forEach((r) => telefonesExistentes.add(r.telefone));
            }
        }

        const leads: LeadCaptado[] = filtrados.map((el) => {
            const tags = el.tags!;
            const place_id = placeIdDe(el);
            const telBruto = extrairTelefone(tags);
            const wa = montarWhatsApp(telBruto);
            const jaExiste = jaCaptados.has(place_id) || (wa ? telefonesExistentes.has(wa.telefone) : false);
            const lat = el.lat ?? el.center?.lat;
            const lon = el.lon ?? el.center?.lon;
            const mapsUri =
                lat != null && lon != null
                    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
                    : null;
            return {
                place_id,
                nome: tags.name || 'Sem nome',
                telefone: telBruto,
                endereco: montarEndereco(tags),
                rating: null, // OpenStreetMap nao tem avaliacoes
                total_avaliacoes: null,
                tipo: tags.cuisine ? tags.cuisine.split(';')[0].replace(/_/g, ' ') : tags.amenity?.replace(/_/g, ' ') || null,
                google_maps_uri: mapsUri,
                jaExiste,
            };
        });

        // novos primeiro, depois com telefone, depois alfabetico
        leads.sort((a, b) => {
            if (a.jaExiste !== b.jaExiste) return a.jaExiste ? 1 : -1;
            if (!!a.telefone !== !!b.telefone) return a.telefone ? -1 : 1;
            return a.nome.localeCompare(b.nome);
        });

        return { success: true, leads, total: leads.length };
    } catch (error) {
        console.error('[Captacao] Erro ao buscar leads:', error);
        return { success: false, error: 'Erro interno ao buscar leads.' };
    }
}

/**
 * Importa os leads selecionados: grava na tabela de captacao (dedupe) e joga
 * no funil de remarketing via importarContato (origem "captacao").
 */
export async function importarLeads(input: {
    cidade: string;
    tipoComida: string;
    leads: LeadCaptado[];
}): Promise<{ success: boolean; importados?: number; pulados?: number; error?: string }> {
    try {
        if (!input.leads?.length) {
            return { success: false, error: 'Selecione ao menos um lead.' };
        }

        let importados = 0;
        let pulados = 0;

        for (const lead of input.leads) {
            const wa = montarWhatsApp(lead.telefone);
            if (!wa) {
                pulados++;
                continue;
            }

            const res = await importarContato({
                remote_jid: wa.remote_jid,
                telefone: wa.telefone,
                nome: lead.nome,
                origem: 'captacao',
            });
            if (!res.success) {
                pulados++;
                continue;
            }

            const existente = await pg.findOne<{ id: number }>(CAPTACAO_TABLE, {
                where: { place_id: lead.place_id },
            });
            const agora = new Date().toISOString();
            if (existente) {
                await pg.update(CAPTACAO_TABLE, existente.id, {
                    status: 'importado',
                    importado_em: agora,
                    updated_at: agora,
                });
            } else {
                await pg.create(CAPTACAO_TABLE, {
                    place_id: lead.place_id,
                    nome: lead.nome,
                    telefone: wa.telefone,
                    endereco: lead.endereco,
                    rating: lead.rating,
                    total_avaliacoes: lead.total_avaliacoes,
                    tipo: lead.tipo,
                    google_maps_uri: lead.google_maps_uri,
                    cidade_busca: input.cidade,
                    termo_busca: input.tipoComida,
                    status: 'importado',
                    importado_em: agora,
                    created_at: agora,
                    updated_at: agora,
                });
            }
            importados++;
        }

        return { success: true, importados, pulados };
    } catch (error) {
        console.error('[Captacao] Erro ao importar leads:', error);
        return { success: false, error: 'Erro interno ao importar leads.' };
    }
}
