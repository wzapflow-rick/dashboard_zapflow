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
            
            // Detecta erros específicos do Prisma/banco de dados
            const errorMsg = JSON.stringify(data);
            if (errorMsg.includes('PrismaClient') || errorMsg.includes('database') || res.status === 500) {
                return { 
                    error: 'Servidor WhatsApp temporariamente indisponível. Tente novamente em alguns minutos.', 
                    data: null 
                };
            }
            
            return { error: data.message || 'Erro na Evolution API', data: null };
        }
        return { error: null, data };
    } catch (err) {
        console.error('Evolution Fetch Exception:', err);
        return { error: 'Falha de conexão com a Evolution API', data: null };
    }
}

export async function createEvolutionInstance(empresaId: string | number) {
    const instanceName = `zapflow_${empresaId}`;
    console.log('[v0] createEvolutionInstance - empresaId:', empresaId, 'instanceName:', instanceName);
    console.log('[v0] EVO_URL:', EVO_URL, 'EVO_KEY exists:', !!EVO_KEY);

    // Verifica se já existe
    const existing = await evoFetch(`/instance/fetchInstances`);
    console.log('[v0] fetchInstances response:', JSON.stringify(existing).slice(0, 500));
    
    if (existing.data) {
        const instances = Array.isArray(existing.data) ? existing.data : [];
        console.log('[v0] Total instances found:', instances.length);
        const found = instances.find((i: any) =>
            i.instance?.instanceName === instanceName || i.name === instanceName
        );
        if (found) {
            console.log('[v0] Instance already exists:', instanceName);
            return { instanceName, alreadyExists: true };
        }
    }

    // Se houve erro ao buscar instâncias (ex: Evolution API com problema)
    if (existing.error) {
        console.error('[v0] Erro ao buscar instâncias existentes:', existing.error);
        return { error: existing.error };
    }

    // Cria a instância
    console.log('[v0] Creating new instance:', instanceName);
    const result = await evoFetch('/instance/create', 'POST', {
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
    });
    console.log('[v0] Create instance response:', JSON.stringify(result).slice(0, 500));

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

/**
 * Configura o webhook de uma instância para receber mensagens.
 */
export async function configureInstanceWebhook(instanceName: string) {
    const webhookUrl = process.env.NEXT_PUBLIC_APP_URL 
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/evolution`
        : 'https://cardapio.wzapflow.com.br/api/webhooks/evolution';
    
    console.log('[Evolution] Configurando webhook para', instanceName, '-> URL:', webhookUrl);
    
    const result = await evoFetch(`/webhook/set/${instanceName}`, 'POST', {
        webhook: {
            enabled: true,
            url: webhookUrl,
            webhookByEvents: false,
            webhookBase64: false,
            events: [
                'MESSAGES_UPSERT',
                'CONNECTION_UPDATE'
            ]
        }
    });
    
    if (result.error) {
        console.error('[Evolution] Erro ao configurar webhook:', result.error);
        return { error: result.error };
    }
    
    console.log('[Evolution] Webhook configurado com sucesso');
    return { success: true };
}

/**
 * Cria instancia Evolution e configura webhook automaticamente.
 * Usada no signup para configurar tudo de uma vez.
 */
export async function setupEvolutionInstance(empresaId: string | number) {
    console.log('[Evolution] Setup completo para empresa:', empresaId);
    
    // 1. Criar instancia
    const createResult = await createEvolutionInstance(empresaId);
    
    if (createResult.error) {
        console.error('[Evolution] Erro ao criar instancia:', createResult.error);
        return { error: createResult.error };
    }
    
    const instanceName = createResult.instanceName;
    
    if (!instanceName) {
        return { error: 'Instancia criada mas nome nao retornado' };
    }
    
    // 2. Configurar webhook (independente se ja existia ou nao)
    const webhookResult = await configureInstanceWebhook(instanceName);
    
    if (webhookResult.error) {
        console.warn('[Evolution] Webhook nao configurado, mas instancia criada:', webhookResult.error);
        // Nao retorna erro pois a instancia foi criada - webhook pode ser configurado depois
    }
    
    return { 
        instanceName, 
        alreadyExists: createResult.alreadyExists,
        webhookConfigured: !webhookResult.error
    };
}
