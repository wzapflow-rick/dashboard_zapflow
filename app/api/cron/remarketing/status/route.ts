import { NextResponse } from 'next/server';
import { pg } from '@/lib/postgres';
import { REMARKETING_CONFIG_TABLE } from '@/lib/tables';

/**
 * GET /api/cron/remarketing/status?key=SUA_CHAVE
 * 
 * Verifica o status da instancia Evolution API
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cronKey = searchParams.get('key');
    
    const config = await pg.findOne<{ 
      api_key_cron: string; 
      instance_name: string;
      ativo: boolean;
    }>(REMARKETING_CONFIG_TABLE);
    
    if (!config) {
      return NextResponse.json({ error: 'Sistema nao configurado' }, { status: 400 });
    }
    
    if (cronKey !== config.api_key_cron) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }
    
    if (!config.instance_name) {
      return NextResponse.json({ 
        error: 'Instancia Evolution nao configurada',
        config_ok: false,
      }, { status: 400 });
    }
    
    const EVO_URL = process.env.EVOLUTION_URL || 'https://evo.wzapflow.com.br';
    const EVO_KEY = process.env.EVOLUTION_API_KEY || '';
    
    // Verificar status da instancia
    const statusResponse = await fetch(`${EVO_URL}/instance/connectionState/${config.instance_name}`, {
      method: 'GET',
      headers: {
        'apikey': EVO_KEY,
      },
    });
    
    const statusData = await statusResponse.json();
    
    // Verificar se esta conectado
    const isConnected = statusData?.instance?.state === 'open' || statusData?.state === 'open';
    
    return NextResponse.json({
      success: true,
      instance_name: config.instance_name,
      evolution_url: EVO_URL,
      sistema_ativo: config.ativo,
      connection_state: statusData?.instance?.state || statusData?.state || 'unknown',
      is_connected: isConnected,
      raw_response: statusData,
      message: isConnected 
        ? 'Instancia conectada e pronta para enviar mensagens'
        : 'Instancia NAO conectada! Escaneie o QR Code na Evolution API',
    });
    
  } catch (error) {
    console.error('[Status] Erro:', error);
    return NextResponse.json({ 
      error: 'Erro ao verificar status',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    }, { status: 500 });
  }
}
