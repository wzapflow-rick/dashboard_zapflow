import { noco } from '@/lib/nocodb';
import { 
    CAMPANHAS_TABLE_ID, 
    DISPAROS_TABLE_ID, 
    CLIENTES_TABLE_ID,
    EMPRESAS_TABLE_ID 
} from '@/lib/constants';

const EVO_API_URL = process.env.EVOLUTION_API_URL || 'https://evo.wzapflow.com.br';
const EVO_API_KEY = process.env.EVOLUTION_API_KEY || '';

/**
 * Formatar numero de telefone para Evolution API
 */
function formatPhoneForEvolution(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
        cleaned = '55' + cleaned;
    }
    return `${cleaned}@s.whatsapp.net`;
}

/**
 * Enviar mensagem via Evolution API usando instancia especifica
 */
async function enviarMensagemEvolution(
    phone: string, 
    message: string, 
    instanceName: string
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!EVO_API_KEY) {
            console.error('[CAMPANHAS] EVOLUTION_API_KEY nao configurada!');
            return { success: false, error: 'EVOLUTION_API_KEY nao configurada' };
        }
        
        const formattedPhone = formatPhoneForEvolution(phone);
        const url = `${EVO_API_URL}/message/sendText/${instanceName}`;

        console.log(`[CAMPANHAS] Enviando para ${formattedPhone} via instancia ${instanceName}`);
        console.log(`[CAMPANHAS] URL: ${url}`);
        console.log(`[CAMPANHAS] Mensagem: ${message.substring(0, 100)}...`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': EVO_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                number: formattedPhone,
                text: message
            })
        });

        const result = await response.json();
        console.log(`[CAMPANHAS] Resposta Evolution (${response.status}):`, JSON.stringify(result).substring(0, 300));

        if (!response.ok) {
            return { 
                success: false, 
                error: result.message || result.error || `HTTP ${response.status}` 
            };
        }

        return { success: true };
    } catch (error: any) {
        console.error('[CAMPANHAS] Erro ao enviar via Evolution:', error);
        return { success: false, error: error.message || 'Erro desconhecido' };
    }
}

interface Campanha {
    id: number;
    empresa_id: string;
    tipo: string;
    ativo: boolean;
    nome: string;
    gatilho_dias?: number;
    horario_envio?: string;
    dias_semana?: string;
    variante_1: string;
    variante_2?: string;
    variante_3?: string;
    variante_4?: string;
    max_envios_semana: number;
}

interface Cliente {
    id: number;
    empresa_id: string;
    nome: string;
    telefone: string;
    ultima_compra?: string;
}

interface Empresa {
    id: number;
    nome: string;
    nome_fantasia?: string;
    instancia_evolution?: string;
}

// Dias da semana em portugues
const DIAS_SEMANA: Record<number, string> = {
    0: 'DOM',
    1: 'SEG',
    2: 'TER',
    3: 'QUA',
    4: 'QUI',
    5: 'SEX',
    6: 'SAB'
};

/**
 * Verifica se a campanha deve rodar agora
 */
function shouldRunNow(campanha: Campanha): boolean {
    const now = new Date();
    const currentDay = DIAS_SEMANA[now.getDay()];
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Verificar dia da semana
    if (campanha.dias_semana) {
        try {
            const dias = JSON.parse(campanha.dias_semana);
            if (Array.isArray(dias) && !dias.includes(currentDay)) {
                return false;
            }
        } catch {
            // Se nao conseguir parsear, considera todos os dias
        }
    }
    
    // Verificar horario (com tolerancia de 30 minutos)
    if (campanha.horario_envio) {
        const [hour, minute] = campanha.horario_envio.split(':').map(Number);
        const campanhaMinutes = hour * 60 + minute;
        const currentMinutes = currentHour * 60 + currentMinute;
        
        // Tolerancia de 30 minutos antes e depois
        if (Math.abs(campanhaMinutes - currentMinutes) > 30) {
            return false;
        }
    }
    
    return true;
}

/**
 * Busca todos os clientes de uma empresa
 */
async function getTodosClientes(empresaId: string): Promise<Cliente[]> {
    try {
        console.log(`[CAMPANHAS] Buscando todos os clientes da empresa ${empresaId}`);
        
        const data = await noco.list(CLIENTES_TABLE_ID!, {
            where: `(empresa_id,eq,${empresaId})`,
            limit: 100,
        });
        
        const clientes = ((data.list || []) as unknown as Cliente[]).filter((c) => c.telefone);
        console.log(`[CAMPANHAS] Encontrados ${clientes.length} clientes com telefone`);
        
        return clientes;
    } catch (error) {
        console.error('[CAMPANHAS] Erro ao buscar todos clientes:', error);
        return [];
    }
}

