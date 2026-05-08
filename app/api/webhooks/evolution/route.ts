import { NextRequest, NextResponse } from 'next/server';
import { noco } from '@/lib/nocodb';
import { 
  EMPRESAS_TABLE_ID, 
  BOT_CONFIG_TABLE_ID,
  CLIENTES_TABLE_ID 
} from '@/lib/constants';

const EVO_API_URL = process.env.EVOLUTION_API_URL || 'https://evo.wzapflow.com.br';
const EVO_API_KEY = process.env.EVOLUTION_API_KEY || '';

// Cache em memoria para evitar flood (chave: empresaId_phone, valor: timestamp)
// Isso previne multiplas mensagens mesmo antes de salvar no banco
const recentContactsCache = new Map<string, number>();

// Lock para requisicoes em andamento (chave: empresaId_phone, valor: true se processando)
const processingLock = new Map<string, boolean>();

// Tempo minimo entre saudacoes para o mesmo contato (em horas)
const COOLDOWN_HOURS = 6;

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
 * Extrair numero limpo do remoteJid
 */
function extractPhoneFromJid(jid: string): string {
  return jid.replace('@s.whatsapp.net', '').replace('@c.us', '');
}

/**
 * Enviar mensagem via Evolution API
 */
async function sendMessage(instanceName: string, phone: string, text: string): Promise<boolean> {
  try {
    const url = `${EVO_API_URL}/message/sendText/${instanceName}`;
    
    console.log(`[BOT] Enviando mensagem para ${phone} via ${instanceName}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': EVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        number: formatPhoneForEvolution(phone),
        text: text
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[BOT] Erro ao enviar: ${response.status} - ${errorText}`);
      return false;
    }
    
    console.log(`[BOT] Mensagem enviada com sucesso`);
    return true;
  } catch (error) {
    console.error('[BOT] Erro ao enviar mensagem:', error);
    return false;
  }
}

/**
 * Delay entre mensagens
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Verificar se o cliente ja foi contatado recentemente
 * Usa a tabela BOT_CONFIG para armazenar os contatos recentes de forma persistente
 */
async function wasRecentlyContacted(empresaId: number, phone: string): Promise<boolean> {
  const cacheKey = `${empresaId}_${phone}`;
  const now = Date.now();
  
  // 1. Primeiro verifica o cache em memoria (mais rapido, evita flood imediato)
  const cachedTime = recentContactsCache.get(cacheKey);
  if (cachedTime) {
    const hoursDiff = (now - cachedTime) / (1000 * 60 * 60);
    if (hoursDiff < COOLDOWN_HOURS) {
      console.log(`[BOT] Cliente ${phone} no cache (${hoursDiff.toFixed(1)}h atras), ignorando`);
      return true;
    }
  }
  
  // 2. Verifica na tabela de clientes (campo ultimo_contato_bot)
  try {
    const cliente = await noco.findOne(CLIENTES_TABLE_ID, {
      where: `(telefone,eq,${phone})~and(empresa_id,eq,${empresaId})`
    }) as any;
    
    if (cliente) {
      // Tenta varios nomes possiveis para o campo
      const lastContactStr = cliente.ultimo_contato_bot || 
                             cliente['ultimo_contato_bot'] || 
                             cliente.ultimoContatoBot ||
                             cliente.last_bot_contact;
      
      if (lastContactStr) {
        const lastContact = new Date(lastContactStr);
        const hoursDiff = (now - lastContact.getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff < COOLDOWN_HOURS) {
          console.log(`[BOT] Cliente ${phone} contatado ha ${hoursDiff.toFixed(1)}h (banco), ignorando`);
          recentContactsCache.set(cacheKey, lastContact.getTime());
          return true;
        }
      }
    }
    
    // 3. Verifica na config do bot (campo contatos_recentes como JSON)
    const botConfig = await noco.findOne(BOT_CONFIG_TABLE_ID!, {
      where: `(empresa_id,eq,${empresaId})`
    }) as any;
    
    if (botConfig?.contatos_recentes) {
      try {
        const contatos = typeof botConfig.contatos_recentes === 'string' 
          ? JSON.parse(botConfig.contatos_recentes) 
          : botConfig.contatos_recentes;
        
        const lastContactTime = contatos[phone];
        if (lastContactTime) {
          const hoursDiff = (now - lastContactTime) / (1000 * 60 * 60);
          if (hoursDiff < COOLDOWN_HOURS) {
            console.log(`[BOT] Cliente ${phone} em contatos_recentes (${hoursDiff.toFixed(1)}h), ignorando`);
            recentContactsCache.set(cacheKey, lastContactTime);
            return true;
          }
        }
      } catch (parseErr) {
        console.warn('[BOT] Erro ao parsear contatos_recentes:', parseErr);
      }
    }
    
    return false;
  } catch (error) {
    console.error('[BOT] Erro ao verificar contato recente:', error);
    // Em caso de erro, verifica so o cache para evitar flood
    return cachedTime ? true : false;
  }
}

