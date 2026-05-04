import { NextRequest, NextResponse } from 'next/server';
import { executarDisparoCampanhas } from '@/lib/campanhas-service';

// Protege o endpoint para ser chamado apenas pelo Vercel Cron
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
    // Verificar autenticacao do CRON
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
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
