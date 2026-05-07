import { NextRequest, NextResponse } from 'next/server';
import { noco } from '@/lib/nocodb';
import { 
  EMPRESAS_TABLE_ID, 
  BOT_CONFIG_TABLE_ID,
  CLIENTES_TABLE_ID 
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
 * Verificar se o cliente ja foi contatado recentemente (ultimas 24h)
 */
async function wasRecentlyContacted(empresaId: number, phone: string): Promise<boolean> {
  try {
    // Busca cliente pelo telefone
    const cliente = await noco.findOne(CLIENTES_TABLE_ID, {
      where: `(telefone,eq,${phone})~and(empresa_id,eq,${empresaId})`
    }) as any;
    
    if (!cliente) {
      return false; // Novo cliente, pode enviar saudacao
    }
    
    // Se tem ultimo_contato_bot, verifica se foi nas ultimas 24h
    if (cliente.ultimo_contato_bot) {
      const lastContact = new Date(cliente.ultimo_contato_bot);
      const now = new Date();
      const hoursDiff = (now.getTime() - lastContact.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff < 24) {
        console.log(`[BOT] Cliente ${phone} ja foi contatado ha ${hoursDiff.toFixed(1)}h, ignorando`);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('[BOT] Erro ao verificar contato recente:', error);
    return false;
  }
}

/**
 * Marcar cliente como contatado
 */
async function markAsContacted(empresaId: number, phone: string): Promise<void> {
  try {
    const cliente = await noco.findOne(CLIENTES_TABLE_ID, {
      where: `(telefone,eq,${phone})~and(empresa_id,eq,${empresaId})`
    }) as any;
    
    if (cliente?.id) {
      await noco.update(CLIENTES_TABLE_ID, {
        id: cliente.id,
        ultimo_contato_bot: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('[BOT] Erro ao marcar contato:', error);
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
  
  return `https://zapflow.com.br/loja/${slug}`;
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
    
    // Buscar configuracao do bot
    const botConfig = await getBotConfig(empresa.id);
    
    if (!botConfig || !botConfig.bot_ativo) {
      console.log(`[BOT] Bot desativado ou nao configurado para empresa ${empresa.id}`);
      return NextResponse.json({ received: true, bot_disabled: true });
    }
    
    // Verificar se ja foi contatado recentemente
    if (await wasRecentlyContacted(empresa.id, phone)) {
      return NextResponse.json({ received: true, recently_contacted: true });
    }
    
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
    
    // Marcar cliente como contatado
    await markAsContacted(empresa.id, phone);
    
    console.log(`[BOT] Saudacao completa: ${enviadas}/${mensagens.length} mensagens enviadas`);
    
    return NextResponse.json({ 
      received: true, 
      messages_sent: enviadas,
      total_messages: mensagens.length 
    });
    
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
