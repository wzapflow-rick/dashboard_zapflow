import { pg } from '@/lib/postgres';

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

const DIAS_SEMANA: Record<number, string> = {
    0: 'DOM',
    1: 'SEG',
    2: 'TER',
    3: 'QUA',
    4: 'QUI',
    5: 'SEX',
    6: 'SAB'
};

function shouldRunNow(campanha: Campanha): boolean {
    const now = new Date();
    const currentDay = DIAS_SEMANA[now.getDay()];
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
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
    
    if (campanha.horario_envio) {
        const [hour, minute] = campanha.horario_envio.split(':').map(Number);
        const campanhaMinutes = hour * 60 + minute;
        const currentMinutes = currentHour * 60 + currentMinute;
        
        if (Math.abs(campanhaMinutes - currentMinutes) > 30) {
            return false;
        }
    }
    
    return true;
}

async function getTodosClientes(empresaId: string): Promise<Cliente[]> {
    try {
        console.log(`[CAMPANHAS] Buscando todos os clientes da empresa ${empresaId}`);
        
        const data = await pg.list('clientes', {
            where: { empresa_id: empresaId },
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

async function getClientesReengajamento(empresaId: string, diasSemPedido: number): Promise<Cliente[]> {
    try {
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - diasSemPedido);
        const dataLimiteStr = dataLimite.toISOString();
        
        console.log(`[CAMPANHAS] Buscando clientes sem compra desde ${dataLimiteStr} para empresa ${empresaId}`);
        
        const data = await pg.query(
            `SELECT * FROM clientes WHERE empresa_id = $1 AND (ultima_compra < $2 OR ultima_compra IS NULL) LIMIT 100`,
            [empresaId, dataLimiteStr]
        );
        
        const clientes = ((data.rows || []) as unknown as Cliente[]).filter((c) => c.telefone);
        
        console.log(`[CAMPANHAS] Encontrados ${clientes.length} clientes elegiveis para reengajamento`);
        return clientes;
    } catch (error) {
        console.error('[CAMPANHAS] Erro ao buscar clientes reengajamento:', error);
        return [];
    }
}

async function clienteJaRecebeuRecentemente(
    empresaId: string, 
    clienteId: number, 
    campanhaId: number,
    maxEnviosSemana: number
): Promise<boolean> {
    try {
        const umaSemanaAtras = new Date();
        umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);
        const dataStr = umaSemanaAtras.toISOString();
        
        const data = await pg.query(
            `SELECT id FROM campanhas_disparos WHERE empresa_id = $1 AND cliente_id = $2 AND campanha_id = $3 AND enviado_em > $4 AND status = 'enviado' LIMIT $5`,
            [empresaId, clienteId, campanhaId, dataStr, maxEnviosSemana + 1]
        );
        
        return (data.rows || []).length >= maxEnviosSemana;
    } catch (error) {
        console.error('Erro ao verificar disparos anteriores:', error);
        return false;
    }
}

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
        await pg.create('campanhas_disparos', {
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

async function getEmpresa(empresaId: string): Promise<Empresa | null> {
    try {
        const data = await pg.findById('empresas', Number(empresaId)) as any;
        
        if (!data) {
            console.error(`[CAMPANHAS] Empresa ${empresaId} nao encontrada no banco`);
            return null;
        }
        
        let instanciaEvolution = data.instancia_evolution;
        if (!instanciaEvolution) {
            instanciaEvolution = `zapflow_${empresaId}`;
            console.log(`[CAMPANHAS] Empresa ${data.nome_fantasia} sem instancia configurada, usando fallback: ${instanciaEvolution}`);
            
            try {
                await pg.update('empresas', Number(empresaId), {
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
            clientes = await getClientesReengajamento(campanha.empresa_id, diasGatilho);
            break;
        case 'cupom':
        case 'promocao':
        case 'novidade':
            clientes = await getTodosClientes(campanha.empresa_id);
            break;
        default:
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
            
            const delayMs = 8000 + Math.floor(Math.random() * 7000);
            console.log(`[CAMPANHAS] Aguardando ${(delayMs/1000).toFixed(1)}s antes do proximo envio...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            
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
        
        console.log(`[CAMPANHAS] Buscando campanhas ativas`);
        
        const campanhasData = await pg.query(
            `SELECT * FROM campanhas_config WHERE ativo = true LIMIT 100`,
            []
        );
        
        const campanhas = (campanhasData.rows || []) as unknown as Campanha[];
        console.log(`[CAMPANHAS] ${campanhas.length} campanhas ativas encontradas`);
        
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
