import { NextRequest, NextResponse } from 'next/server';
import { cleanupOldAttempts } from '@/lib/rate-limit';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  // Verificar autorizacao do cron
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const deletedCount = await cleanupOldAttempts(24); // Limpar registros com mais de 24 horas
    
    console.log(`[Cron] Rate limit cleanup: ${deletedCount} registros removidos`);
    
    return NextResponse.json({
      success: true,
      deletedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Erro no cleanup de rate limit:', error);
    return NextResponse.json(
      { error: 'Erro ao limpar registros' },
      { status: 500 }
    );
  }
}
