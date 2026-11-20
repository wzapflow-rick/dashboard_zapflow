'use server';

import { getMe } from '@/lib/session-server';
import { pg } from '@/lib/postgres';
import { getInstanceStatus } from '@/lib/evolution';

export type WhatsappConnectionState = 'connected' | 'connecting' | 'disconnected';

export interface WhatsappStatus {
  state: WhatsappConnectionState;
  instanceName: string | null;
}

// Varias abas/aparelhos da mesma loja consultam o status a cada 60s; um cache
// curto por empresa evita repetir a chamada externa a Evolution para cada uma.
const STATUS_TTL_MS = 20_000;
const statusCache = new Map<number, { value: WhatsappStatus; expires: number }>();

export async function getMyWhatsappStatus(): Promise<WhatsappStatus> {
  const user = await getMe();
  if (!user?.empresaId) return { state: 'disconnected', instanceName: null };

  const cached = statusCache.get(user.empresaId);
  if (cached && cached.expires > Date.now()) return cached.value;

  const value = await fetchWhatsappStatus(user.empresaId);
  statusCache.set(user.empresaId, { value, expires: Date.now() + STATUS_TTL_MS });
  return value;
}

async function fetchWhatsappStatus(empresaId: number): Promise<WhatsappStatus> {
  try {
    const rows = await pg.raw<{ instancia_evolution: string | null }>(
      'SELECT instancia_evolution FROM empresas WHERE id = $1 LIMIT 1',
      [empresaId],
    );
    const instanceName = rows[0]?.instancia_evolution || `zapflow_${empresaId}`;
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
