'use server';

import { pg } from '@/lib/postgres';
import { EMPRESAS_TABLE, PEDIDOS_TABLE, CLIENTES_TABLE } from '@/lib/tables';
import { requireAdmin } from '@/lib/auth-utils';
import { 
  getIFoodAccessToken, 
  pollIFoodOrders, 
  acknowledgeIFoodEvents,
  getIFoodOrderDetails,
  confirmIFoodOrder,
  startPreparationIFood,
  readyToPickupIFood,
  dispatchIFoodOrder,
  convertIFoodOrderToZapFlow
} from '@/lib/ifood';

/**
 * Salvar credenciais iFood da empresa
 */
export async function saveIFoodCredentials(data: {
  clientId: string;
  clientSecret: string;
  merchantId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAdmin();

    // Validar credenciais testando autenticacao
    const tokenResult = await getIFoodAccessToken({
      clientId: data.clientId,
      clientSecret: data.clientSecret,
    });

    if (!tokenResult) {
      return { success: false, error: 'Credenciais invalidas. Verifique o Client ID e Secret.' };
    }

    // Salvar credenciais e token
    const expiresAt = new Date(Date.now() + tokenResult.expiresIn * 1000);

    await pg.query(
      `UPDATE ${EMPRESAS_TABLE} SET 
        ifood_client_id = $1,
        ifood_client_secret = $2,
        ifood_merchant_id = $3,
        ifood_access_token = $4,
        ifood_refresh_token = $5,
        ifood_token_expires_at = $6,
        ifood_ativo = true
       WHERE id = $7`,
      [
        data.clientId,
        data.clientSecret,
        data.merchantId,
        tokenResult.accessToken,
        tokenResult.refreshToken || null,
        expiresAt,
        user.empresaId
      ]
    );

    return { success: true };
  } catch (error) {
    console.error('[iFood] Erro ao salvar credenciais:', error);
    return { success: false, error: 'Erro ao salvar credenciais' };
  }
}

/**
 * Obter status da integracao iFood
 */
export async function getIFoodStatus(): Promise<{
  ativo: boolean;
  merchantId?: string;
  tokenValido: boolean;
}> {
  try {
    const user = await requireAdmin();

    const result: any = await pg.query(
      `SELECT ifood_ativo, ifood_merchant_id, ifood_token_expires_at 
       FROM ${EMPRESAS_TABLE} WHERE id = $1`,
      [user.empresaId]
    );

    const empresa = result.rows?.[0] || result?.[0];

    if (!empresa || !empresa.ifood_ativo) {
      return { ativo: false, tokenValido: false };
    }

    const tokenValido = empresa.ifood_token_expires_at 
      ? new Date(empresa.ifood_token_expires_at) > new Date()
      : false;

    return {
      ativo: true,
      merchantId: empresa.ifood_merchant_id,
      tokenValido,
    };
  } catch (error) {
    console.error('[iFood] Erro ao obter status:', error);
    return { ativo: false, tokenValido: false };
  }
}

/**
 * Desativar integracao iFood
 */
export async function disableIFoodIntegration(): Promise<{ success: boolean }> {
  try {
    const user = await requireAdmin();

    await pg.query(
      `UPDATE ${EMPRESAS_TABLE} SET 
        ifood_ativo = false,
        ifood_access_token = NULL,
        ifood_refresh_token = NULL
       WHERE id = $1`,
      [user.empresaId]
    );

    return { success: true };
  } catch (error) {
    console.error('[iFood] Erro ao desativar:', error);
    return { success: false };
  }
}

/**
 * Renovar token iFood se necessario
 */
async function ensureValidToken(empresaId: number | string): Promise<string | null> {
  const result: any = await pg.query(
    `SELECT ifood_client_id, ifood_client_secret, ifood_access_token, 
            ifood_refresh_token, ifood_token_expires_at
     FROM ${EMPRESAS_TABLE} WHERE id = $1 AND ifood_ativo = true`,
    [empresaId]
  );

  const empresa = result.rows?.[0] || result?.[0];
  if (!empresa) return null;

  const expiresAt = new Date(empresa.ifood_token_expires_at);
  const now = new Date();

  // Se token ainda valido (com margem de 5 minutos), retorna ele
  if (expiresAt > new Date(now.getTime() + 5 * 60 * 1000)) {
    return empresa.ifood_access_token;
  }

  // Token expirado ou proximo de expirar, renovar
  const tokenResult = await getIFoodAccessToken({
    clientId: empresa.ifood_client_id,
    clientSecret: empresa.ifood_client_secret,
    grantType: empresa.ifood_refresh_token ? 'authorization_code' : 'client_credentials',
    refreshToken: empresa.ifood_refresh_token,
  });

  if (!tokenResult) {
    console.error('[iFood] Falha ao renovar token');
    return null;
  }

  // Atualizar token no banco
  const newExpiresAt = new Date(Date.now() + tokenResult.expiresIn * 1000);
  
  await pg.query(
    `UPDATE ${EMPRESAS_TABLE} SET 
      ifood_access_token = $1,
      ifood_refresh_token = COALESCE($2, ifood_refresh_token),
      ifood_token_expires_at = $3
     WHERE id = $4`,
    [tokenResult.accessToken, tokenResult.refreshToken, newExpiresAt, empresaId]
  );

  return tokenResult.accessToken;
}

