import { NextResponse } from 'next/server';
import { pg } from '@/lib/postgres';
import {
  REMARKETING_CONFIG_TABLE,
  REMARKETING_CONTATOS_TABLE,
  REMARKETING_FILA_TABLE,
  REMARKETING_HISTORICO_TABLE,
} from '@/lib/tables';

interface Config {
  api_key_cron: string;
  ativo: boolean;
  instance_name: string | null;
  horario_inicio: string;
  horario_fim: string;
  dias_semana: number[];
  limite_por_hora: number;
  intervalo_segundos: number;
}

interface FilaItem {
  id: number;
  contato_id: number;
  conteudo_final: string;
  tipo_midia: string;
  midia_url: string | null;
  prioridade: number;
  tentativas: number;
  max_tentativas: number;
}

interface Contato {
  remote_jid: string;
  nome: string | null;
  telefone: string;
}

/**
 * POST /api/cron/remarketing/processar
 * 
 * Processa a fila de mensagens e envia via Evolution API.
 * Deve ser executado frequentemente (ex: a cada 5 minutos).
 * 
 * Headers:
 *   x-cron-key: SUA_CHAVE_API
 */
export async function POST(request: Request) {
  try {
    // Verificar autenticacao
    const cronKey = request.headers.get('x-cron-key');
    
    const config = await pg.findOne<Config>(REMARKETING_CONFIG_TABLE);
    
    if (!config) {
      return NextResponse.json({ error: 'Sistema nao configurado' }, { status: 400 });
    }
    
    if (!config.ativo) {
      return NextResponse.json({ error: 'Sistema desativado' }, { status: 400 });
    }
    
    if (cronKey !== config.api_key_cron) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }
    
    if (!config.instance_name) {
      return NextResponse.json({ error: 'Instancia Evolution nao configurada' }, { status: 400 });
    }
    
    // Verificar horario permitido
    const agora = new Date();
    const horaAtual = agora.getHours() * 60 + agora.getMinutes();
    const [inicioH, inicioM] = config.horario_inicio.split(':').map(Number);
    const [fimH, fimM] = config.horario_fim.split(':').map(Number);
    const inicioMinutos = inicioH * 60 + inicioM;
    const fimMinutos = fimH * 60 + fimM;
    
    if (horaAtual < inicioMinutos || horaAtual > fimMinutos) {
      return NextResponse.json({
        success: true,
        message: 'Fora do horario de envio',
        enviados: 0,
      });
    }
    
    // Verificar dia da semana
    const diaAtual = agora.getDay();
    if (!config.dias_semana.includes(diaAtual)) {
      return NextResponse.json({
        success: true,
        message: 'Dia nao permitido para envio',
        enviados: 0,
      });
    }
    
    // Verificar limite por hora
    const enviadosUltimaHora = await pg.raw<{ count: string }>(`
      SELECT COUNT(*) as count FROM "${REMARKETING_FILA_TABLE}"
      WHERE status = 'enviado' AND enviado_em >= NOW() - INTERVAL '1 hour'
    `);
    const totalUltimaHora = parseInt(enviadosUltimaHora[0]?.count || '0', 10);
    
    if (totalUltimaHora >= config.limite_por_hora) {
      return NextResponse.json({
        success: true,
        message: 'Limite por hora atingido',
        enviados: 0,
      });
    }
    
    const limiteRestante = config.limite_por_hora - totalUltimaHora;
    
    // Buscar itens pendentes da fila (ordenados por prioridade e data)
    const fila = await pg.raw<FilaItem>(`
      SELECT id, contato_id, conteudo_final, tipo_midia, midia_url, prioridade, tentativas, max_tentativas
      FROM "${REMARKETING_FILA_TABLE}"
      WHERE status = 'pendente'
        AND agendado_para <= NOW()
      ORDER BY prioridade ASC, agendado_para ASC
      LIMIT $1
    `, [limiteRestante]);
    
    if (fila.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum item na fila',
        enviados: 0,
      });
    }
    
    const EVO_URL = process.env.EVOLUTION_URL || 'https://evo.wzapflow.com.br';
    const EVO_KEY = process.env.EVOLUTION_API_KEY || '';
    
    let totalEnviados = 0;
    let totalErros = 0;
    
    for (const item of fila) {
      // Marcar como enviando
      await pg.update(REMARKETING_FILA_TABLE, item.id, { status: 'enviando' });
      
      // Buscar contato
      const contato = await pg.findById<Contato>(REMARKETING_CONTATOS_TABLE, item.contato_id);
      
      if (!contato) {
        await pg.update(REMARKETING_FILA_TABLE, item.id, {
          status: 'erro',
          erro: 'Contato nao encontrado',
          tentativas: item.tentativas + 1,
        });
        totalErros++;
        continue;
      }
      
      try {
        // Enviar mensagem via Evolution API
        let response: Response;
        
        if (item.tipo_midia === 'texto') {
          response = await fetch(`${EVO_URL}/message/sendText/${config.instance_name}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': EVO_KEY,
            },
            body: JSON.stringify({
              number: contato.remote_jid,
              text: item.conteudo_final,
            }),
          });
        } else if (item.tipo_midia === 'imagem' && item.midia_url) {
          response = await fetch(`${EVO_URL}/message/sendMedia/${config.instance_name}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': EVO_KEY,
            },
            body: JSON.stringify({
              number: contato.remote_jid,
              mediatype: 'image',
              media: item.midia_url,
              caption: item.conteudo_final,
            }),
          });
        } else if (item.tipo_midia === 'video' && item.midia_url) {
          response = await fetch(`${EVO_URL}/message/sendMedia/${config.instance_name}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': EVO_KEY,
            },
            body: JSON.stringify({
              number: contato.remote_jid,
              mediatype: 'video',
              media: item.midia_url,
              caption: item.conteudo_final,
            }),
          });
        } else if (item.tipo_midia === 'audio' && item.midia_url) {
          response = await fetch(`${EVO_URL}/message/sendWhatsAppAudio/${config.instance_name}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': EVO_KEY,
            },
            body: JSON.stringify({
              number: contato.remote_jid,
              audio: item.midia_url,
            }),
          });
        } else if (item.tipo_midia === 'documento' && item.midia_url) {
          response = await fetch(`${EVO_URL}/message/sendMedia/${config.instance_name}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': EVO_KEY,
            },
            body: JSON.stringify({
              number: contato.remote_jid,
              mediatype: 'document',
              media: item.midia_url,
              caption: item.conteudo_final,
            }),
          });
        } else {
          // Fallback para texto
          response = await fetch(`${EVO_URL}/message/sendText/${config.instance_name}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': EVO_KEY,
            },
            body: JSON.stringify({
              number: contato.remote_jid,
              text: item.conteudo_final,
            }),
          });
        }
        
        const responseData = await response.json();
        
        if (response.ok) {
          // Sucesso
          await pg.update(REMARKETING_FILA_TABLE, item.id, {
            status: 'enviado',
            enviado_em: new Date().toISOString(),
            tentativas: item.tentativas + 1,
          });
          
          // Atualizar ultima_msg_remarketing do contato
          await pg.update(REMARKETING_CONTATOS_TABLE, item.contato_id, {
            ultima_msg_remarketing: new Date().toISOString(),
            total_msgs_enviadas: pg.raw(`total_msgs_enviadas + 1`),
          });
          
          // Registrar no historico
          await pg.create(REMARKETING_HISTORICO_TABLE, {
            contato_id: item.contato_id,
            tipo: 'msg_enviada',
            descricao: `Mensagem enviada: ${item.conteudo_final.substring(0, 100)}...`,
            dados: JSON.stringify({ fila_id: item.id, tipo_midia: item.tipo_midia }),
            created_at: new Date().toISOString(),
          });
          
          totalEnviados++;
        } else {
          // Erro no envio
          const novasTentativas = item.tentativas + 1;
          const novoStatus = novasTentativas >= item.max_tentativas ? 'erro' : 'pendente';
          
          await pg.update(REMARKETING_FILA_TABLE, item.id, {
            status: novoStatus,
            erro: responseData.message || 'Erro no envio',
            tentativas: novasTentativas,
          });
          
          if (novoStatus === 'erro') {
            await pg.create(REMARKETING_HISTORICO_TABLE, {
              contato_id: item.contato_id,
              tipo: 'msg_erro',
              descricao: `Erro ao enviar: ${responseData.message || 'Erro desconhecido'}`,
              dados: JSON.stringify({ fila_id: item.id, erro: responseData }),
              created_at: new Date().toISOString(),
            });
          }
          
          totalErros++;
        }
      } catch (err) {
        // Erro de conexao
        const novasTentativas = item.tentativas + 1;
        const novoStatus = novasTentativas >= item.max_tentativas ? 'erro' : 'pendente';
        
        await pg.update(REMARKETING_FILA_TABLE, item.id, {
          status: novoStatus,
          erro: 'Erro de conexao com Evolution API',
          tentativas: novasTentativas,
        });
        
        totalErros++;
      }
      
      // Aguardar intervalo entre envios
      if (config.intervalo_segundos > 0) {
        await new Promise(resolve => setTimeout(resolve, config.intervalo_segundos * 1000));
      }
    }
    
    // Registrar execucao no historico
    await pg.create(REMARKETING_HISTORICO_TABLE, {
      tipo: 'cron_processar',
      descricao: `Processamento executado: ${totalEnviados} enviados, ${totalErros} erros`,
      dados: JSON.stringify({ totalEnviados, totalErros }),
      created_at: new Date().toISOString(),
    });
    
    return NextResponse.json({
      success: true,
      message: 'Processamento concluido',
      enviados: totalEnviados,
      erros: totalErros,
    });
    
  } catch (error) {
    console.error('[Cron Processar] Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
