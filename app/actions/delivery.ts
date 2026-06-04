'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from '@/lib/session-server';
import { pg } from '@/lib/postgres';
import { TAXAS_ENTREGA_TABLE, EMPRESAS_TABLE } from '@/lib/tables';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

export async function getDeliveryRates() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const data = await pg.list(TAXAS_ENTREGA_TABLE, {
            where: { empresa_id: user.empresaId },
            limit: 1000,
        });
        return data.list || [];
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to fetch delivery rates');
    }
}

export async function upsertDeliveryRate(data: any) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const sanitizedData = {
            ...data,
            valor_taxa: typeof data.valor_taxa === 'string' 
                ? (parseFloat(data.valor_taxa.replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.').trim()) || 0)
                : Number(data.valor_taxa || 0),
            empresa_id: Number(user.empresaId)
        };

        const recordId = data.id;

        let result;
        if (recordId) {
            const { empresa_id, ...updatePayload } = sanitizedData;
            result = await pg.update(TAXAS_ENTREGA_TABLE, { id: recordId, ...updatePayload });
        } else {
            const { id, ...insertData } = sanitizedData;
            result = await pg.create(TAXAS_ENTREGA_TABLE, {
                ...insertData,
                empresa_id: Number(user.empresaId)
            });
        }

        return result;
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to save delivery rate');
    }
}

export async function deleteDeliveryRate(id: number) {
    try {
        await pg.delete(TAXAS_ENTREGA_TABLE, id);
        revalidatePath('/dashboard/settings');
        return { success: true };
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to delete delivery rate');
    }
}

// ==================== GOOGLE MAPS INTEGRATION ====================

interface DeliveryCalculationResult {
    success: boolean;
    distance_km?: number;
    duration_min?: number;
    taxa_entrega?: number;
    error?: string;
}

interface DeliveryConfig {
    auto_radius: boolean;
    valor_por_km: number;
    taxa_entrega_fixa: number;
    lat_loja: number;
    lng_loja: number;
    raio_maximo_km: number;
}

export async function getDeliveryConfig(empresaId?: number): Promise<DeliveryConfig | null> {
    try {
        let targetEmpresaId = empresaId;

        if (!targetEmpresaId) {
            const user = await getMe();
            targetEmpresaId = user?.empresaId;
        }

        if (!targetEmpresaId) {
            console.error('getDeliveryConfig: No empresaId provided or found in session');
            return null;
        }

        const config = await pg.findById(EMPRESAS_TABLE, targetEmpresaId) as any;
        if (!config) return null;

        return {
            auto_radius: !!config.raio_entrega_automatico,
            valor_por_km: Number(config.valor_por_km || 0),
            taxa_entrega_fixa: Number(config.taxa_entrega_fixa || 0),
            lat_loja: config.lat_loja ? Number(config.lat_loja) : 0,
            lng_loja: config.lng_loja ? Number(config.lng_loja) : 0,
            raio_maximo_km: Number(config.raio_maximo_km || 10),
        };
    } catch (error) {
        console.error('getDeliveryConfig error:', error);
        return null;
    }
}

async function getDistanceFromGoogle(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
): Promise<{ distance_km: number; duration_min: number }> {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url, {
        next: { revalidate: 3600 },
        headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();

    if (data.status !== 'OK') {
        throw new Error(`Google Maps API Error: ${data.status}`);
    }

    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') {
        throw new Error('Não foi possível calcular a distância');
    }

    return {
        distance_km: element.distance.value / 1000,
        duration_min: Math.ceil(element.duration.value / 60)
    };
}