/**
 * Sincronizar pedidos do iFood (polling)
 * Deve ser chamado periodicamente (ex: a cada 30 segundos)
 */
export async function syncIFoodOrders(): Promise<{
  success: boolean;
  newOrders: number;
  error?: string;
}> {
  try {
    const user = await requireAdmin();

    const accessToken = await ensureValidToken(user.empresaId);
    if (!accessToken) {
      return { success: false, newOrders: 0, error: 'Token invalido' };
    }

    // Buscar eventos de pedidos
    const events = await pollIFoodOrders(accessToken);
    
    if (events.length === 0) {
      return { success: true, newOrders: 0 };
    }

    let newOrders = 0;
    const eventIds: string[] = [];

    for (const event of events) {
      eventIds.push(event.id);

      // Processar apenas novos pedidos (PLC = Placed)
      if (event.code === 'PLC') {
        const orderDetails = await getIFoodOrderDetails(accessToken, event.orderId);
        
        if (orderDetails) {
          // Converter para formato ZapFlow
          const zapflowOrder = convertIFoodOrderToZapFlow(orderDetails, user.empresaId);

          // Verificar se pedido ja existe
          const existingResult: any = await pg.query(
            `SELECT id FROM ${PEDIDOS_TABLE} 
             WHERE empresa_id = $1 AND pedido_externo_id = $2 AND origem = 'ifood'`,
            [user.empresaId, orderDetails.id]
          );

          const existing = existingResult.rows?.[0] || existingResult?.[0];
          
          if (!existing) {
            // Buscar ou criar cliente
            let clienteId = null;
            if (zapflowOrder.cliente_telefone) {
              const clienteResult: any = await pg.query(
                `SELECT id FROM ${CLIENTES_TABLE} 
                 WHERE empresa_id = $1 AND telefone = $2`,
                [user.empresaId, zapflowOrder.cliente_telefone]
              );
              
              const clienteExistente = clienteResult.rows?.[0] || clienteResult?.[0];
              
              if (clienteExistente) {
                clienteId = clienteExistente.id;
              } else {
                const novoCliente: any = await pg.create(CLIENTES_TABLE, {
                  empresa_id: user.empresaId,
                  nome: zapflowOrder.cliente_nome,
                  telefone: zapflowOrder.cliente_telefone,
                });
                clienteId = novoCliente.id;
              }
            }

            // Criar pedido
            await pg.create(PEDIDOS_TABLE, {
              empresa_id: user.empresaId,
              cliente_id: clienteId,
              origem: 'ifood',
              pedido_externo_id: orderDetails.id,
              itens: JSON.stringify(zapflowOrder.itens),
              valor_total: zapflowOrder.valor_total,
              taxa_entrega: zapflowOrder.taxa_entrega,
              tipo_pedido: zapflowOrder.tipo_pedido,
              endereco_entrega: zapflowOrder.endereco ? JSON.stringify(zapflowOrder.endereco) : null,
              forma_pagamento: zapflowOrder.pagamento,
              status: 'pendente',
            });

            newOrders++;
          }
        }
      }
    }

    // Confirmar recebimento dos eventos
    if (eventIds.length > 0) {
      await acknowledgeIFoodEvents(accessToken, eventIds);
    }

    return { success: true, newOrders };
  } catch (error) {
    console.error('[iFood] Erro ao sincronizar pedidos:', error);
    return { success: false, newOrders: 0, error: 'Erro ao sincronizar' };
  }
}

/**
 * Atualizar status do pedido no iFood
 */
export async function updateIFoodOrderStatus(
  pedidoExternoId: string,
  novoStatus: 'confirmar' | 'preparando' | 'pronto' | 'despachado'
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAdmin();

    const accessToken = await ensureValidToken(user.empresaId);
    if (!accessToken) {
      return { success: false, error: 'Token invalido' };
    }

    let result = false;

    switch (novoStatus) {
      case 'confirmar':
        result = await confirmIFoodOrder(accessToken, pedidoExternoId);
        break;
      case 'preparando':
        result = await startPreparationIFood(accessToken, pedidoExternoId);
        break;
      case 'pronto':
        result = await readyToPickupIFood(accessToken, pedidoExternoId);
        break;
      case 'despachado':
        result = await dispatchIFoodOrder(accessToken, pedidoExternoId);
        break;
    }

    if (!result) {
      return { success: false, error: 'Falha ao atualizar status no iFood' };
    }

    return { success: true };
  } catch (error) {
    console.error('[iFood] Erro ao atualizar status:', error);
    return { success: false, error: 'Erro ao atualizar status' };
  }
}