/**
 * Marcar cliente como contatado (cache + banco + config)
 */
async function markAsContacted(empresaId: number, phone: string): Promise<void> {
  const cacheKey = `${empresaId}_${phone}`;
  const now = Date.now();
  
  // 1. Sempre atualiza o cache primeiro (imediato)
  recentContactsCache.set(cacheKey, now);
  console.log(`[BOT] Cache atualizado para ${phone}`);
  
  // 2. Tenta atualizar na tabela de clientes
  try {
    const cliente = await noco.findOne(CLIENTES_TABLE_ID, {
      where: `(telefone,eq,${phone})~and(empresa_id,eq,${empresaId})`
    }) as any;
    
    if (cliente?.id || cliente?.Id) {
      const clienteId = cliente.id || cliente.Id;
      await noco.update(CLIENTES_TABLE_ID, {
        id: clienteId,
        ultimo_contato_bot: new Date().toISOString()
      });
      console.log(`[BOT] Cliente ${phone} marcado no banco (ID: ${clienteId})`);
    }
  } catch (clienteError) {
    console.warn('[BOT] Erro ao atualizar cliente:', clienteError);
  }
  
  // 3. Salva tambem na config do bot (contatos_recentes como JSON)
  // Isso garante persistencia mesmo que a tabela de clientes nao tenha o campo
  try {
    const botConfig = await noco.findOne(BOT_CONFIG_TABLE_ID!, {
      where: `(empresa_id,eq,${empresaId})`
    }) as any;
    
    if (botConfig) {
      const configId = botConfig.id || botConfig.Id;
      let contatos: Record<string, number> = {};
      
      // Parse contatos existentes
      if (botConfig.contatos_recentes) {
        try {
          contatos = typeof botConfig.contatos_recentes === 'string' 
            ? JSON.parse(botConfig.contatos_recentes) 
            : botConfig.contatos_recentes;
        } catch (e) {
          contatos = {};
        }
      }
      
      // Adiciona/atualiza este contato
      contatos[phone] = now;
      
      // Remove contatos antigos (mais de 24h) para nao crescer infinitamente
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      for (const [p, t] of Object.entries(contatos)) {
        if (t < oneDayAgo) {
          delete contatos[p];
        }
      }
      
      // Salva de volta
      await noco.update(BOT_CONFIG_TABLE_ID!, {
        id: configId,
        contatos_recentes: JSON.stringify(contatos)
      });
      console.log(`[BOT] Contatos recentes salvos na config (${Object.keys(contatos).length} contatos)`);
    }
  } catch (configError) {
    console.warn('[BOT] Erro ao salvar contatos_recentes:', configError);
  }
  
  // 4. Limpa entradas antigas do cache em memoria
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  for (const [key, timestamp] of recentContactsCache.entries()) {
    if (timestamp < oneDayAgo) {
      recentContactsCache.delete(key);
    }
  }
}