export async function getDeliveryRateByBairro(empresaId: number, bairro: string): Promise<{ taxa: number; tempo_estimado: string } | null> {
    try {
        if (!bairro || !empresaId) return null;
        
        const bairroNormalizado = bairro.trim().toLowerCase();
        console.log(`[Delivery] Buscando taxa para bairro: "${bairroNormalizado}" | Empresa: ${empresaId}`);
        
        const data = await pg.list(TAXAS_ENTREGA_TABLE, {
            where: { empresa_id: empresaId },
            limit: 1000,
        });
        
        const taxas = data.list || [];
        console.log(`[Delivery] Taxas encontradas: ${taxas.length}`);
        
        let match = taxas.find((t: any) => 
            t.bairro && t.bairro.trim().toLowerCase() === bairroNormalizado
        );
        
        if (!match) {
            match = taxas.find((t: any) => 
                t.bairro && (
                    t.bairro.trim().toLowerCase().includes(bairroNormalizado) ||
                    bairroNormalizado.includes(t.bairro.trim().toLowerCase())
                )
            );
        }
        
        if (match) {
            console.log(`[Delivery] Taxa encontrada: R$ ${match.valor_taxa} | Tempo: ${match.tempo_estimado}`);
            return {
                taxa: Number(match.valor_taxa) || 0,
                tempo_estimado: String(match.tempo_estimado || '')
            };
        }
        
        console.log(`[Delivery] Nenhuma taxa encontrada para o bairro: ${bairro}`);
        return null;
    } catch (error) {
        console.error('getDeliveryRateByBairro error:', error);
        return null;
    }
}

export async function getAvailableBairros(empresaId: number): Promise<Array<{ bairro: string; taxa: number; tempo_estimado: string }>> {
    try {
        if (!empresaId) return [];
        
        const data = await pg.list(TAXAS_ENTREGA_TABLE, {
            where: { empresa_id: empresaId },
            limit: 1000,
        });
        
        return (data.list || []).map((t: any) => ({
            bairro: String(t.bairro || ''),
            taxa: Number(t.valor_taxa) || 0,
            tempo_estimado: String(t.tempo_estimado || '')
        })).filter((t: { bairro: string }) => t.bairro.trim() !== '');
    } catch (error) {
        console.error('getAvailableBairros error:', error);
        return [];
    }
}

export async function calculateDeliveryFee(
    destination: { lat: number; lng: number },
    empresaId?: number
): Promise<DeliveryCalculationResult> {
    try {
        if (!destination.lat || !destination.lng ||
            destination.lat < -90 || destination.lat > 90 ||
            destination.lng < -180 || destination.lng > 180) {
            return { success: false, error: 'Coordenadas inválidas' };
        }

        const config = await getDeliveryConfig(empresaId);

        if (!config) {
            return { success: false, error: 'Taxa de entrega não configurada' };
        }

        if (config.valor_por_km < 0 || config.taxa_entrega_fixa < 0) {
            console.error('Invalid delivery config: negative values detected');
            return { success: false, error: 'Configuração de entrega inválida' };
        }

        if (!config.auto_radius) {
            if (config.taxa_entrega_fixa > 0) {
                return { success: true, taxa_entrega: config.taxa_entrega_fixa };
            }
            return { success: true, taxa_entrega: 0 };
        }

        if (!config.lat_loja || !config.lng_loja) {
            return { success: false, error: 'Localização da loja não configurada. Configure no painel.' };
        }

        const origin = { lat: config.lat_loja, lng: config.lng_loja };
        const distance = await getDistanceFromGoogle(origin, destination);

        if (distance.distance_km <= 0 || distance.distance_km > 500) {
            return { success: false, error: 'Distância inválida calculada' };
        }

        if (config.raio_maximo_km > 0 && distance.distance_km > config.raio_maximo_km) {
            return {
                success: false,
                distance_km: Math.round(distance.distance_km * 10) / 10,
                error: `Fora da área de entrega (máx: ${config.raio_maximo_km}km)`
            };
        }

        let taxa = config.taxa_entrega_fixa || 0;
        if (config.valor_por_km > 0) {
            taxa = Math.max(taxa, Math.round(distance.distance_km * config.valor_por_km * 100) / 100);
        }

        taxa = Math.max(0, taxa);

        return {
            success: true,
            distance_km: Math.round(distance.distance_km * 10) / 10,
            duration_min: distance.duration_min,
            taxa_entrega: taxa
        };
    } catch (error: any) {
        console.error('calculateDeliveryFee error:', error);
        return { success: false, error: error.message || 'Erro ao calcular entrega' };
    }
}