/**
 * Busca clientes elegiveis para reengajamento
 */
async function getClientesReengajamento(empresaId: string, diasSemPedido: number): Promise<Cliente[]> {
    try {
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - diasSemPedido);
        const dataLimiteStr = dataLimite.toISOString().split('T')[0];
        
        console.log(`[CAMPANHAS] Buscando clientes sem compra desde ${dataLimiteStr} para empresa ${empresaId}`);
        
        // Primeiro tenta buscar com filtro de data
        let data = await noco.list(CLIENTES_TABLE_ID!, {
            where: `(empresa_id,eq,${empresaId})~and(ultima_compra,lt,${dataLimiteStr})`,
            limit: 100,
        });
        
        let clientes = ((data.list || []) as unknown as Cliente[]).filter((c) => c.telefone);
        
        // Se nao encontrou nenhum, busca clientes sem ultima_compra preenchida
        if (clientes.length === 0) {
            console.log(`[CAMPANHAS] Nenhum cliente com filtro de data, buscando clientes sem ultima_compra`);
            data = await noco.list(CLIENTES_TABLE_ID!, {
                where: `(empresa_id,eq,${empresaId})`,
                limit: 100,
            });
            
            // Filtra clientes sem ultima_compra ou com ultima_compra antiga
            clientes = ((data.list || []) as unknown as Cliente[]).filter((c) => {
                if (!c.telefone) return false;
                if (!c.ultima_compra) return true; // Cliente nunca comprou
                const ultimaCompraDate = new Date(c.ultima_compra);
                return ultimaCompraDate < dataLimite;
            });
        }
        
        console.log(`[CAMPANHAS] Encontrados ${clientes.length} clientes elegiveis para reengajamento`);
        return clientes;
    } catch (error) {
        console.error('[CAMPANHAS] Erro ao buscar clientes reengajamento:', error);
        return [];
    }
}

/**
 * Verifica se cliente ja recebeu disparo recentemente
 */
async function clienteJaRecebeuRecentemente(
    empresaId: string, 
    clienteId: number, 
    campanhaId: number,
    maxEnviosSemana: number
): Promise<boolean> {
    try {
        const umaSemanaAtras = new Date();
        umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);
        // Usar formato apenas com data (YYYY-MM-DD) que o NocoDB aceita
        const dataStr = umaSemanaAtras.toISOString().split('T')[0];
        
        const data = await noco.list(DISPAROS_TABLE_ID!, {
            where: `(empresa_id,eq,${empresaId})~and(cliente_id,eq,${clienteId})~and(campanha_id,eq,${campanhaId})~and(enviado_em,gt,${dataStr})~and(status,eq,enviado)`,
            limit: maxEnviosSemana + 1,
        });
        
        return (data.list || []).length >= maxEnviosSemana;
    } catch (error) {
        console.error('Erro ao verificar disparos anteriores:', error);
        // Em caso de erro, retorna false para permitir o envio (melhor experiencia)
        return false;
    }
}

/**
 * Seleciona uma variante aleatoria da mensagem
 */
function selecionarVariante(campanha: Campanha): { varianteNum: number; mensagem: string } {
    const variantes: string[] = [];
    if (campanha.variante_1) variantes.push(campanha.variante_1);
    if (campanha.variante_2) variantes.push(campanha.variante_2);
    if (campanha.variante_3) variantes.push(campanha.variante_3);
    if (campanha.variante_4) variantes.push(campanha.variante_4);
    
    if (variantes.length === 0) {
        return { varianteNum: 0, mensagem: '' };
    }
    
    const index = Math.floor(Math.random() * variantes.length);
    return { varianteNum: index + 1, mensagem: variantes[index] };
}

/**
 * Substitui variaveis na mensagem
 */
function substituirVariaveis(
    mensagem: string, 
    cliente: Cliente, 
    empresa: Empresa,
    diasAusente: number
): string {
    return mensagem
        .replace(/\{\{nome_cliente\}\}/g, cliente.nome || 'Cliente')
        .replace(/\{\{nome_loja\}\}/g, empresa.nome || 'Loja')
        .replace(/\{\{dias_ausente\}\}/g, String(diasAusente))
        .replace(/\{\{ultimo_pedido\}\}/g, cliente.ultima_compra || 'N/A');
}

/**
 * Registra disparo no banco
 */