/**
 * Buscar empresa pela instancia Evolution
 */
async function getEmpresaByInstance(instanceName: string): Promise<any> {
  try {
    // Tenta buscar por instancia_evolution exata
    let empresa = await noco.findOne(EMPRESAS_TABLE_ID, {
      where: `(instancia_evolution,eq,${instanceName})`
    }) as any;
    
    if (empresa) {
      return empresa;
    }
    
    // Se nao encontrar, tenta extrair ID do nome (zapflow_ID)
    const match = instanceName.match(/zapflow_(\d+)/);
    if (match) {
      const empresaId = Number(match[1]);
      empresa = await noco.findById(EMPRESAS_TABLE_ID, empresaId) as any;
      return empresa;
    }
    
    return null;
  } catch (error) {
    console.error('[BOT] Erro ao buscar empresa:', error);
    return null;
  }
}

/**
 * Buscar configuracao do bot da empresa
 */
async function getBotConfig(empresaId: number): Promise<any> {
  try {
    if (!BOT_CONFIG_TABLE_ID) {
      console.warn('[BOT] BOT_CONFIG_TABLE_ID nao configurado');
      return null;
    }
    
    const config = await noco.findOne(BOT_CONFIG_TABLE_ID, {
      where: `(empresa_id,eq,${empresaId})`
    }) as any;
    
    return config;
  } catch (error) {
    console.error('[BOT] Erro ao buscar config:', error);
    return null;
  }
}

/**
 * Gerar link do cardapio
 */
function getCardapioLink(empresa: any): string {
  const slug = (empresa.nome_fantasia || empresa.nome || 'loja')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  return `https://cardapio.wzapflow.com.br/menu/${slug}`;
}