export async function geocodeAddress(endereco: string, cidade?: string, estado?: string): Promise<{ lat: number; lng: number; formatted_address?: string } | null> {
    try {
        console.log('[Geocoding] API Key configurada:', GOOGLE_MAPS_API_KEY ? 'SIM' : 'NÃO');

        if (!GOOGLE_MAPS_API_KEY) {
            console.log('[Geocoding] Sem API Key configurada');
            return null;
        }

        let enderecoLimpo = endereco
            .replace(/\s+/g, ' ')
            .replace(/[,.]{2,}/g, ',')
            .trim();

        let enderecoCompleto = enderecoLimpo;

        if (cidade && !enderecoLimpo.toLowerCase().includes(cidade.toLowerCase())) {
            enderecoCompleto = `${enderecoCompleto}, ${cidade}`;
        }

        if (estado && !enderecoLimpo.toLowerCase().includes(estado.toLowerCase())) {
            enderecoCompleto = `${enderecoCompleto}, ${estado}`;
        }

        if (!enderecoCompleto.toLowerCase().includes('brasil')) {
            enderecoCompleto = `${enderecoCompleto}, Brasil`;
        }

        const encodedAddress = encodeURIComponent(enderecoCompleto);
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}&region=br&language=pt-BR`;

        console.log('[Geocoding] Buscando:', enderecoCompleto);

        const response = await fetch(url, { next: { revalidate: 3600 } });
        const data = await response.json();

        console.log('[Geocoding] Status:', data.status, '| Resultados:', data.results?.length || 0);

        if (data.status !== 'OK' || !data.results?.length) {
            console.log('[Geocoding] Falhou:', data.status, data.error_message);
            return null;
        }

        const result = data.results[0];
        const location = result.geometry.location;

        return {
            lat: location.lat,
            lng: location.lng,
            formatted_address: result.formatted_address
        };
    } catch (error) {
        console.error('geocodeAddress error:', error);
        return null;
    }
}

export async function saveDeliveryRatesBatch(rates: any[]) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        console.log(`[saveDeliveryRatesBatch] Empresa: ${user.empresaId}, Bairros recebidos: ${rates.length}`);
        console.log(`[saveDeliveryRatesBatch] Dados:`, JSON.stringify(rates, null, 2));

        const results = [];
        const errors = [];
        
        for (const data of rates) {
            if (!data.bairro || data.bairro.trim() === '') {
                console.log('[saveDeliveryRatesBatch] Bairro vazio, pulando...');
                continue;
            }

            // Converter valor_taxa para numero de forma robusta
            let valorTaxa = 0;
            if (typeof data.valor_taxa === 'number') {
                valorTaxa = data.valor_taxa;
            } else if (typeof data.valor_taxa === 'string') {
                // Remove R$, espacos, pontos de milhar e converte virgula em ponto
                let valorStr = data.valor_taxa.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
                valorTaxa = parseFloat(valorStr) || 0;
            }

            const payload = {
                bairro: data.bairro.trim(),
                valor_taxa: valorTaxa,
                tempo_estimado: String(data.tempo_estimado || '').trim(),
                empresa_id: Number(user.empresaId)
            };

            console.log('[saveDeliveryRatesBatch] Processando:', JSON.stringify(payload));

            const recordId = data.id;

            try {
                if (recordId && !String(recordId).startsWith('temp-')) {
                    // Update existente
                    const { empresa_id, ...updateData } = payload;
                    const res = await pg.update(TAXAS_ENTREGA_TABLE, { id: recordId, ...updateData });
                    console.log('[saveDeliveryRatesBatch] Atualizado:', recordId);
                    results.push({ id: recordId, bairro: payload.bairro, action: 'updated', ...res });
                } else {
                    // Criar novo
                    const res = await pg.create(TAXAS_ENTREGA_TABLE, payload);
                    console.log('[saveDeliveryRatesBatch] Criado:', res);
                    results.push({ bairro: payload.bairro, action: 'created', ...res });
                }
            } catch (innerError: any) {
                console.error('[saveDeliveryRatesBatch] Erro ao salvar bairro:', payload.bairro, innerError.message);
                errors.push({ bairro: payload.bairro, error: innerError.message });
            }
        }

        revalidatePath('/dashboard/settings');
        
        console.log(`[saveDeliveryRatesBatch] Resultado: ${results.length} salvos, ${errors.length} erros`);
        
        return { 
            success: true, 
            count: results.length,
            errors: errors.length > 0 ? errors : undefined
        };
    } catch (error: any) {
        console.error('API Error (saveDeliveryRatesBatch) FATAL:', error);
        throw new Error(`Erro ao salvar taxas de entrega: ${error.message}`);
    }
}
