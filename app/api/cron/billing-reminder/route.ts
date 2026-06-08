import { NextRequest, NextResponse } from 'next/server';
import { pg } from '@/lib/postgres';
import { sendRenewalReminder } from '@/app/actions/whatsapp';
import { logCronRun } from '@/lib/cron-logger';

// Protege o endpoint para ser chamado apenas pelo cron (crontab da VPS)
const CRON_SECRET = process.env.CRON_SECRET;

// Dias antes da cobranca em que o lembrete e enviado
const DIAS_AVISO = [3, 1];

/**
 * Aceita autenticacao por:
 *   - header  x-cron-key: <CRON_SECRET>            (padrao usado pelo crontab da VPS)
 *   - header  Authorization: Bearer <CRON_SECRET>  (compatibilidade)
 */
function isAuthorized(request: NextRequest): boolean {
    if (!CRON_SECRET) {
        console.warn('[CRON billing-reminder] CRON_SECRET nao configurado — negando acesso por seguranca');
        return false;
    }
    const cronKey = request.headers.get('x-cron-key');
    const authHeader = request.headers.get('authorization');
    return cronKey === CRON_SECRET || authHeader === `Bearer ${CRON_SECRET}`;
}

async function handleBillingReminder(request: NextRequest) {
    if (!isAuthorized(request)) {
        console.log('[CRON billing-reminder] Autorizacao invalida');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const startedAt = Date.now();
        const hojeStr = new Date().toISOString().split('T')[0];

        // Buscar assinaturas ativas cuja proxima cobranca cai em 3 ou 1 dia(s),
        // que ainda nao receberam aviso hoje, com a loja nao bloqueada.
        const result = await pg.raw<{
            assinatura_id: number;
            empresa_id: number;
            nome_fantasia: string | null;
            telefone_loja: string | null;
            valor: string | null;
            cartao_ultimos_digitos: string | null;
            data_proxima_cobranca: string;
            dias_restantes: number;
        }>(
            `SELECT
                a.id                       AS assinatura_id,
                a.empresa_id               AS empresa_id,
                e.nome_fantasia            AS nome_fantasia,
                e.telefone_loja            AS telefone_loja,
                a.valor                    AS valor,
                a.cartao_ultimos_digitos   AS cartao_ultimos_digitos,
                a.data_proxima_cobranca    AS data_proxima_cobranca,
                (a.data_proxima_cobranca - CURRENT_DATE) AS dias_restantes
             FROM assinaturas a
             JOIN empresas e ON e.id = a.empresa_id
             WHERE a.data_proxima_cobranca IS NOT NULL
               AND (a.status IS NULL OR a.status IN ('active', 'authorized', 'ativo'))
               AND COALESCE(e.bloqueado, false) = false
               AND (a.data_proxima_cobranca - CURRENT_DATE) = ANY($1::int[])
               AND (a.ultimo_aviso_renovacao IS NULL OR a.ultimo_aviso_renovacao <> CURRENT_DATE)`,
            [DIAS_AVISO]
        );

        const assinaturas = result || [];
        console.log(`[CRON billing-reminder] ${assinaturas.length} assinatura(s) para avisar (${hojeStr})`);

        let enviados = 0;
        let semTelefone = 0;
        let falhas = 0;

        for (const a of assinaturas) {
            const telefone = a.telefone_loja?.trim();
            const nome = a.nome_fantasia || 'tudo bem';

            if (!telefone) {
                semTelefone++;
                console.warn(`[CRON billing-reminder] Empresa ${a.empresa_id} sem telefone_loja — pulando`);
                continue;
            }

            const ok = await sendRenewalReminder(
                telefone,
                nome,
                Number(a.dias_restantes),
                a.valor != null ? Number(a.valor) : null,
                a.cartao_ultimos_digitos
            );

            if (ok) {
                enviados++;
                // Marca que ja avisou hoje (evita duplicar no mesmo dia)
                await pg.raw(
                    'UPDATE assinaturas SET ultimo_aviso_renovacao = CURRENT_DATE WHERE id = $1',
                    [a.assinatura_id]
                );
            } else {
                falhas++;
                console.error(`[CRON billing-reminder] Falha ao enviar para empresa ${a.empresa_id}`);
            }
        }

        const summary = {
            candidatos: assinaturas.length,
            enviados,
            semTelefone,
            falhas,
        };

        await logCronRun({
            jobName: 'billing-reminder',
            status: 'success',
            summary,
            durationMs: Date.now() - startedAt,
        });

        return NextResponse.json({
            success: true,
            message: 'Lembretes de renovacao processados',
            ...summary,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('[CRON billing-reminder] Erro:', error);
        await logCronRun({
            jobName: 'billing-reminder',
            status: 'error',
            summary: { error: error?.message ?? 'erro desconhecido' },
        });
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    return handleBillingReminder(request);
}

export async function POST(request: NextRequest) {
    return handleBillingReminder(request);
}
