import { NextResponse } from 'next/server';
import { pg } from '@/lib/postgres';
import { EMPRESAS_TABLE, PEDIDOS_TABLE, CLIENTES_TABLE } from '@/lib/tables';
import { 
  getIFoodAccessToken,
  pollIFoodOrders, 
  acknowledgeIFoodEvents,
  getIFoodOrderDetails,
  convertIFoodOrderToZapFlow
} from '@/lib/ifood';

/**
 * Endpoint para sincronizar pedidos do iFood de todas as empresas ativas
 * Deve ser chamado por um cron job a cada 30-60 segundos
 * 
 * GET /api/cron/ifood-sync?secret=CRON_SECRET
 */
export async function GET(request: Request) {
  try {
    // Verificar secret do cron
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar todas as empresas com iFood ativo
    const empresasResult: any = await pg.query(
      `SELECT id, ifood_client_id, ifood_client_secret, ifood_access_token, 
              ifood_refresh_token, ifood_token_expires_at, ifood_merchant_id
       FROM ${EMPRESAS_TABLE} 
       WHERE ifood_ativo = true AND ifood_client_id IS NOT NULL`
    );

    const empresas = empresasResult.rows || empresasResult || [];

    if (empresas.length === 0) {
      return NextResponse.json({ message: 'Nenhuma empresa com iFood ativo', processed: 0 });
    }

    let totalNewOrders = 0;
    const results: any[] = [];

    for (const empresa of empresas) {
      try {
        // Verificar se token precisa ser renovado
        let accessToken = empresa.ifood_access_token;
        const expiresAt = new Date(empresa.ifood_token_expires_at);
        const now = new Date();

        if (expiresAt <= new Date(now.getTime() + 5 * 60 * 1000)) {
          // Renovar token
          const tokenResult = await getIFoodAccessToken({
            clientId: empresa.ifood_client_id,
            clientSecret: empresa.ifood_client_secret,
          });

          if (tokenResult) {
            accessToken = tokenResult.accessToken;
            const newExpiresAt = new Date(Date.now() + tokenResult.expiresIn * 1000);
            
            await pg.query(
              `UPDATE ${EMPRESAS_TABLE} SET 
                ifood_access_token = $1,
                ifood_token_expires_at = $2
               WHERE id = $3`,
              [accessToken, newExpiresAt, empresa.id]
            );
          } else {
            results.push({ empresaId: empresa.id, error: 'Falha ao renovar token' });
            continue;
          }
        }

        // Buscar eventos
        const events = await pollIFoodOrders(accessToken);
        
        if (events.length === 0) {
          results.push({ empresaId: empresa.id, newOrders: 0 });
          continue;
        }

        let newOrders = 0;
        const eventIds: string[] = [];

        for (const event of events) {
          eventIds.push(event.id);

          if (event.code === 'PLC') {
            const orderDetails = await getIFoodOrderDetails(accessToken, event.orderId);
            
            if (orderDetails) {
              const zapflowOrder = convertIFoodOrderToZapFlow(orderDetails, empresa.id);

              // Verificar duplicata
              const existingResult: any = await pg.query(
                `SELECT id FROM ${PEDIDOS_TABLE} 
                 WHERE empresa_id = $1 AND pedido_externo_id = $2 AND origem = 'ifood'`,
                [empresa.id, orderDetails.id]
              );

              if (!(existingResult.rows?.[0] || existingResult?.[0])) {
                // Criar cliente se necessario
                let clienteId = null;
                if (zapflowOrder.cliente_telefone) {
                  const clienteResult: any = await pg.query(
                    `SELECT id FROM ${CLIENTES_TABLE} WHERE empresa_id = $1 AND telefone = $2`,
                    [empresa.id, zapflowOrder.cliente_telefone]
                  );
                  
                  const clienteExistente = clienteResult.rows?.[0] || clienteResult?.[0];
                  
                  if (clienteExistente) {
                    clienteId = clienteExistente.id;
                  } else {
                    const novoCliente: any = await pg.create(CLIENTES_TABLE, {
                      empresa_id: empresa.id,
                      nome: zapflowOrder.cliente_nome,
                      telefone: zapflowOrder.cliente_telefone,
                    });
                    clienteId = novoCliente.id;
                  }
                }

                // Criar pedido
                await pg.create(PEDIDOS_TABLE, {
                  empresa_id: empresa.id,
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

        // Confirmar eventos
        if (eventIds.length > 0) {
          await acknowledgeIFoodEvents(accessToken, eventIds);
        }

        totalNewOrders += newOrders;
        results.push({ empresaId: empresa.id, newOrders, eventsProcessed: eventIds.length });

      } catch (error) {
        console.error(`[iFood Cron] Erro na empresa ${empresa.id}:`, error);
        results.push({ empresaId: empresa.id, error: 'Erro no processamento' });
      }
    }

    return NextResponse.json({
      success: true,
      totalNewOrders,
      empresasProcessadas: empresas.length,
      results,
    });

  } catch (error) {
    console.error('[iFood Cron] Erro geral:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
