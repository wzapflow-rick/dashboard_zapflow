import { pg } from '@/lib/postgres';

/**
 * @file lib/cron-logger.ts
 * @description Registro de execucoes dos crons na tabela `cron_logs`.
 *
 * Permite que o painel admin de Monitoramento mostre o status do ultimo
 * disparo de cada cron (quando rodou, se deu certo e o resumo do resultado).
 *
 * A escrita e "best-effort": se a tabela nao existir ou der erro, o cron
 * continua funcionando normalmente (apenas registra um warn no console).
 *
 * SQL necessario (rodar uma vez no banco):
 *
 *   CREATE TABLE IF NOT EXISTS cron_logs (
 *     id          SERIAL PRIMARY KEY,
 *     job_name    TEXT NOT NULL,
 *     status      TEXT NOT NULL,          -- 'success' | 'error'
 *     summary     JSONB,                  -- resumo do resultado
 *     duration_ms INTEGER,
 *     created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 *   CREATE INDEX IF NOT EXISTS idx_cron_logs_job_created
 *     ON cron_logs (job_name, created_at DESC);
 */

export interface CronLogEntry {
    jobName: string;
    status: 'success' | 'error';
    summary?: Record<string, unknown>;
    durationMs?: number;
}

/**
 * Registra uma execucao de cron. Nunca lanca excecao para nao quebrar o cron.
 */
export async function logCronRun(entry: CronLogEntry): Promise<void> {
    try {
        await pg.raw(
            `INSERT INTO cron_logs (job_name, status, summary, duration_ms)
             VALUES ($1, $2, $3::jsonb, $4)`,
            [
                entry.jobName,
                entry.status,
                JSON.stringify(entry.summary ?? {}),
                entry.durationMs ?? null,
            ]
        );
    } catch (error: any) {
        console.warn(`[cron-logger] Falha ao registrar execucao de "${entry.jobName}": ${error?.message}`);
    }
}

export interface CronLastRun {
    job_name: string;
    status: string;
    summary: Record<string, unknown> | null;
    duration_ms: number | null;
    created_at: string;
}

/**
 * Retorna o ultimo registro de cada cron (um por job_name).
 */
export async function getLastCronRuns(): Promise<CronLastRun[]> {
    try {
        const rows = await pg.raw<CronLastRun>(
            `SELECT DISTINCT ON (job_name)
                job_name, status, summary, duration_ms, created_at
             FROM cron_logs
             ORDER BY job_name, created_at DESC`
        );
        return rows || [];
    } catch (error: any) {
        console.warn(`[cron-logger] Falha ao ler cron_logs: ${error?.message}`);
        return [];
    }
}

/**
 * Retorna o historico recente de um cron especifico.
 */
export async function getCronHistory(jobName: string, limit = 10): Promise<CronLastRun[]> {
    try {
        const rows = await pg.raw<CronLastRun>(
            `SELECT job_name, status, summary, duration_ms, created_at
             FROM cron_logs
             WHERE job_name = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [jobName, limit]
        );
        return rows || [];
    } catch (error: any) {
        console.warn(`[cron-logger] Falha ao ler historico de "${jobName}": ${error?.message}`);
        return [];
    }
}
