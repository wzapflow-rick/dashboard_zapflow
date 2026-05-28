import { NextResponse } from 'next/server';
import { pg } from '@/lib/postgres';
import {
  REMARKETING_CONFIG_TABLE,
  REMARKETING_CONTATOS_TABLE,
  REMARKETING_CATEGORIAS_TABLE,
  REMARKETING_CONTATOS_CATEGORIAS_TABLE,
  REMARKETING_HISTORICO_TABLE,
} from '@/lib/tables';

/**
 * POST /api/cron/remarketing/classificar
 * GET /api/cron/remarketing/classificar?key=SUA_CHAVE (para testes no navegador)
 * 
 * Classifica contatos nas categorias baseado nas regras automaticas.
 * Deve ser executado periodicamente (ex: a cada 6 horas).
 * 
 * Headers (POST):
 *   x-cron-key: SUA_CHAVE_API
 * 
 * Query params (GET):
 *   key: SUA_CHAVE_API
 */

async function handleRequest(cronKey: string | null) {
  const config = await pg.findOne<{ api_key_cron: string; ativo: boolean }>(REMARKETING_CONFIG_TABLE);
  
  if (!config) {
    return NextResponse.json({ error: 'Sistema nao configurado' }, { status: 400 });
  }
  
  if (!config.ativo) {
    return NextResponse.json({ error: 'Sistema desativado' }, { status: 400 });
  }
  
  if (cronKey !== config.api_key_cron) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
  }
  
  // Buscar categorias automaticas
  const categoriasResult = await pg.list<{
    id: number;
    nome: string;
    regras: {
      tipo?: string;
      dias_sem_interacao?: number;
      excluir_etiquetas?: string[];
    } | null;
  }>(REMARKETING_CATEGORIAS_TABLE, {
    where: { tipo_selecao: 'automatica', ativo: true },
  });
  
  const categorias = categoriasResult.list;
  
  if (categorias.length === 0) {
    return NextResponse.json({ 
      success: true, 
      message: 'Nenhuma categoria automatica ativa',
      processados: 0,
      debug: 'Verifique se ha categorias com tipo_selecao = automatica',
    });
  }
  
  let totalProcessados = 0;
  let totalAdicionados = 0;
  let totalRemovidos = 0;
  const debugInfo: { categoria: string; regras: unknown; processados: number }[] = [];
  
  for (const categoria of categorias) {
    let catProcessados = 0;
    
    if (!categoria.regras) {
      debugInfo.push({ categoria: categoria.nome, regras: null, processados: 0 });
      continue;
    }
    
    const regras = categoria.regras;
    
    // Processar regra de inatividade
    if (regras.tipo === 'inativo' && regras.dias_sem_interacao) {
      const diasLimite = regras.dias_sem_interacao;
      
      // Buscar contatos inativos
      const contatosInativos = await pg.raw<{ id: number }>(`
        SELECT id FROM "${REMARKETING_CONTATOS_TABLE}"
        WHERE ativo = true 
          AND bloqueado = false
          AND (
            ultima_interacao IS NULL 
            OR ultima_interacao < NOW() - INTERVAL '${diasLimite} days'
          )
      `);
      
      for (const contato of contatosInativos) {
        // Verificar se ja esta na categoria
        const existe = await pg.raw<{ contato_id: number }>(`
          SELECT contato_id FROM "${REMARKETING_CONTATOS_CATEGORIAS_TABLE}"
          WHERE contato_id = $1 AND categoria_id = $2
        `, [contato.id, categoria.id]);
        
        if (existe.length === 0) {
          // Adicionar na categoria
          await pg.raw(`
            INSERT INTO "${REMARKETING_CONTATOS_CATEGORIAS_TABLE}" 
            (contato_id, categoria_id, adicionado_em, origem)
            VALUES ($1, $2, NOW(), 'regra_automatica')
          `, [contato.id, categoria.id]);
          
          totalAdicionados++;
          
          // Registrar no historico
          await pg.create(REMARKETING_HISTORICO_TABLE, {
            contato_id: contato.id,
            tipo: 'categoria_add',
            descricao: `Adicionado automaticamente a categoria "${categoria.nome}"`,
            dados: JSON.stringify({ categoria_id: categoria.id, regra: 'inativo', dias: diasLimite }),
            created_at: new Date().toISOString(),
          });
        }
        
        totalProcessados++;
        catProcessados++;
      }
      
      // Remover contatos que nao se encaixam mais (ficaram ativos)
      const contatosAtivos = await pg.raw<{ id: number }>(`
        SELECT c.id FROM "${REMARKETING_CONTATOS_TABLE}" c
        INNER JOIN "${REMARKETING_CONTATOS_CATEGORIAS_TABLE}" cc ON cc.contato_id = c.id
        WHERE cc.categoria_id = $1
          AND cc.origem = 'regra_automatica'
          AND c.ultima_interacao >= NOW() - INTERVAL '${diasLimite} days'
      `, [categoria.id]);
      
      for (const contato of contatosAtivos) {
        await pg.raw(`
          DELETE FROM "${REMARKETING_CONTATOS_CATEGORIAS_TABLE}"
          WHERE contato_id = $1 AND categoria_id = $2 AND origem = 'regra_automatica'
        `, [contato.id, categoria.id]);
        
        totalRemovidos++;
        
        // Registrar no historico
        await pg.create(REMARKETING_HISTORICO_TABLE, {
          contato_id: contato.id,
          tipo: 'categoria_remove',
          descricao: `Removido automaticamente da categoria "${categoria.nome}" (voltou a interagir)`,
          dados: JSON.stringify({ categoria_id: categoria.id }),
          created_at: new Date().toISOString(),
        });
      }
    }
    
    debugInfo.push({ categoria: categoria.nome, regras: regras, processados: catProcessados });
  }
  
  // Registrar execucao no historico
  await pg.create(REMARKETING_HISTORICO_TABLE, {
    tipo: 'cron_classificar',
    descricao: `Classificacao executada: ${totalProcessados} analisados, ${totalAdicionados} adicionados, ${totalRemovidos} removidos`,
    dados: JSON.stringify({ totalProcessados, totalAdicionados, totalRemovidos, debugInfo }),
    created_at: new Date().toISOString(),
  });
  
  return NextResponse.json({
    success: true,
    message: 'Classificacao concluida',
    stats: {
      processados: totalProcessados,
      adicionados: totalAdicionados,
      removidos: totalRemovidos,
    },
    debug: debugInfo,
  });
}

export async function POST(request: Request) {
  try {
    const cronKey = request.headers.get('x-cron-key');
    return handleRequest(cronKey);
  } catch (error) {
    console.error('[Cron Classificar] Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cronKey = searchParams.get('key');
    return handleRequest(cronKey);
  } catch (error) {
    console.error('[Cron Classificar] Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