// ============================================================
// WEBHOOK HANDLER
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log('[BOT] Webhook Evolution recebido');
    console.log('[BOT] Event:', body.event);
    
    // Apenas processa mensagens recebidas
    if (body.event !== 'messages.upsert') {
      return NextResponse.json({ received: true, ignored: body.event });
    }
    
    const data = body.data;
    const instanceName = body.instance;
    
    // Ignora mensagens enviadas por nos
    if (data.key?.fromMe) {
      return NextResponse.json({ received: true, ignored: 'fromMe' });
    }
    
    // Ignora mensagens de grupo
    if (data.key?.remoteJid?.includes('@g.us')) {
      return NextResponse.json({ received: true, ignored: 'group' });
    }
    
    const phone = extractPhoneFromJid(data.key?.remoteJid || '');
    const messageText = data.message?.conversation || 
                        data.message?.extendedTextMessage?.text || 
                        '';
    
    console.log(`[BOT] Mensagem de ${phone}: "${messageText.substring(0, 50)}..."`);
    console.log(`[BOT] Instancia: ${instanceName}`);
    
    // Buscar empresa pela instancia
    const empresa = await getEmpresaByInstance(instanceName);
    
    if (!empresa) {
      console.log(`[BOT] Empresa nao encontrada para instancia ${instanceName}`);
      return NextResponse.json({ received: true, error: 'empresa_not_found' });
    }
    
    console.log(`[BOT] Empresa encontrada: ${empresa.nome_fantasia} (ID: ${empresa.id})`);
    
    // ========== LOCK IMEDIATO PARA EVITAR PROCESSAMENTO PARALELO ==========
    const lockKey = `${empresa.id}_${phone}`;
    
    // 1. Verificar se ja esta processando (lock ativo)
    if (processingLock.get(lockKey)) {
      console.log(`[BOT] Requisicao paralela detectada para ${phone}, ignorando`);
      return NextResponse.json({ received: true, ignored: 'parallel_request' });
    }
    
    // 2. Verificar cache de curto prazo (30 segundos - evita flood imediato)
    const cachedTime = recentContactsCache.get(lockKey);
    if (cachedTime) {
      const secondsDiff = (Date.now() - cachedTime) / 1000;
      if (secondsDiff < 30) {
        console.log(`[BOT] Cliente ${phone} no cache (${secondsDiff.toFixed(0)}s atras), ignorando`);
        return NextResponse.json({ received: true, recently_contacted: true });
      }
    }
    
    // 3. ATIVAR LOCK IMEDIATAMENTE - antes de qualquer operacao async
    // Mas NAO preenche o cache ainda - so apos verificacao completa no banco
    processingLock.set(lockKey, true);
    console.log(`[BOT] Lock ativado para ${phone}`);
    
    try {
      // Buscar configuracao do bot
      const botConfig = await getBotConfig(empresa.id);
      
      if (!botConfig || !botConfig.bot_ativo) {
        console.log(`[BOT] Bot desativado ou nao configurado para empresa ${empresa.id}`);
        return NextResponse.json({ received: true, bot_disabled: true });
      }
      
      // 4. Verificar se ja foi contatado recentemente (verificacao completa no banco - 6 horas)
      const fullCheckResult = await wasRecentlyContacted(empresa.id, phone);
      if (fullCheckResult) {
        // Preenche o cache para evitar consultas repetidas ao banco
        recentContactsCache.set(lockKey, Date.now());
        return NextResponse.json({ received: true, recently_contacted: true });
      }
      
      // 5. Passou em todas as verificacoes - preenche o cache agora
      recentContactsCache.set(lockKey, Date.now());
      console.log(`[BOT] Cliente ${phone} liberado para receber saudacao`);
    
    // TODO: Verificar horario de funcionamento se configurado
    // (por enquanto ignora essa verificacao)
    
    // Gerar link do cardapio
    const linkCardapio = getCardapioLink(empresa);
    
    // Preparar mensagens
    const mensagens: string[] = [];
    
    if (botConfig.mensagem_1_ativa && botConfig.mensagem_1_texto) {
      mensagens.push(botConfig.mensagem_1_texto.replace('{LINK_CARDAPIO}', linkCardapio));
    }
    
    if (botConfig.mensagem_2_ativa && botConfig.mensagem_2_texto) {
      mensagens.push(botConfig.mensagem_2_texto.replace('{LINK_CARDAPIO}', linkCardapio));
    }
    
    if (botConfig.mensagem_3_ativa && botConfig.mensagem_3_texto) {
      mensagens.push(botConfig.mensagem_3_texto.replace('{LINK_CARDAPIO}', linkCardapio));
    }
    
    if (mensagens.length === 0) {
      console.log(`[BOT] Nenhuma mensagem configurada para empresa ${empresa.id}`);
      return NextResponse.json({ received: true, no_messages: true });
    }
    
    console.log(`[BOT] Enviando ${mensagens.length} mensagem(ns) de saudacao...`);
    
    // Enviar mensagens com delay
    const delayMs = (botConfig.delay_entre_mensagens || 2) * 1000;
    let enviadas = 0;
    
    for (let i = 0; i < mensagens.length; i++) {
      const success = await sendMessage(instanceName, phone, mensagens[i]);
      if (success) enviadas++;
      
      // Delay entre mensagens (exceto na ultima)
      if (i < mensagens.length - 1) {
        await delay(delayMs);
      }
    }
    
      // Marcar cliente como contatado (persistir no banco)
      await markAsContacted(empresa.id, phone);
      
      console.log(`[BOT] Saudacao completa: ${enviadas}/${mensagens.length} mensagens enviadas`);
      
      return NextResponse.json({ 
        received: true, 
        messages_sent: enviadas,
        total_messages: mensagens.length 
      });
      
    } finally {
      // SEMPRE libera o lock de processamento (mas mantem o cache)
      processingLock.delete(lockKey);
      console.log(`[BOT] Lock liberado para ${phone}`);
    }
    
  } catch (error: any) {
    console.error('[BOT] Erro no webhook:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET para verificar se o webhook esta funcionando
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    service: 'evolution-webhook',
    timestamp: new Date().toISOString()
  });
}
