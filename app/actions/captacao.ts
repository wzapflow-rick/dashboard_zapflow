'use server';

import { pg } from '@/lib/postgres';
import { importarContato } from '@/app/actions/remarketing';

// ---------------------------------------------------------------------------
// Captacao de Delivery ATIVO via Google Places API (New)
// Busca lojas de delivery por cidade + tipo de comida, filtra leads bons
// (operante + com telefone + com avaliacoes) e joga no funil de remarketing.
// ---------------------------------------------------------------------------

const CAPTACAO_TABLE = 'captacao_places';
const PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';

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

interface GooglePlace {
    id: string;
    displayName?: { text?: string };
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    formattedAddress?: string;
    rating?: number;
    userRatingCount?: number;
    primaryTypeDisplayName?: { text?: string };
    googleMapsUri?: string;
    businessStatus?: string;
}

/** Converte telefone nacional (ex "(79) 99804-9790") em digitos com DDI 55. */
function montarWhatsApp(telefone: string | null | undefined): { remote_jid: string; telefone: string } | null {
    if (!telefone) return null;
    let digitos = telefone.replace(/\D/g, '');
    // remove DDI se ja vier com 55 na frente (numeros internacionais)
    if (digitos.startsWith('55') && digitos.length > 11) {
        digitos = digitos.slice(2);
    }
    // precisa ter DDD (2) + numero (8 ou 9 digitos)
    if (digitos.length < 10 || digitos.length > 11) return null;
    const comDdi = `55${digitos}`;
    return { remote_jid: `${comDdi}@s.whatsapp.net`, telefone: comDdi };
}

/**
 * Busca lojas no Google Places por cidade + termo (tipo de comida).
 * NAO grava contatos - so retorna os leads para revisao, ja marcando
 * quais ja existem na base para evitar reimportacao.
 */
export async function buscarLeads(input: {
    cidade: string;
    tipoComida: string;
    soComTelefone?: boolean;
    minAvaliacoes?: number;
}): Promise<{ success: boolean; leads?: LeadCaptado[]; total?: number; error?: string }> {
    try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GCP_API_KEY;
        if (!apiKey) {
            return { success: false, error: 'GOOGLE_MAPS_API_KEY nao configurada no projeto.' };
        }
        if (!input.cidade.trim() || !input.tipoComida.trim()) {
            return { success: false, error: 'Informe a cidade e o tipo de comida.' };
        }

        const soComTelefone = input.soComTelefone ?? true;
        const minAvaliacoes = input.minAvaliacoes ?? 0;
        const textQuery = `${input.tipoComida.trim()} delivery em ${input.cidade.trim()}`;

        const fieldMask = [
            'places.id',
            'places.displayName',
            'places.nationalPhoneNumber',
            'places.internationalPhoneNumber',
            'places.formattedAddress',
            'places.rating',
            'places.userRatingCount',
            'places.primaryTypeDisplayName',
            'places.googleMapsUri',
            'places.businessStatus',
            'nextPageToken',
        ].join(',');

        // Busca ate 3 paginas (60 resultados) para ter volume
        const placesBrutos: GooglePlace[] = [];
        let pageToken: string | undefined;
        for (let pagina = 0; pagina < 3; pagina++) {
            const body: Record<string, unknown> = {
                textQuery,
                languageCode: 'pt-BR',
                regionCode: 'BR',
                pageSize: 20,
            };
            if (pageToken) body.pageToken = pageToken;

            const resp = await fetch(PLACES_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': fieldMask,
                },
                body: JSON.stringify(body),
            });

            if (!resp.ok) {
                const txt = await resp.text();
                console.error('[Captacao] Google Places erro:', resp.status, txt);
                let detalhe = `HTTP ${resp.status}`;
                try {
                    const j = JSON.parse(txt);
                    detalhe = j?.error?.message || detalhe;
                } catch {
                    /* ignore */
                }
                // mensagens amigaveis para os erros mais comuns
                if (resp.status === 403 || /not.*enabled|SERVICE_DISABLED|API key not valid/i.test(detalhe)) {
                    return {
                        success: false,
                        error:
                            'O Google recusou a chave. Verifique se a "Places API (New)" esta ATIVADA no projeto e se a chave permite essa API. Detalhe: ' +
                            detalhe,
                    };
                }
                return { success: false, error: 'Falha na busca do Google: ' + detalhe };
            }

            const data = (await resp.json()) as { places?: GooglePlace[]; nextPageToken?: string };
            if (data.places?.length) placesBrutos.push(...data.places);
            pageToken = data.nextPageToken;
            if (!pageToken) break;
        }

        if (placesBrutos.length === 0) {
            return { success: true, leads: [], total: 0 };
        }

        // Filtros de qualidade
        const filtrados = placesBrutos.filter((p) => {
            if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') return false;
            const tel = p.nationalPhoneNumber || p.internationalPhoneNumber;
            if (soComTelefone && !tel) return false;
            if (minAvaliacoes > 0 && (p.userRatingCount ?? 0) < minAvaliacoes) return false;
            return true;
        });

        // Dedupe contra a tabela de captacao (place_id) e remarketing (telefone)
        const placeIds = filtrados.map((p) => p.id);
        const jaCaptados = new Set<string>();
        const telefonesExistentes = new Set<string>();

        if (placeIds.length) {
            const existentes = await pg.raw<{ place_id: string }>(
                `SELECT place_id FROM "${CAPTACAO_TABLE}" WHERE place_id = ANY($1)`,
                [placeIds],
            );
            existentes.forEach((e) => jaCaptados.add(e.place_id));

            // telefones que ja estao no remarketing
            const telsBusca = filtrados
                .map((p) => montarWhatsApp(p.nationalPhoneNumber || p.internationalPhoneNumber)?.telefone)
                .filter(Boolean) as string[];
            if (telsBusca.length) {
                const remk = await pg.raw<{ telefone: string }>(
                    `SELECT telefone FROM "remarketing_contatos" WHERE telefone = ANY($1)`,
                    [telsBusca],
                );
                remk.forEach((r) => telefonesExistentes.add(r.telefone));
            }
        }

        const leads: LeadCaptado[] = filtrados.map((p) => {
            const telBruto = p.nationalPhoneNumber || p.internationalPhoneNumber || null;
            const wa = montarWhatsApp(telBruto);
            const jaExiste = jaCaptados.has(p.id) || (wa ? telefonesExistentes.has(wa.telefone) : false);
            return {
                place_id: p.id,
                nome: p.displayName?.text || 'Sem nome',
                telefone: telBruto,
                endereco: p.formattedAddress || null,
                rating: p.rating ?? null,
                total_avaliacoes: p.userRatingCount ?? null,
                tipo: p.primaryTypeDisplayName?.text || null,
                google_maps_uri: p.googleMapsUri || null,
                jaExiste,
            };
        });

        // ordena: novos primeiro, depois por numero de avaliacoes
        leads.sort((a, b) => {
            if (a.jaExiste !== b.jaExiste) return a.jaExiste ? 1 : -1;
            return (b.total_avaliacoes ?? 0) - (a.total_avaliacoes ?? 0);
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

            // joga no funil de remarketing
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

            // grava/atualiza na tabela de captacao para dedupe futuro
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
