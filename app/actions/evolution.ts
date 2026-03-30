'use server';

const EVO_URL = process.env.EVOLUTION_URL || 'https://evo.wzapflow.com.br';
const EVO_KEY = process.env.EVOLUTION_API_KEY || '';

async function evoFetch(path: string, method: string = 'GET', body?: any) {
    try {
        const res = await fetch(`${EVO_URL}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVO_KEY,
            },
            body: body ? JSON.stringify(body) : undefined,
            cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok) {
            console.error(`Evolution API Error [${method} ${path}]:`, data);
            return { error: data.message || 'Erro na Evolution API', data: null };
        }
        return { error: null, data };
    } catch (err) {
        console.error('Evolution Fetch Exception:', err);
        return { error: 'Falha de conexão com a Evolution API', data: null };
    }
}

/**
 * Cria uma nova instância na Evolution API para a empresa.
 * Retorna o nome da instância criada.
 */
export async function createEvolutionInstance(empresaId: string | number) {
    const instanceName = `zapflow_${empresaId}`;

    // Verifica se já existe
    const existing = await evoFetch(`/instance/fetchInstances`);
    if (existing.data) {
        const instances = Array.isArray(existing.data) ? existing.data : [];
        const found = instances.find((i: any) =>
            i.instance?.instanceName === instanceName || i.name === instanceName
        );
        if (found) {
            console.log('Instance already exists:', instanceName);
            return { instanceName, alreadyExists: true };
        }
    }

    // Cria a instância
    const result = await evoFetch('/instance/create', 'POST', {
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
    });

    if (result.error) return { error: result.error };
    return { instanceName, data: result.data };
}

/**
 * Busca o QR Code de uma instância.
 */
export async function getEvolutionQRCode(instanceName: string) {
    const result = await evoFetch(`/instance/connect/${instanceName}`);
    if (result.error) return { error: result.error };

    const qrcode = result.data?.base64 || result.data?.qrcode?.base64 || null;
    const pairingCode = result.data?.code || null;

    return { qrcode, pairingCode };
}

/**
 * Verifica o status de conexão de uma instância.
 */
export async function getInstanceStatus(instanceName: string) {
    const result = await evoFetch(`/instance/connectionState/${instanceName}`);
    if (result.error) return { error: result.error, state: null };

    const state = result.data?.instance?.state || result.data?.state || 'unknown';
    return { state };
}
