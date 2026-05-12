'use server';

import db from '@/lib/db';

/**
 * Interface para assinatura
 */
export interface Assinatura {
  id: number;
  empresa_id: number;
  plano: string;
  status: string;
  valor: number;
  mp_subscription_id?: string;
  mp_preapproval_plan_id?: string;
  data_inicio?: string;
  data_proxima_cobranca?: string;
  cartao_ultimos_digitos?: string;
  cartao_bandeira?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Busca assinatura por empresa_id
 */
export async function getAssinaturaByEmpresaId(empresaId: number): Promise<Assinatura | null> {
  try {
    const result = await db.query(
      `SELECT * FROM assinaturas WHERE empresa_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [empresaId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('[Assinaturas] Erro ao buscar por empresa_id:', error);
    return null;
  }
}

/**
 * Busca assinatura por mp_subscription_id (ID do MercadoPago)
 */
export async function getAssinaturaByMpSubscriptionId(mpSubscriptionId: string): Promise<Assinatura | null> {
  try {
    const result = await db.query(
      `SELECT * FROM assinaturas WHERE mp_subscription_id = $1 LIMIT 1`,
      [mpSubscriptionId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('[Assinaturas] Erro ao buscar por mp_subscription_id:', error);
    return null;
  }
}

/**
 * Busca assinatura por ID
 */
export async function getAssinaturaById(id: number): Promise<Assinatura | null> {
  try {
    const result = await db.query(
      `SELECT * FROM assinaturas WHERE id = $1 LIMIT 1`,
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('[Assinaturas] Erro ao buscar por id:', error);
    return null;
  }
}

/**
 * Cria nova assinatura
 */
export async function createAssinatura(data: {
  empresa_id: number;
  plano: string;
  status: string;
  valor: number;
  mp_subscription_id?: string;
  mp_preapproval_plan_id?: string;
  data_inicio?: string;
  data_proxima_cobranca?: string;
  cartao_ultimos_digitos?: string;
  cartao_bandeira?: string;
}): Promise<Assinatura | null> {
  try {
    const result = await db.query(
      `INSERT INTO assinaturas (
        empresa_id, plano, status, valor,
        mp_subscription_id, mp_preapproval_plan_id,
        data_inicio, data_proxima_cobranca,
        cartao_ultimos_digitos, cartao_bandeira,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *`,
      [
        data.empresa_id,
        data.plano,
        data.status,
        data.valor,
        data.mp_subscription_id || null,
        data.mp_preapproval_plan_id || null,
        data.data_inicio || new Date().toISOString(),
        data.data_proxima_cobranca || null,
        data.cartao_ultimos_digitos || null,
        data.cartao_bandeira || null,
      ]
    );
    console.log('[Assinaturas] Criada:', result.rows[0]?.id);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[Assinaturas] Erro ao criar:', error);
    throw error;
  }
}

/**
 * Atualiza assinatura por ID
 */
export async function updateAssinaturaById(
  id: number,
  data: Partial<Omit<Assinatura, 'id' | 'created_at'>>
): Promise<Assinatura | null> {
  try {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Construir query dinamicamente
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return await getAssinaturaById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await db.query(
      `UPDATE assinaturas SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    console.log('[Assinaturas] Atualizada:', id);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[Assinaturas] Erro ao atualizar por id:', error);
    throw error;
  }
}

/**
 * Atualiza assinatura por mp_subscription_id
 */
export async function updateAssinaturaByMpSubscriptionId(
  mpSubscriptionId: string,
  data: Partial<Omit<Assinatura, 'id' | 'created_at'>>
): Promise<Assinatura | null> {
  try {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return await getAssinaturaByMpSubscriptionId(mpSubscriptionId);
    }

    fields.push(`updated_at = NOW()`);
    values.push(mpSubscriptionId);

    const result = await db.query(
      `UPDATE assinaturas SET ${fields.join(', ')} WHERE mp_subscription_id = $${paramIndex} RETURNING *`,
      values
    );

    console.log('[Assinaturas] Atualizada por mp_subscription_id:', mpSubscriptionId);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[Assinaturas] Erro ao atualizar por mp_subscription_id:', error);
    throw error;
  }
}

/**
 * Atualiza assinatura por empresa_id (atualiza a mais recente)
 */
export async function updateAssinaturaByEmpresaId(
  empresaId: number,
  data: Partial<Omit<Assinatura, 'id' | 'created_at'>>
): Promise<Assinatura | null> {
  try {
    // Primeiro buscar a assinatura mais recente
    const assinatura = await getAssinaturaByEmpresaId(empresaId);
    if (!assinatura) {
      console.log('[Assinaturas] Nenhuma assinatura encontrada para empresa:', empresaId);
      return null;
    }

    return await updateAssinaturaById(assinatura.id, data);
  } catch (error) {
    console.error('[Assinaturas] Erro ao atualizar por empresa_id:', error);
    throw error;
  }
}

/**
 * Lista todas as assinaturas ativas (para cron jobs)
 */
export async function listAssinaturasAtivas(): Promise<Assinatura[]> {
  try {
    const result = await db.query(
      `SELECT * FROM assinaturas WHERE status IN ('authorized', 'active', 'pending') ORDER BY created_at DESC`
    );
    return result.rows;
  } catch (error) {
    console.error('[Assinaturas] Erro ao listar ativas:', error);
    return [];
  }
}

/**
 * Lista assinaturas que precisam de cobranca (data_proxima_cobranca <= hoje)
 */
export async function listAssinaturasParaCobranca(): Promise<Assinatura[]> {
  try {
    const result = await db.query(
      `SELECT * FROM assinaturas 
       WHERE status IN ('authorized', 'active') 
       AND data_proxima_cobranca <= NOW() 
       ORDER BY data_proxima_cobranca ASC`
    );
    return result.rows;
  } catch (error) {
    console.error('[Assinaturas] Erro ao listar para cobranca:', error);
    return [];
  }
}

/**
 * Cancela assinatura por empresa_id
 */
export async function cancelarAssinatura(empresaId: number): Promise<boolean> {
  try {
    const result = await db.query(
      `UPDATE assinaturas SET status = 'cancelled', updated_at = NOW() 
       WHERE empresa_id = $1 AND status IN ('authorized', 'active', 'pending')
       RETURNING id`,
      [empresaId]
    );
    console.log('[Assinaturas] Cancelada para empresa:', empresaId);
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('[Assinaturas] Erro ao cancelar:', error);
    return false;
  }
}
