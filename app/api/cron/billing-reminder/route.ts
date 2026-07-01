import { NextRequest, NextResponse } from 'next/server';
import { pg } from '@/lib/postgres';
import { sendRenewalReminder } from '@/app/actions/whatsapp';
import { criarLinkPagamentoRenovacao } from '@/app/actions/billing-renewal';
import { notifyBillingReminder } from '@/lib/discord';
import { logCronRun } from '@/lib/cron-logger';

// Protege o endpoint para ser chamado apenas pelo cron (crontab da VPS)
const CRON_SECRET = process.env.CRON_SECRET;

// Janelas de aviso (em dias antes do vencimento). O lembrete e enviado 1x/dia
// dentro da janela ate o dia do vencimento (0):
//   - Cliente PAGANTE (valor > 0): dos 7 dias ate o vencimento
//   - Conta de TESTE  (valor = 0): dos 3 dias ate o fim do teste
const DIAS_AVISO_PAGANTE = 7;
const DIAS_AVISO_TESTE = 3;

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

        // Buscar assinaturas ativas dentro da janela de aviso, que ainda nao
        // receberam lembrete hoje, com a loja nao bloqueada.
        //   - Teste  (valor 0 / null): 0..3 dias para o vencimento
        //   - Pagante (valor > 0):     0..7 dias para o vencimento
        // O lembrete e enviado 1x/dia (dedupe por ultimo_aviso_renovacao).
        const result = await pg.raw<{
            assinatura_id: number;
            empresa_id: number;
            nome_fantasia: string | null;
            telefone_loja: string | null;
            plano: string | null;
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
                a.plano                    AS plano,
                a.valor                    AS valor,
                a.cartao_ultimos_digitos   AS cartao_ultimos_digitos,
                a.data_proxima_cobranca    AS data_proxima_cobranca,
                (a.data_proxima_cobranca - CURRENT_DATE) AS dias_restantes
             FROM assinaturas a
             JOIN empresas e ON e.id = a.empresa_id
             WHERE a.data_proxima_cobranca IS NOT NULL
               AND (a.status IS NULL OR a.status IN ('active', 'authorized', 'ativo'))
               AND COALESCE(e.bloqueado, false) = false
               AND (a.data_proxima_cobranca - CURRENT_DATE) >= 0
               AND (
                     -- Conta de teste (gratuita): janela de 3 dias
                     (COALESCE(a.valor, 0) <= 0 AND (a.data_proxima_cobranca - CURRENT_DATE) <= $1)
                     -- Cliente pagante: janela de 7 dias
                  OR (COALESCE(a.valor, 0) > 0  AND (a.data_proxima_cobranca - CURRENT_DATE) <= $2)
                   )
               AND (a.ultimo_aviso_renovacao IS NULL OR a.ultimo_aviso_renovacao <> CURRENT_DATE)`,
            [DIAS_AVISO_TESTE, DIAS_AVISO_PAGANTE]
        );

        const assinaturas = result || [];
        console.log(`[CRON billing-reminder] ${assinaturas.length} assinatura(s) para avisar (${hojeStr})`);

        let enviados = 0;
        let semTelefone = 0;
        let falhas = 0;
        let testes = 0;
        let pagantes = 0;
        const errosDetalhe: string[] = [];

        for (const a of assinaturas) {
            const telefone = a.telefone_loja?.trim();
            const nome = a.nome_fantasia || 'tudo bem';
            const valor = a.valor != null ? Number(a.valor) : 0;
            const diasRestantes = Number(a.dias_restantes);
            const tipo: 'teste' | 'pagante' = valor > 0 ? 'pagante' : 'teste';
            if (tipo === 'teste') testes++; else pagantes++;

            if (!telefone) {
                semTelefone++;
                console.warn(`[CRON billing-reminder] Empresa ${a.empresa_id} sem telefone_loja — pulando`);
                continue;
            }

            // Gera um link de pagamento real (PIX/Mercado Pago). Para contas de
            // teste/plano gratuito, retorna a pagina de assinatura como fallback.
            let linkPagamento: string | undefined;
            try {
                const link = await criarLinkPagamentoRenovacao(a.empresa_id, a.plano);
                linkPagamento = link.url;
            } catch (linkErr) {
                console.error(`[CRON billing-reminder] Falha ao gerar link para empresa ${a.empresa_id}:`, linkErr);
            }

            const res = await sendRenewalReminder(
                telefone,
                nome,
                diasRestantes,
                valor,
                a.cartao_ultimos_digitos,
                { tipo, linkPagamento }
            );

            if (res.success) {
                enviados++;
                // Marca que ja avisou hoje (evita duplicar no mesmo dia)
                await pg.raw(
                    'UPDATE assinaturas SET ultimo_aviso_renovacao = CURRENT_DATE WHERE id = $1',
                    [a.assinatura_id]
                );
            } else {
                falhas++;
                const nomeEmpresa = a.nome_fantasia || `empresa ${a.empresa_id}`;
                const detalhe = `${nomeEmpresa}: ${res.error ?? 'falha desconhecida'}`;
                errosDetalhe.push(detalhe);
                console.error(`[CRON billing-reminder] Falha ao enviar para ${nomeEmpresa}: ${res.error}`);
            }

            // Aviso no Discord a cada lembrete (enviado ou falho)
            try {
                await notifyBillingReminder({
                    empresaId: a.empresa_id,
                    nomeFantasia: nome,
                    tipo,
                    plano: a.plano || 'N/A',
                    valor,
                    diasRestantes,
                    telefone,
                    enviado: res.success,
                });
            } catch (discordErr) {
                console.error(`[CRON billing-reminder] Falha ao notificar Discord (empresa ${a.empresa_id}):`, discordErr);
            }
        }

        const summary: Record<string, any> = {
            candidatos: assinaturas.length,
            enviados,
            testes,
            pagantes,
            semTelefone,
            falhas,
        };
        if (errosDetalhe.length > 0) {
            // Mostra ate 5 motivos no painel de monitoramento
            summary.motivoFalhas = errosDetalhe.slice(0, 5).join(' | ');
        }

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
