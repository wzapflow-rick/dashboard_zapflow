import { pg } from '@/lib/postgres';

/**
 * Saude das instancias Evolution, usada pelo watchdog para detectar sessoes
 * "zumbis" (conectadas, mas sem entregar eventos ao webhook).
 *
 * Tabela (criar manualmente no pgAdmin):
 *   CREATE TABLE IF NOT EXISTS evolution_instance_health (
 *     instancia           TEXT PRIMARY KEY,
 *     ultimo_evento       TIMESTAMPTZ,
 *     ultimo_estado       TEXT,
 *     ultimo_restart      TIMESTAMPTZ,
 *     restarts_seguidos   INTEGER NOT NULL DEFAULT 0,
 *     atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 */

export interface InstanceHealth {
    instancia: string;
    ultimo_evento: string | null;
    ultimo_estado: string | null;
    ultimo_restart: string | null;
    restarts_seguidos: number;
}

const TOUCH_THROTTLE_MS = 60_000;
const lastTouch = new Map<string, number>();

/**
 * Registra que a instancia entregou um evento ao webhook. Limitado a 1 escrita
 * por minuto por instancia para nao gerar carga no banco. Nunca lanca excecao.
 */
export async function touchInstanceEvent(instancia: string | undefined | null): Promise<void> {
    if (!instancia) return;
    const now = Date.now();
    if (now - (lastTouch.get(instancia) ?? 0) < TOUCH_THROTTLE_MS) return;
    lastTouch.set(instancia, now);

    try {
        await pg.raw(
            `INSERT INTO evolution_instance_health (instancia, ultimo_evento, restarts_seguidos, atualizado_em)
             VALUES ($1, now(), 0, now())
             ON CONFLICT (instancia) DO UPDATE
               SET ultimo_evento = now(), restarts_seguidos = 0, atualizado_em = now()`,
            [instancia]
        );
    } catch (error: any) {
        console.warn(`[evolution-health] Falha ao registrar evento de ${instancia}: ${error?.message}`);
    }
}

export async function getInstanceHealthMap(): Promise<Map<string, InstanceHealth>> {
    try {
        const rows = await pg.raw<InstanceHealth>(
            `SELECT instancia, ultimo_evento, ultimo_estado, ultimo_restart, restarts_seguidos
               FROM evolution_instance_health`
        );
        return new Map(rows.map((r) => [r.instancia, r]));
    } catch (error: any) {
        console.warn(`[evolution-health] Tabela indisponivel: ${error?.message}`);
        return new Map();
    }
}

/**
 * Salva o estado visto pelo watchdog. Na primeira vez, usa "agora" como base
 * de ultimo_evento para nao reiniciar instancias recem-monitoradas.
 */
export async function saveInstanceState(
    instancia: string,
    estado: string,
    opts: { restarted?: boolean } = {}
): Promise<void> {
    try {
        await pg.raw(
            `INSERT INTO evolution_instance_health
               (instancia, ultimo_evento, ultimo_estado, ultimo_restart, restarts_seguidos, atualizado_em)
             VALUES ($1, now(), $2, CASE WHEN $3::boolean THEN now() END, CASE WHEN $3::boolean THEN 1 ELSE 0 END, now())
             ON CONFLICT (instancia) DO UPDATE
               SET ultimo_estado = EXCLUDED.ultimo_estado,
                   ultimo_restart = CASE WHEN $3::boolean THEN now() ELSE evolution_instance_health.ultimo_restart END,
                   restarts_seguidos = CASE WHEN $3::boolean THEN evolution_instance_health.restarts_seguidos + 1
                                            ELSE evolution_instance_health.restarts_seguidos END,
                   atualizado_em = now()`,
            [instancia, estado, Boolean(opts.restarted)]
        );
    } catch (error: any) {
        console.warn(`[evolution-health] Falha ao salvar estado de ${instancia}: ${error?.message}`);
    }
}
