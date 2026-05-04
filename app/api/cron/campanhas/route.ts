import { NextRequest, NextResponse } from 'next/server';
import { noco } from '@/lib/nocodb';
import { 
    CAMPANHAS_TABLE_ID, 
    DISPAROS_TABLE_ID, 
    CLIENTES_TABLE_ID,
    EMPRESAS_TABLE_ID 
} from '@/lib/constants';
import { sendWhatsAppMessageWithInstance } from '@/app/actions/whatsapp';

// Protege o endpoint para ser chamado apenas pelo Vercel Cron
const CRON_SECRET = process.env.CRON_SECRET;

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
 * Busca clientes elegiveis para reengajamento
 */
async function getClientesReengajamento(empresaId: string, diasSemPedido: number): Promise<Cliente[]> {
    try {
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - diasSemPedido);
        const dataLimiteStr = dataLimite.toISOString().split('T')[0];
        
        // Buscar clientes com ultima_compra antes da data limite
        const data = await noco.list(CLIENTES_TABLE_ID, {
            where: `(empresa_id,eq,${empresaId})~and(ultima_compra,lt,${dataLimiteStr})`,
            limit: 100,
        });
        
        return ((data.list || []) as unknown as Cliente[]).filter((c) => c.telefone);
    } catch (error) {
        console.error('Erro ao buscar clientes reengajamento:', error);
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
        
        const data = await noco.list(DISPAROS_TABLE_ID, {
            where: `(empresa_id,eq,${empresaId})~and(cliente_id,eq,${clienteId})~and(campanha_id,eq,${campanhaId})~and(enviado_em,gt,${umaSemanaAtras.toISOString()})~and(status,eq,enviado)`,
            limit: maxEnviosSemana + 1,
        });
        
        return (data.list || []).length >= maxEnviosSemana;
    } catch (error) {
        console.error('Erro ao verificar disparos anteriores:', error);
        return true; // Em caso de erro, nao envia
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
        await noco.create(DISPAROS_TABLE_ID, {
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
        const data = await noco.findOne(EMPRESAS_TABLE_ID, {
            where: `(id,eq,${empresaId})`,
        }) as any;
        return data ? { id: data.id, nome: data.nome } : null;
    } catch (error) {
        console.error('Erro ao buscar empresa:', error);
        return null;
    }
}

/**
 * Processa uma campanha
 */
async function processarCampanha(campanha: Campanha): Promise<{ enviados: number; erros: number }> {
    let enviados = 0;
    let erros = 0;
    
    console.log(`[CRON] Processando campanha: ${campanha.nome} (${campanha.tipo})`);
    
    // Buscar dados da empresa
    const empresa = await getEmpresa(campanha.empresa_id);
    if (!empresa) {
        console.error(`[CRON] Empresa ${campanha.empresa_id} nao encontrada`);
        return { enviados: 0, erros: 0 };
    }
    
    // Buscar clientes elegiveis baseado no tipo
    let clientes: Cliente[] = [];
    const diasGatilho = campanha.gatilho_dias || 7;
    
    switch (campanha.tipo) {
        case 'reengajamento':
            clientes = await getClientesReengajamento(campanha.empresa_id, diasGatilho);
            break;
        // Adicionar outros tipos aqui no futuro
        default:
            clientes = await getClientesReengajamento(campanha.empresa_id, diasGatilho);
    }
    
    console.log(`[CRON] ${clientes.length} clientes elegiveis encontrados`);
    
    for (const cliente of clientes) {
        try {
            // Verificar se ja recebeu recentemente
            const jaRecebeu = await clienteJaRecebeuRecentemente(
                campanha.empresa_id,
                cliente.id,
                campanha.id,
                campanha.max_envios_semana || 1
            );
            
            if (jaRecebeu) {
                console.log(`[CRON] Cliente ${cliente.id} ja recebeu recentemente, pulando`);
                continue;
            }
            
            // Selecionar variante
            const { varianteNum, mensagem } = selecionarVariante(campanha);
            if (!mensagem) {
                console.log(`[CRON] Campanha sem mensagens configuradas`);
                continue;
            }
            
            // Calcular dias ausente
            const diasAusente = cliente.ultima_compra 
                ? Math.floor((Date.now() - new Date(cliente.ultima_compra).getTime()) / (1000 * 60 * 60 * 24))
                : diasGatilho;
            
            // Substituir variaveis
            const mensagemFinal = substituirVariaveis(mensagem, cliente, empresa, diasAusente);
            
            // Enviar mensagem usando a instancia da empresa
            const result = await sendWhatsAppMessageWithInstance(
                cliente.telefone, 
                mensagemFinal, 
                campanha.empresa_id
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
                console.log(`[CRON] Mensagem enviada para ${cliente.telefone}`);
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
                console.error(`[CRON] Erro ao enviar para ${cliente.telefone}: ${result.error}`);
            }
            
            // Delay entre envios (evitar rate limit)
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error: any) {
            erros++;
            console.error(`[CRON] Erro ao processar cliente ${cliente.id}:`, error);
        }
    }
    
    return { enviados, erros };
}

export async function GET(request: NextRequest) {
    try {
        // Verificar autenticacao do CRON
        const authHeader = request.headers.get('authorization');
        if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
            console.log('[CRON] Autorizacao invalida');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        console.log('[CRON] Iniciando processamento de campanhas');
        
        if (!CAMPANHAS_TABLE_ID || !DISPAROS_TABLE_ID || !CLIENTES_TABLE_ID) {
            console.error('[CRON] Tabelas nao configuradas');
            return NextResponse.json({ 
                error: 'Tabelas nao configuradas',
                campanhas_table: !!CAMPANHAS_TABLE_ID,
                disparos_table: !!DISPAROS_TABLE_ID,
                clientes_table: !!CLIENTES_TABLE_ID
            }, { status: 500 });
        }
        
        // Buscar todas as campanhas ativas
        const campanhasData = await noco.list(CAMPANHAS_TABLE_ID, {
            where: '(ativo,eq,true)',
            limit: 100,
        });
        
        const campanhas = (campanhasData.list || []) as unknown as Campanha[];
        console.log(`[CRON] ${campanhas.length} campanhas ativas encontradas`);
        
        let totalEnviados = 0;
        let totalErros = 0;
        const resultados: any[] = [];
        
        for (const campanha of campanhas) {
            // Verificar se deve rodar agora
            if (!shouldRunNow(campanha)) {
                console.log(`[CRON] Campanha ${campanha.nome} nao esta no horario/dia configurado`);
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
        
        console.log(`[CRON] Finalizado - Enviados: ${totalEnviados}, Erros: ${totalErros}`);
        
        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            campanhas_processadas: campanhas.length,
            total_enviados: totalEnviados,
            total_erros: totalErros,
            resultados
        });
        
    } catch (error: any) {
        console.error('[CRON] Erro geral:', error);
        return NextResponse.json({ 
            success: false,
            error: error.message || 'Erro interno' 
        }, { status: 500 });
    }
}
