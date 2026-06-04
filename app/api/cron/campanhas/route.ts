import { NextRequest, NextResponse } from 'next/server';
import { executarDisparoCampanhas } from '@/lib/campanhas-service';

// Protege o endpoint para ser chamado apenas pelo cron (crontab da VPS)
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Aceita autenticacao por:
 *   - header  x-cron-key: <CRON_SECRET>      (padrao usado pelo crontab da VPS)
 *   - header  Authorization: Bearer <CRON_SECRET>  (compatibilidade)
 */
function isAuthorized(request: NextRequest): boolean {
    if (!CRON_SECRET) {
        console.warn('[CRON] CRON_SECRET nao configurado — negando acesso por seguranca');
        return false;
    }
    const cronKey = request.headers.get('x-cron-key');
    const authHeader = request.headers.get('authorization');
    return cronKey === CRON_SECRET || authHeader === `Bearer ${CRON_SECRET}`;
}

async function handleCampanhas(request: NextRequest) {
    // Verificar autenticacao do CRON
    if (!isAuthorized(request)) {
        console.log('[CRON] Autorizacao invalida');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // No CRON automatico, verificar horario (ignorarHorario = false)
    const result = await executarDisparoCampanhas(false);
    
    if (!result.success) {
        return NextResponse.json(result, { status: 500 });
    }
    
    return NextResponse.json({
        ...result,
        timestamp: new Date().toISOString()
    });
}

export async function GET(request: NextRequest) {
    return handleCampanhas(request);
}

export async function POST(request: NextRequest) {
    return handleCampanhas(request);
}
