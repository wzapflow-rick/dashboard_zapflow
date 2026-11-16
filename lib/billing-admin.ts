/**
 * Operações de cobrança de uso interno (crons e webhook do Mercado Pago).
 * Ficam fora de `app/actions` de propósito: um arquivo 'use server' expõe cada
 * função exportada como endpoint chamável pelo navegador, e bloquear/desbloquear
 * empresa não pode ser acionado por um cliente.
 */

import { pg } from '@/lib/postgres';

export async function updatePaymentStatus(
  empresaId: number,
  data: {
    tipo_pagamento?: 'cartao' | 'pix';
    data_vencimento?: string;
    dias_inadimplente?: number;
    ultimo_aviso_enviado?: number;
    bloqueado?: boolean;
    planos?: string;
  }
) {
  try {
    await pg.update('empresas', { id: empresaId, ...data });
    return { success: true };
  } catch (error: any) {
    console.error('[Billing] Erro ao atualizar status:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Busca empresas com pagamento PIX vencido
 */
export async function getOverdueCompanies() {
  try {
    const today = new Date().toISOString().split('T')[0];

    const result = await pg.query(
      `SELECT * FROM empresas WHERE tipo_pagamento = 'pix' AND data_vencimento < $1 AND bloqueado = false LIMIT 100`,
      [today]
    );

    return result?.rows || [];
  } catch (error) {
    console.error('[Billing] Erro ao buscar empresas inadimplentes:', error);
    return [];
  }
}

/**
 * Calcula proxima data de vencimento (dia 5 do proximo mes)
 */
export async function calculateNextDueDate(): Promise<string> {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;

  if (month > 11) {
    month = 0;
    year += 1;
  }

  const dueDate = new Date(year, month, 5);
  return dueDate.toISOString().split('T')[0];
}

/**
 * Bloqueia empresa por inadimplencia
 */
export async function blockCompany(empresaId: number) {
  try {
    await pg.update('empresas', {
      id: empresaId,
      bloqueado: true,
      planos: 'iniciante',
    });
    return { success: true };
  } catch (error: any) {
    console.error('[Billing] Erro ao bloquear empresa:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Desbloqueia empresa apos pagamento
 */
export async function unblockCompany(empresaId: number, plano: string) {
  try {
    const nextDueDate = await calculateNextDueDate();

    await pg.update('empresas', {
      id: empresaId,
      bloqueado: false,
      dias_inadimplente: 0,
      ultimo_aviso_enviado: 0,
      data_vencimento: nextDueDate,
      planos: plano,
    });
    return { success: true };
  } catch (error: any) {
    console.error('[Billing] Erro ao desbloquear empresa:', error);
    return { success: false, error: error.message };
  }
}
