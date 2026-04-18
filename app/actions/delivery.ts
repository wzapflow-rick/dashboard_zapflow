'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from './auth';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const TABLE_ID = 'mmzk2podf4zqps6'; // taxas_entrega-taxas_entrega
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

async function nocoFetch(endpoint: string, options: RequestInit = {}) {
    const url = `${NOCODB_URL}/api/v2/tables/${TABLE_ID}${endpoint}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            'xc-token': NOCODB_TOKEN,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
        cache: 'no-store',
    });

    if (!res.ok) {
        const text = await res.text();
        console.error(`NocoDB Error (Delivery): ${res.status} ${text}`);
        throw new Error(`NocoDB API Error: ${res.status}`);
    }

    return res;
}

export async function getDeliveryRates() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const res = await nocoFetch(`/records?limit=1000&where=(empresa_id,eq,${user.empresaId})`);
        const data = await res.json();
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

        if (data.id) {
            // Em atualizações (PATCH), evitamos campos que o NocoDB pode considerar colunas de sistema (como IDs de relação)
            // ou que já estejam definidos.
            const { id, empresa_id, empresas, ...updatePayload } = data;
            const res = await nocoFetch('/records', {
                method: 'PATCH',
                body: JSON.stringify({ ...updatePayload, Id: id })
            });
            revalidatePath('/dashboard/settings');
            return await res.json();
        } else {
            // Na criação, usamos empresa_id
            const { empresa_id, id, ...insertData } = data;
            const payload = {
                ...insertData,
                empresa_id: user.empresaId
            };
            const res = await nocoFetch('/records', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            revalidatePath('/dashboard/settings');
            return await res.json();
        }
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to save delivery rate');
    }
}

export async function deleteDeliveryRate(id: number) {
    try {
        await nocoFetch('/records', {
            method: 'DELETE',
            body: JSON.stringify([{ id, Id: id }])
        });
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

// Buscar configuração de entrega da empresa
export async function getDeliveryConfig(): Promise<DeliveryConfig | null> {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        // Buscar da tabela de empresas
        const configRes = await fetch(`${NOCODB_URL}/api/v2/tables/mp08yd7oaxn5xo2/records/${user.empresaId}`, {
            headers: {
                'xc-token': NOCODB_TOKEN,
                'Content-Type': 'application/json',
            },
            cache: 'no-store',
        });

        if (!configRes.ok) return null;

        const config = await configRes.json();

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

// Calcular distância usando Google Maps Distance Matrix API
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
        distance_km: element.distance.value / 1000, // metros para km
        duration_min: Math.ceil(element.duration.value / 60) // segundos para minutos
    };
}

// Calcular taxa de entrega usando configuração da empresa
export async function calculateDeliveryFee(
    destination: { lat: number; lng: number }
): Promise<DeliveryCalculationResult> {
    try {
        // SECURITY: Validate coordinates are within reasonable bounds (Brazil)
        if (!destination.lat || !destination.lng || 
            destination.lat < -90 || destination.lat > 90 ||
            destination.lng < -180 || destination.lng > 180) {
            return { success: false, error: 'Coordenadas inválidas' };
        }
        
        // Buscar configuração de entrega
        const config = await getDeliveryConfig();

        if (!config) {
            return { success: false, error: 'Taxa de entrega não configurada' };
        }

        // SECURITY: Validate delivery config values
        if (config.valor_por_km < 0 || config.taxa_entrega_fixa < 0) {
            console.error('Invalid delivery config: negative values detected');
            return { success: false, error: 'Configuração de entrega inválida' };
        }

        // Se raio automático está desativado, usar taxa fixa
        if (!config.auto_radius) {
            if (config.taxa_entrega_fixa > 0) {
                return {
                    success: true,
                    taxa_entrega: config.taxa_entrega_fixa
                };
            }
            return { success: false, error: 'Taxa de entrega não configurada' };
        }

        // Coordenadas da loja (origem)
        const origin = {
            lat: config.lat_loja,
            lng: config.lng_loja
        };

        // Calcular distância usando Google Maps
        const distance = await getDistanceFromGoogle(origin, destination);

        // SECURITY: Validate distance calculation result
        if (distance.distance_km <= 0 || distance.distance_km > 500) {
            return { success: false, error: 'Distância inválida calculada' };
        }

        // Verificar raio máximo (se configurado)
        if (config.raio_maximo_km > 0 && distance.distance_km > config.raio_maximo_km) {
            return {
                success: false,
                distance_km: Math.round(distance.distance_km * 10) / 10,
                error: `Fora da área de entrega (máx: ${config.raio_maximo_km}km)`
            };
        }

        // Calcular taxa: distância * valor por km
        let taxa = config.taxa_entrega_fixa || 0; // Taxa mínima
        if (config.valor_por_km > 0) {
            taxa = Math.max(taxa, Math.round(distance.distance_km * config.valor_por_km * 100) / 100);
        }

        // SECURITY: Ensure delivery fee is never negative
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

// Buscar coordenadas a partir de endereço (Geocoding)
export async function geocodeAddress(endereco: string, cidade?: string, estado?: string): Promise<{ lat: number; lng: number; formatted_address?: string } | null> {
    try {
        console.log('[Geocoding] API Key configurada:', GOOGLE_MAPS_API_KEY ? 'SIM' : 'NÃO');
        
        if (!GOOGLE_MAPS_API_KEY) {
            console.log('[Geocoding] Sem API Key configurada');
            return null;
        }

        // Limpar e formatar endereço
        let enderecoLimpo = endereco
            .replace(/\s+/g, ' ') // Múltiplos espaços para um
            .replace(/[,.]{2,}/g, ',') // Vírgulas/pontos duplicados
            .trim();
        
        // Construir endereço completo com componentes disponíveis
        let enderecoCompleto = enderecoLimpo;
        
        // Adicionar cidade se fornecida e não estiver no endereço
        if (cidade && !enderecoLimpo.toLowerCase().includes(cidade.toLowerCase())) {
            enderecoCompleto = `${enderecoCompleto}, ${cidade}`;
        }
        
        // Adicionar estado se fornecido e não estiver no endereço
        if (estado && !enderecoLimpo.toLowerCase().includes(estado.toLowerCase())) {
            enderecoCompleto = `${enderecoCompleto}, ${estado}`;
        }
        
        // Se não tem país, adicionar Brasil
        if (!enderecoCompleto.toLowerCase().includes('brasil')) {
            enderecoCompleto = `${enderecoCompleto}, Brasil`;
        }
        
        const encodedAddress = encodeURIComponent(enderecoCompleto);
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}&region=br&language=pt-BR`;
        
        console.log('[Geocoding] Buscando:', enderecoCompleto);
        
        const response = await fetch(url, { next: { revalidate: 3600 } });
        const data = await response.json();
        
        console.log('[Geocoding] Status:', data.status);
        console.log('[Geocoding] Resultados:', data.results?.length || 0);

        if (data.status === 'OK' && data.results?.[0]) {
            const result = data.results[0];
            console.log('[Geocoding] Endereço encontrado:', result.formatted_address);
            console.log('[Geocoding] Coordenadas:', result.geometry.location);
            
            return {
                lat: result.geometry.location.lat,
                lng: result.geometry.location.lng,
                formatted_address: result.formatted_address
            };
        } else if (data.status === 'ZERO_RESULTS') {
            console.log('[Geocoding] Nenhum resultado encontrado para:', enderecoCompleto);
            
            // Tentar com endereço mais genérico (apenas bairro + cidade)
            const parts = enderecoCompleto.split(',').map(p => p.trim());
            if (parts.length > 1) {
                const enderecoSimplificado = parts.slice(-2).join(', ');
                console.log('[Geocoding] Tentando com endereço simplificado:', enderecoSimplificado);
                
                const encodedSimplificado = encodeURIComponent(enderecoSimplificado);
                const urlSimplificado = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedSimplificado}&key=${GOOGLE_MAPS_API_KEY}&region=br&language=pt-BR`;
                
                const responseSimplificado = await fetch(urlSimplificado, { next: { revalidate: 3600 } });
                const dataSimplificado = await responseSimplificado.json();
                
                if (dataSimplificado.status === 'OK' && dataSimplificado.results?.[0]) {
                    const result = dataSimplificado.results[0];
                    console.log('[Geocoding] Encontrado com endereço simplificado:', result.formatted_address);
                    
                    return {
                        lat: result.geometry.location.lat,
                        lng: result.geometry.location.lng,
                        formatted_address: result.formatted_address
                    };
                }
            }
        } else {
            console.log('[Geocoding] Erro:', data.status, data.error_message);
        }

        return null;
    } catch (error) {
        console.error('[Geocoding] Erro na requisição:', error);
        return null;
    }
}

// Calcular taxa usando CEP (Geocoding + Distance Matrix)
export async function calculateDeliveryFeeByCep(cep: string): Promise<DeliveryCalculationResult> {
    try {
        if (!GOOGLE_MAPS_API_KEY) {
            return { success: false, error: 'Serviço de entrega indisponível' };
        }

        // Buscar coordenadas do CEP
        const coords = await geocodeAddress(cep);
        if (!coords) {
            return { success: false, error: 'Não foi possível localizar o endereço' };
        }

        // Calcular taxa usando coordenadas
        return await calculateDeliveryFee(coords);
    } catch (error: any) {
        console.error('calculateDeliveryFeeByCep error:', error);
        return { success: false, error: error.message || 'Erro ao calcular entrega' };
    }
}

