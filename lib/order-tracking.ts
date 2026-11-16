import { pg } from '@/lib/postgres';

const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isTrackingToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

/**
 * Caminho publico de rastreio do pedido. Usa o token aleatorio quando existe;
 * cai para o ID (visao reduzida, sem dados pessoais) enquanto a migracao
 * scripts/006_pedidos_token_rastreio.sql nao tiver sido aplicada.
 */
export async function getTrackingPath(orderId: number): Promise<string> {
  try {
    const rows = await pg.raw<{ token_rastreio: string | null }>(
      'SELECT token_rastreio FROM pedidos WHERE id = $1 LIMIT 1',
      [orderId]
    );
    const token = rows[0]?.token_rastreio;
    if (token) return `/track/${token}`;
  } catch {
    // coluna ainda nao existe
  }
  return `/track/${orderId}`;
}
