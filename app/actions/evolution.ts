'use server';

import { getMe } from '@/lib/session-server';
import { pg } from '@/lib/postgres';
import * as evolution from '@/lib/evolution';

const NAO_AUTORIZADO = 'Não autorizado';

async function getEmpresaIdDaSessao(): Promise<number | null> {
    const user = await getMe();
    return user?.empresaId ? Number(user.empresaId) : null;
}

/**
 * A instância pertence à empresa da sessão quando é a instância salva em
 * `empresas.instancia_evolution` ou o nome padrão `zapflow_<empresaId>`.
 */
async function instanciaPertenceASessao(instanceName: string): Promise<boolean> {
    const empresaId = await getEmpresaIdDaSessao();
    if (!empresaId || !instanceName) return false;
    if (instanceName === `zapflow_${empresaId}`) return true;

    const rows = await pg.raw<{ instancia_evolution: string | null }>(
        'SELECT instancia_evolution FROM empresas WHERE id = $1 LIMIT 1',
        [empresaId],
    );
    return rows[0]?.instancia_evolution === instanceName;
}

export async function createEvolutionInstance(empresaId: string | number) {
    const empresaDaSessao = await getEmpresaIdDaSessao();
    if (!empresaDaSessao || empresaDaSessao !== Number(empresaId)) {
        return { error: NAO_AUTORIZADO };
    }
    return evolution.createEvolutionInstance(empresaDaSessao);
}

export async function getEvolutionQRCode(instanceName: string) {
    if (!(await instanciaPertenceASessao(instanceName))) return { error: NAO_AUTORIZADO };
    return evolution.getEvolutionQRCode(instanceName);
}

export async function getInstanceStatus(instanceName: string) {
    if (!(await instanciaPertenceASessao(instanceName))) return { error: NAO_AUTORIZADO, state: null };
    return evolution.getInstanceStatus(instanceName);
}

export async function configureInstanceWebhook(instanceName: string) {
    if (!(await instanciaPertenceASessao(instanceName))) return { error: NAO_AUTORIZADO };
    return evolution.configureInstanceWebhook(instanceName);
}
