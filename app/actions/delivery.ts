'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from '@/lib/session-server';
import { noco } from '@/lib/nocodb';
import { TAXAS_ENTREGA_TABLE_ID, EMPRESAS_TABLE_ID } from '@/lib/constants';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

export async function getDeliveryRates() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const data = await noco.list(TAXAS_ENTREGA_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})`,
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

        let result;
        if (data.id) {
            const { id, empresa_id, empresas, ...updatePayload } = data;
            result = await noco.update(TAXAS_ENTREGA_TABLE_ID, { id, ...updatePayload });
        } else {
            const { empresa_id, id, ...insertData } = data;
            result = await noco.create(TAXAS_ENTREGA_TABLE_ID, {
                ...insertData,
                empresa_id: user.empresaId
            });
        }

        // Removido revalidatePath daqui para evitar erros de Server Component em salvamentos em lote
        return result;
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to save delivery rate');
    }
}

export async function deleteDeliveryRate(id: number) {
    try {
        await noco.delete(TAXAS_ENTREGA_TABLE_ID, id);
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

        const config = await noco.findById(EMPRESAS_TABLE_ID, targetEmpresaId) as any;
        if (!config) return null;

        return {
            auto_radius: !!config.raio_entrega_automatico,
            valor_por_km: Number(config.valor_por_km || 0),
            taxa_entrega_fixa: Number(config.taxa_entrega_fixa || 0),
            lat_loja: Number(config.lat_loja || -23.5505),
            lng_loja: Number(config.lng_loja || -46.6333),
            raio_maximo_km: Number(config.raio_maximo_km || 0),
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
            return { success: false, error: 'Taxa de entrega não configurada' };
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

        console.log(`[saveDeliveryRatesBatch] Iniciando salvamento de ${rates.length} bairros para empresa ${user.empresaId}`);

        const results = [];
        for (const data of rates) {
            // Ignorar itens vazios ou sem nome de bairro
            if (!data.bairro || data.bairro.trim() === '') continue;

            const payload: any = {
                bairro: data.bairro,
                valor_taxa: Number(data.valor_taxa || 0),
                tempo_estimado: data.tempo_estimado || '',
                empresa_id: user.empresaId
            };

            if (data.id) {
                payload.id = data.id;
                console.log(`[saveDeliveryRatesBatch] Atualizando bairro ID ${data.id}:`, payload);
                results.push(await noco.update(TAXAS_ENTREGA_TABLE_ID, payload));
            } else {
                console.log(`[saveDeliveryRatesBatch] Criando novo bairro:`, payload);
                results.push(await noco.create(TAXAS_ENTREGA_TABLE_ID, payload));
            }
        }

        revalidatePath('/dashboard/settings');
        return { success: true, count: results.length };
    } catch (error: any) {
        console.error('API Error (saveDeliveryRatesBatch):', error);
        // Retorna o erro amigável para o frontend
        throw new Error(error.message || 'Erro ao salvar bairros. Verifique a conexão com o banco.');
    }
}
