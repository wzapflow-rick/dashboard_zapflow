import { NextResponse } from 'next/server';
import { pg } from '@/lib/postgres';
import {
  REMARKETING_CONFIG_TABLE,
  REMARKETING_CONTATOS_TABLE,
  REMARKETING_CONTATOS_CATEGORIAS_TABLE,
  REMARKETING_CATEGORIAS_TABLE,
  REMARKETING_MENSAGENS_TABLE,
  REMARKETING_COMBINACOES_TABLE,
  REMARKETING_FILA_TABLE,
  REMARKETING_HISTORICO_TABLE,
} from '@/lib/tables';

interface Contato {
  id: number;
  nome: string | null;
  telefone: string;
  ultima_msg_remarketing: string | null;
}

interface Categoria {
  id: number;
  nome: string;
  prioridade: number;
  cooldown_horas: number;
  mensagem_modo: string;
}

interface Combinacao {
  mensagem_id: number;
  tipo_dor_id: number;
}

interface Mensagem {
  id: number;
  nome: string;
  conteudo: string;
  tipo_midia: string;
  midia_url: string | null;
  tipo_dor_id: number | null;
}

/**
 * POST /api/cron/remarketing/agendar
 * 
 * Agenda mensagens na fila para contatos das categorias.
 * Deve ser executado periodicamente (ex: a cada hora).
 * 
 * Headers:
 *   x-cron-key: SUA_CHAVE_API
 */
export async function POST(request: Request) {
  try {
    // Verificar autenticacao
    const cronKey = request.headers.get('x-cron-key');
    
    const config = await pg.findOne<{ api_key_cron: string; ativo: boolean; limite_por_dia: number }>(REMARKETING_CONFIG_TABLE);
    
    if (!config) {
      return NextResponse.json({ error: 'Sistema nao configurado' }, { status: 400 });
    }
    
    if (!config.ativo) {
      return NextResponse.json({ error: 'Sistema desativado' }, { status: 400 });
    }
    
    if (cronKey !== config.api_key_cron) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }
    
    // Verificar limite diario
    const enviadosHoje = await pg.raw<{ count: string }>(`
      SELECT COUNT(*) as count FROM "${REMARKETING_FILA_TABLE}"
      WHERE created_at >= CURRENT_DATE AND status != 'cancelado'
    `);
    const totalHoje = parseInt(enviadosHoje[0]?.count || '0', 10);
    
    if (totalHoje >= config.limite_por_dia) {
      return NextResponse.json({
        success: true,
        message: 'Limite diario atingido',
        agendados: 0,
      });
    }
    
    const limiteRestante = config.limite_por_dia - totalHoje;
    
    // Buscar categorias ativas
    const categoriasResult = await pg.list<Categoria>(REMARKETING_CATEGORIAS_TABLE, {
      where: { ativo: true },
      sort: 'prioridade',
    });
    
    const categorias = categoriasResult.list;
    
    if (categorias.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhuma categoria ativa',
        agendados: 0,
      });
    }
    
    let totalAgendados = 0;
    
    for (const categoria of categorias) {
      if (totalAgendados >= limiteRestante) break;
      
      // Buscar contatos da categoria que podem receber mensagem (respeitando cooldown)
      const contatos = await pg.raw<Contato>(`
        SELECT c.id, c.nome, c.telefone, c.ultima_msg_remarketing
        FROM "${REMARKETING_CONTATOS_TABLE}" c
        INNER JOIN "${REMARKETING_CONTATOS_CATEGORIAS_TABLE}" cc ON cc.contato_id = c.id
        WHERE cc.categoria_id = $1
          AND c.ativo = true
          AND c.bloqueado = false
          AND (
            c.ultima_msg_remarketing IS NULL
            OR c.ultima_msg_remarketing < NOW() - INTERVAL '${categoria.cooldown_horas} hours'
          )
          AND NOT EXISTS (
            SELECT 1 FROM "${REMARKETING_FILA_TABLE}" f
            WHERE f.contato_id = c.id 
              AND f.status IN ('pendente', 'enviando')
          )
        ORDER BY c.ultima_msg_remarketing NULLS FIRST
        LIMIT $2
      `, [categoria.id, limiteRestante - totalAgendados]);
      
      for (const contato of contatos) {
        if (totalAgendados >= limiteRestante) break;
        
        // Buscar mensagem para enviar
        let mensagem: Mensagem | null = null;
        
        if (categoria.mensagem_modo === 'automatico') {
          // Buscar combinacao para essa categoria
          const combinacoes = await pg.raw<Combinacao>(`
            SELECT mensagem_id, tipo_dor_id FROM "${REMARKETING_COMBINACOES_TABLE}"
            WHERE categoria_id = $1 AND ativo = true
            ORDER BY prioridade
            LIMIT 1
          `, [categoria.id]);
          
          if (combinacoes.length > 0) {
            const msg = await pg.findById<Mensagem>(REMARKETING_MENSAGENS_TABLE, combinacoes[0].mensagem_id);
            if (msg && msg.ativo) {
              mensagem = msg;
            }
          }
          
          // Se nao tiver combinacao, buscar mensagem generica
          if (!mensagem) {
            const genericMsgs = await pg.list<Mensagem>(REMARKETING_MENSAGENS_TABLE, {
              where: { ativo: true },
              limit: 1,
            });
            if (genericMsgs.list.length > 0) {
              mensagem = genericMsgs.list[0];
            }
          }
        }
        
        if (!mensagem) {
          continue; // Nenhuma mensagem disponivel
        }
        
        // Processar variaveis na mensagem
        let conteudoFinal = mensagem.conteudo;
        conteudoFinal = conteudoFinal.replace(/\{\{nome\}\}/g, contato.nome || 'Cliente');
        conteudoFinal = conteudoFinal.replace(/\{\{telefone\}\}/g, contato.telefone || '');
        
        // Calcular dias de ausencia
        if (contato.ultima_msg_remarketing) {
          const diasAusente = Math.floor(
            (Date.now() - new Date(contato.ultima_msg_remarketing).getTime()) / (1000 * 60 * 60 * 24)
          );
          conteudoFinal = conteudoFinal.replace(/\{\{dias_ausente\}\}/g, diasAusente.toString());
        } else {
          conteudoFinal = conteudoFinal.replace(/\{\{dias_ausente\}\}/g, '');
        }
        
        // Adicionar na fila
        await pg.create(REMARKETING_FILA_TABLE, {
          contato_id: contato.id,
          mensagem_id: mensagem.id,
          categoria_id: categoria.id,
          tipo_dor_id: mensagem.tipo_dor_id,
          prioridade: categoria.prioridade,
          conteudo_final: conteudoFinal,
          tipo_midia: mensagem.tipo_midia,
          midia_url: mensagem.midia_url,
          agendado_para: new Date().toISOString(),
          status: 'pendente',
          tentativas: 0,
          max_tentativas: 3,
          created_at: new Date().toISOString(),
        });
        
        totalAgendados++;
      }
    }
    
    // Registrar execucao no historico
    await pg.create(REMARKETING_HISTORICO_TABLE, {
      tipo: 'cron_agendar',
      descricao: `Agendamento executado: ${totalAgendados} mensagens agendadas`,
      dados: JSON.stringify({ totalAgendados }),
      created_at: new Date().toISOString(),
    });
    
    return NextResponse.json({
      success: true,
      message: 'Agendamento concluido',
      agendados: totalAgendados,
    });
    
  } catch (error) {
    console.error('[Cron Agendar] Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