async function registrarDisparo(
    empresaId: string,
    campanhaId: number,
    clienteId: number,
    telefone: string,
    varianteUsada: number,
    mensagemEnviada: string,
    status: 'enviado' | 'erro' | 'ignorado',
    erroDetalhe?: string
): Promise<void> {
    try {
        await noco.create(DISPAROS_TABLE_ID!, {
            empresa_id: empresaId,
            campanha_id: campanhaId,
            cliente_id: clienteId,
            telefone,
            variante_usada: varianteUsada,
            mensagem_enviada: mensagemEnviada,
            status,
            erro_detalhe: erroDetalhe || null,
            enviado_em: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Erro ao registrar disparo:', error);
    }
}

/**
 * Busca dados da empresa
 */
async function getEmpresa(empresaId: string): Promise<Empresa | null> {
    try {
        const data = await noco.findOne(EMPRESAS_TABLE_ID!, {
            where: `(id,eq,${empresaId})`,
        }) as any;
        
        if (!data) {
            console.error(`[CAMPANHAS] Empresa ${empresaId} nao encontrada no banco`);
            return null;
        }
        
        // Se instancia_evolution estiver vazia, usa o padrao zapflow_{empresaId}
        let instanciaEvolution = data.instancia_evolution;
        if (!instanciaEvolution) {
            instanciaEvolution = `zapflow_${empresaId}`;
            console.log(`[CAMPANHAS] Empresa ${data.nome_fantasia} sem instancia configurada, usando fallback: ${instanciaEvolution}`);
            
            // Tenta atualizar a empresa com o valor padrao (nao bloqueia se falhar)
            try {
                await noco.update(EMPRESAS_TABLE_ID!, {
                    id: data.id,
                    instancia_evolution: instanciaEvolution
                });
                console.log(`[CAMPANHAS] Instancia ${instanciaEvolution} salva automaticamente para empresa ${empresaId}`);
            } catch (updateErr) {
                console.warn(`[CAMPANHAS] Nao foi possivel salvar instancia automaticamente:`, updateErr);
            }
        }
        
        console.log(`[CAMPANHAS] Empresa encontrada: ${data.nome_fantasia || data.nome}, instancia: ${instanciaEvolution}`);
        
        return { 
            id: data.id, 
            nome: data.nome_fantasia || data.nome || 'Loja',
            nome_fantasia: data.nome_fantasia,
            instancia_evolution: instanciaEvolution 
        };
    } catch (error) {
        console.error('[CAMPANHAS] Erro ao buscar empresa:', error);
        return null;
    }
}

/**
 * Processa uma campanha
 */
async function processarCampanha(campanha: Campanha): Promise<{ enviados: number; erros: number; detalhes?: string }> {
    let enviados = 0;
    let erros = 0;
    
    console.log(`[CAMPANHAS] ========================================`);
    console.log(`[CAMPANHAS] Processando campanha: ${campanha.nome} (${campanha.tipo})`);
    console.log(`[CAMPANHAS] Empresa ID: ${campanha.empresa_id}`);
    
    const empresa = await getEmpresa(campanha.empresa_id);
    if (!empresa) {
        console.error(`[CAMPANHAS] Empresa ${campanha.empresa_id} nao encontrada`);
        return { enviados: 0, erros: 0, detalhes: 'Empresa nao encontrada' };
    }
    
    console.log(`[CAMPANHAS] Instancia Evolution: ${empresa.instancia_evolution}`);
    
    let clientes: Cliente[] = [];
    const diasGatilho = campanha.gatilho_dias || 7;
    
    console.log(`[CAMPANHAS] Tipo da campanha: ${campanha.tipo}, dias gatilho: ${diasGatilho}`);
    
    switch (campanha.tipo) {
        case 'reengajamento':
            // Reengajamento: clientes que nao compram ha X dias
            clientes = await getClientesReengajamento(campanha.empresa_id, diasGatilho);
            break;
        case 'cupom':
        case 'promocao':
        case 'novidade':
            // Cupom/Promocao/Novidade: enviar para todos os clientes
            clientes = await getTodosClientes(campanha.empresa_id);
            break;
        default:
            // Default: enviar para todos os clientes
            console.log(`[CAMPANHAS] Tipo desconhecido '${campanha.tipo}', enviando para todos os clientes`);
            clientes = await getTodosClientes(campanha.empresa_id);
    }
    
    console.log(`[CAMPANHAS] ${clientes.length} clientes elegiveis encontrados para campanha ${campanha.nome}`);
    
    for (const cliente of clientes) {
        try {
            const jaRecebeu = await clienteJaRecebeuRecentemente(
                campanha.empresa_id,
                cliente.id,
                campanha.id,
                campanha.max_envios_semana || 1
            );
            
            if (jaRecebeu) {
                console.log(`[CAMPANHAS] Cliente ${cliente.id} ja recebeu recentemente, pulando`);
                continue;
            }
            
            const { varianteNum, mensagem } = selecionarVariante(campanha);
            if (!mensagem) {
                console.log(`[CAMPANHAS] Campanha sem mensagens configuradas`);
                continue;
            }
            
            const diasAusente = cliente.ultima_compra 
                ? Math.floor((Date.now() - new Date(cliente.ultima_compra).getTime()) / (1000 * 60 * 60 * 24))
                : diasGatilho;
            
            const mensagemFinal = substituirVariaveis(mensagem, cliente, empresa, diasAusente);
            
            // Usa a instancia Evolution configurada na empresa
            const result = await enviarMensagemEvolution(
                cliente.telefone, 
                mensagemFinal, 
                empresa.instancia_evolution!
            );
            
            if (result.success) {
                enviados++;
                await registrarDisparo(
                    campanha.empresa_id,
                    campanha.id,
                    cliente.id,
                    cliente.telefone,
                    varianteNum,
                    mensagemFinal,
                    'enviado'
                );
                console.log(`[CAMPANHAS] Mensagem enviada para ${cliente.telefone}`);
            } else {
                erros++;
                await registrarDisparo(
                    campanha.empresa_id,
                    campanha.id,
                    cliente.id,
                    cliente.telefone,
                    varianteNum,
                    mensagemFinal,
                    'erro',
                    result.error || 'Falha no envio via Evolution API'
                );
                console.error(`[CAMPANHAS] Erro ao enviar para ${cliente.telefone}: ${result.error}`);
            }
            
            // Delay entre envios (evitar rate limit)
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error: any) {
            erros++;
            console.error(`[CAMPANHAS] Erro ao processar cliente ${cliente.id}:`, error);
        }
    }
    
    return { enviados, erros };
}

/**
 * Funcao principal de execucao de campanhas
 */
export async function executarDisparoCampanhas(ignorarHorario: boolean = true): Promise<{
    success: boolean;
    campanhas_processadas: number;
    total_enviados: number;
    total_erros: number;
    resultados: any[];
    error?: string;
}> {
    try {
        console.log('[CAMPANHAS] Iniciando processamento de campanhas');
        
        if (!CAMPANHAS_TABLE_ID || !DISPAROS_TABLE_ID || !CLIENTES_TABLE_ID) {
            console.error('[CAMPANHAS] Tabelas nao configuradas');
            return { 
                success: false,
                campanhas_processadas: 0,
                total_enviados: 0,
                total_erros: 0,
                resultados: [],
                error: 'Tabelas nao configuradas'
            };
        }
        
        console.log(`[CAMPANHAS] Buscando campanhas ativas na tabela ${CAMPANHAS_TABLE_ID}`);
        
        const campanhasData = await noco.list(CAMPANHAS_TABLE_ID, {
            where: '(ativo,eq,true)',
            limit: 100,
        });
        
        console.log(`[CAMPANHAS] Resposta raw:`, JSON.stringify(campanhasData, null, 2));
        
        const campanhas = (campanhasData.list || []) as unknown as Campanha[];
        console.log(`[CAMPANHAS] ${campanhas.length} campanhas ativas encontradas`);
        
        if (campanhas.length > 0) {
            console.log(`[CAMPANHAS] Primeira campanha:`, JSON.stringify(campanhas[0], null, 2));
        }
        
        let totalEnviados = 0;
        let totalErros = 0;
        const resultados: any[] = [];
        
        for (const campanha of campanhas) {
            if (!ignorarHorario && !shouldRunNow(campanha)) {
                console.log(`[CAMPANHAS] Campanha ${campanha.nome} nao esta no horario/dia configurado`);
                resultados.push({
                    campanha: campanha.nome,
                    status: 'pulada',
                    motivo: 'Fora do horario/dia configurado'
                });
                continue;
            }
            
            const { enviados, erros } = await processarCampanha(campanha);
            totalEnviados += enviados;
            totalErros += erros;
            
            resultados.push({
                campanha: campanha.nome,
                empresa_id: campanha.empresa_id,
                enviados,
                erros
            });
        }
        
        console.log(`[CAMPANHAS] Finalizado - Enviados: ${totalEnviados}, Erros: ${totalErros}`);
        
        return {
            success: true,
            campanhas_processadas: campanhas.length,
            total_enviados: totalEnviados,
            total_erros: totalErros,
            resultados
        };
        
    } catch (error: any) {
        console.error('[CAMPANHAS] Erro geral:', error);
        return { 
            success: false,
            campanhas_processadas: 0,
            total_enviados: 0,
            total_erros: 0,
            resultados: [],
            error: error.message || 'Erro interno' 
        };
    }
}
