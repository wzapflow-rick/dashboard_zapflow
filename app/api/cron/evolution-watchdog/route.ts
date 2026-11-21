import { NextRequest, NextResponse } from 'next/server';
import { pg } from '@/lib/postgres';
import { cronKeyMatches } from '@/lib/cron-auth';
import { logCronRun } from '@/lib/cron-logger';
import { notifyWhatsAppDisconnected } from '@/lib/discord';
import {
    getInstanceStatus,
    restartEvolutionInstance,
    reconnectEvolutionInstance,
    configureInstanceWebhook,
} from '@/lib/evolution';
import { getInstanceHealthMap, saveInstanceState } from '@/lib/evolution-health';

export const maxDuration = 300;

// Sem nenhum evento por este tempo, a sessao e considerada zumbi e reiniciada.
// Reiniciar uma sessao saudavel e inofensivo: reconecta sozinha, sem QR.
const STALE_MINUTES = 120;
// Intervalo minimo entre restarts da mesma instancia.
const RESTART_COOLDOWN_MINUTES = 30;
// Depois de N restarts sem voltar a receber eventos, avisa no Discord.
const ALERT_AFTER_RESTARTS = 3;
const SETTLE_MS = 8_000;

function isAuthorized(request: NextRequest): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;
    const auth = request.headers.get('authorization');
    const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    return cronKeyMatches(request.headers.get('x-cron-key'), secret) || cronKeyMatches(bearer, secret);
}

function minutesSince(date: string | null | undefined): number {
    if (!date) return Infinity;
    return (Date.now() - new Date(date).getTime()) / 60_000;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Acao = 'ok' | 'reiniciada' | 'reconectada' | 'precisa_qr' | 'aguardando_cooldown' | 'evolution_indisponivel';

async function handle(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startedAt = Date.now();
    try {
        const empresas = await pg.raw<{ id: number; nome_fantasia: string | null; instancia_evolution: string }>(
            `SELECT id, nome_fantasia, instancia_evolution
               FROM empresas
              WHERE instancia_evolution IS NOT NULL AND instancia_evolution <> ''`
        );
        const health = await getInstanceHealthMap();
        const resultados: Array<{ instancia: string; estado: string | null; acao: Acao; motivo?: string }> = [];

        for (const empresa of empresas) {
            const instancia = empresa.instancia_evolution;
            const h = health.get(instancia);
            const status = await getInstanceStatus(instancia);

            if (status.error || !status.state) {
                resultados.push({ instancia, estado: null, acao: 'evolution_indisponivel', motivo: status.error ?? undefined });
                continue;
            }

            const estado = status.state;
            const conectada = estado === 'open';
            const semEventosMin = h ? minutesSince(h.ultimo_evento) : 0;
            const zumbi = conectada && semEventosMin > STALE_MINUTES;

            if (conectada) {
                // Reaplica o webhook: garante URL/eventos certos mesmo se alguem alterou no painel.
                await configureInstanceWebhook(instancia);
            }

            if (conectada && !zumbi) {
                await saveInstanceState(instancia, estado);
                resultados.push({ instancia, estado, acao: 'ok' });
                continue;
            }

            if (h && minutesSince(h.ultimo_restart) < RESTART_COOLDOWN_MINUTES) {
                await saveInstanceState(instancia, estado);
                resultados.push({ instancia, estado, acao: 'aguardando_cooldown' });
                continue;
            }

            const motivo = zumbi ? `sem eventos ha ${Math.round(semEventosMin)} min` : `estado ${estado}`;
            console.log(`[WATCHDOG] Reiniciando ${instancia} (${empresa.nome_fantasia}): ${motivo}`);

            await restartEvolutionInstance(instancia);
            await sleep(SETTLE_MS);
            let depois = (await getInstanceStatus(instancia)).state;
            let acao: Acao = 'reiniciada';

            if (depois !== 'open') {
                const reconnect = await reconnectEvolutionInstance(instancia);
                await sleep(SETTLE_MS);
                depois = (await getInstanceStatus(instancia)).state;
                acao = depois === 'open' ? 'reconectada' : reconnect.needsQr ? 'precisa_qr' : 'reiniciada';
            }

            if (depois === 'open') {
                await configureInstanceWebhook(instancia);
            }

            await saveInstanceState(instancia, depois || estado, { restarted: true });
            const restarts = (h?.restarts_seguidos ?? 0) + 1;

            if (acao === 'precisa_qr' || restarts >= ALERT_AFTER_RESTARTS) {
                await notifyWhatsAppDisconnected({
                    empresaId: empresa.id,
                    nomeFantasia: empresa.nome_fantasia || 'N/A',
                    instancia,
                    motivo:
                        acao === 'precisa_qr'
                            ? 'Sessao perdida: a loja precisa ler o QR Code novamente'
                            : `Watchdog reiniciou ${restarts}x e a instancia continua sem receber mensagens`,
                });
            }

            resultados.push({ instancia, estado: depois, acao, motivo });
        }

        const resumo = resultados.reduce<Record<string, number>>((acc, r) => {
            acc[r.acao] = (acc[r.acao] ?? 0) + 1;
            return acc;
        }, {});

        await logCronRun({
            jobName: 'evolution-watchdog',
            status: 'success',
            summary: { total: resultados.length, ...resumo },
            durationMs: Date.now() - startedAt,
        });

        return NextResponse.json({ success: true, resumo, resultados });
    } catch (error: any) {
        console.error('[WATCHDOG] Erro:', error);
        await logCronRun({
            jobName: 'evolution-watchdog',
            status: 'error',
            summary: { error: error?.message },
            durationMs: Date.now() - startedAt,
        });
        return NextResponse.json({ error: 'Erro no watchdog' }, { status: 500 });
    }
}

export const GET = handle;
export const POST = handle;
