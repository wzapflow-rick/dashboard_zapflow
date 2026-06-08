'use server';

import { getAdminSession } from '@/app/actions/admin-auth';
import { getLastCronRuns, getCronHistory, type CronLastRun } from '@/lib/cron-logger';

/** Crons de cobranca monitorados no painel.
 *  IMPORTANTE: este arquivo e 'use server', entao so pode EXPORTAR funcoes
 *  assincronas. Por isso esta const NAO e exportada. */
const MONITORED_CRONS = [
    {
        jobName: 'billing-reminder',
        label: 'Lembrete de Renovação (Cartão)',
        description: 'Avisa por WhatsApp 3 e 1 dia antes da cobrança de assinaturas no cartão.',
        path: '/api/cron/billing-reminder',
    },
    {
        jobName: 'check-payments',
        label: 'Cobrança e Bloqueio (PIX)',
        description: 'Cobra clientes PIX em atraso e bloqueia após 5 dias de inadimplência.',
        path: '/api/cron/check-payments',
    },
] as const;

export interface CronStatus {
    jobName: string;
    label: string;
    description: string;
    path: string;
    lastRun: CronLastRun | null;
}

/**
 * Retorna o status do ultimo disparo de cada cron de cobranca.
 */
export async function getCronStatuses(): Promise<CronStatus[]> {
    const session = await getAdminSession();
    if (!session) {
        throw new Error('Nao autorizado');
    }

    const lastRuns = await getLastCronRuns();
    const byName = new Map(lastRuns.map((r) => [r.job_name, r]));

    return MONITORED_CRONS.map((c) => ({
        jobName: c.jobName,
        label: c.label,
        description: c.description,
        path: c.path,
        lastRun: byName.get(c.jobName) ?? null,
    }));
}

/**
 * Retorna o historico recente (ate 10 execucoes) de um cron.
 */
export async function getCronRunHistory(jobName: string): Promise<CronLastRun[]> {
    const session = await getAdminSession();
    if (!session) {
        throw new Error('Nao autorizado');
    }
    return getCronHistory(jobName, 10);
}

/**
 * Dispara um cron manualmente a partir do painel admin.
 * Usa o CRON_SECRET no servidor para autenticar a chamada interna.
 */
export async function triggerCron(
    jobName: string
): Promise<{ success: boolean; result?: any; error?: string }> {
    const session = await getAdminSession();
    if (!session) {
        return { success: false, error: 'Nao autorizado' };
    }

    const cron = MONITORED_CRONS.find((c) => c.jobName === jobName);
    if (!cron) {
        return { success: false, error: 'Cron desconhecido' };
    }

    const secret = process.env.CRON_SECRET;
    if (!secret) {
        return { success: false, error: 'CRON_SECRET nao configurado no servidor' };
    }

    // Monta a URL absoluta da propria aplicacao.
    const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        'https://cardapio.wzapflow.com.br';

    try {
        const res = await fetch(`${baseUrl}${cron.path}`, {
            method: 'POST',
            headers: { 'x-cron-key': secret },
            cache: 'no-store',
        });

        const result = await res.json().catch(() => ({}));

        if (!res.ok) {
            return { success: false, error: result?.error || `HTTP ${res.status}`, result };
        }

        return { success: true, result };
    } catch (error: any) {
        return { success: false, error: error?.message || 'Falha ao disparar o cron' };
    }
}
