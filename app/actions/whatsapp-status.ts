'use server';

import { getMe } from '@/lib/session-server';
import { pg } from '@/lib/postgres';
import { getInstanceStatus } from '@/app/actions/evolution';

export type WhatsappConnectionState = 'connected' | 'connecting' | 'disconnected';

export interface WhatsappStatus {
  state: WhatsappConnectionState;
  instanceName: string | null;
}

export async function getMyWhatsappStatus(): Promise<WhatsappStatus> {
  const user = await getMe();
  if (!user?.empresaId) return { state: 'disconnected', instanceName: null };

  try {
    const rows = await pg.raw<{ instancia_evolution: string | null }>(
      'SELECT instancia_evolution FROM empresas WHERE id = $1 LIMIT 1',
      [user.empresaId],
    );
    const instanceName = rows[0]?.instancia_evolution || `zapflow_${user.empresaId}`;
    const result = await getInstanceStatus(instanceName);

    if (result.error || !result.state) return { state: 'disconnected', instanceName };
    if (result.state === 'open') return { state: 'connected', instanceName };
    if (result.state === 'connecting') return { state: 'connecting', instanceName };
    return { state: 'disconnected', instanceName };
  } catch (error) {
    console.error('[getMyWhatsappStatus] Erro:', error);
    return { state: 'disconnected', instanceName: null };
  }
}
