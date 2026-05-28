import { NextRequest, NextResponse } from 'next/server';
import { pg } from '@/lib/postgres';
import {
  REMARKETING_CONFIG_TABLE,
  REMARKETING_HISTORICO_TABLE,
  REMARKETING_FILA_TABLE,
} from '@/lib/tables';

// POST /api/cron/remarketing/limpar
// Limpa historico antigo e itens processados da fila
export async function POST(request: NextRequest) {
  try {
    // Verificar chave de autenticacao
    const cronKey = request.headers.get('x-cron-key');
    
    if (!cronKey) {
      return NextResponse.json(
        { error: 'Chave de autenticacao nao fornecida' },
        { status: 401 }
      );
    }

    // Buscar configuracao
    const config = await pg.findOne<{ api_key_cron: string; ativo: boolean }>(REMARKETING_CONFIG_TABLE);

    if (!config) {
      return NextResponse.json(
        { error: 'Sistema de remarketing nao configurado' },
        { status: 400 }
      );
    }

    if (config.api_key_cron !== cronKey) {
      return NextResponse.json(
        { error: 'Chave de autenticacao invalida' },
        { status: 401 }
      );
    }

    if (!config.ativo) {
      return NextResponse.json({
        success: true,
        message: 'Sistema de remarketing desativado',
        cleaned: { historico: 0, fila: 0 }
      });
    }

    // Limpar historico com mais de 90 dias
    const historicoRemovidos = await pg.raw(`
      DELETE FROM "${REMARKETING_HISTORICO_TABLE}"
      WHERE created_at < NOW() - INTERVAL '90 days'
    `);

    // Limpar fila com status 'enviado', 'erro' ou 'cancelado' com mais de 30 dias
    const filaRemovidos = await pg.raw(`
      DELETE FROM "${REMARKETING_FILA_TABLE}"
      WHERE status IN ('enviado', 'erro', 'cancelado')
      AND created_at < NOW() - INTERVAL '30 days'
    `);

    // Registrar limpeza no historico
    await pg.create(REMARKETING_HISTORICO_TABLE, {
      tipo: 'sistema_limpeza',
      descricao: `Limpeza automatica executada`,
      dados: JSON.stringify({
        executed_at: new Date().toISOString()
      }),
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Limpeza concluida',
      cleaned: {
        historico: historicoRemovidos.length,
        fila: filaRemovidos.length
      }
    });

  } catch (error) {
    console.error('[Cron Limpar] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno ao executar limpeza' },
      { status: 500 }
    );
  }
}
