import { NextResponse } from 'next/server';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const ORDERS_TABLE_ID = 'mui7bozvx9zb2n9';
const DRIVERS_TABLE_ID = 'm4hbqkhwu2qvrry';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    // SECURITY: Validate orderId format
    if (!orderId || typeof orderId !== 'string' || !/^\d+$/.test(orderId)) {
      return NextResponse.json(
        { error: 'ID do pedido inválido' },
        { status: 400 }
      );
    }

    // SECURITY: Sanitize orderId to prevent injection
    const sanitizedOrderId = orderId.replace(/[^0-9]/g, '');

    // Buscar pedido
    const orderRes = await fetch(
      `${NOCODB_URL}/api/v2/tables/${ORDERS_TABLE_ID}/records/${sanitizedOrderId}`,
      {
        headers: {
          'xc-token': NOCODB_TOKEN,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!orderRes.ok) {
      return NextResponse.json(
        { error: 'Pedido não encontrado' },
        { status: 404 }
      );
    }

    const order = await orderRes.json();

    // Buscar entregador se atribuído
    let driverInfo = null;
    if (order.entregador_id) {
      try {
        const driverRes = await fetch(
          `${NOCODB_URL}/api/v2/tables/${DRIVERS_TABLE_ID}/records/${order.entregador_id}`,
          {
            headers: {
              'xc-token': NOCODB_TOKEN,
              'Content-Type': 'application/json',
            },
            cache: 'no-store',
          }
        );

        if (driverRes.ok) {
          const driver = await driverRes.json();
          driverInfo = {
            nome: driver.nome,
            telefone: driver.telefone,
            veiculo: driver.veiculo,
          };
        }
      } catch (e) {
        console.error('Erro ao buscar entregador:', e);
      }
    }

    // Retornar dados públicos (sem informações sensíveis)
    const publicData = {
      id: order.id,
      status: order.status,
      cliente_nome: order.cliente_nome,
      endereco_entrega: order.endereco_entrega,
      bairro_entrega: order.bairro_entrega,
      tipo_entrega: order.tipo_entrega,
      taxa_entrega: order.taxa_entrega,
      subtotal: order.subtotal,
      desconto: order.desconto,
      valor_total: order.valor_total,
      forma_pagamento: order.forma_pagamento,
      itens: order.itens,
      criado_em: order.criado_em,
      observacoes: order.observacoes,
      // Informações do entregador
      entregador_id: order.entregador_id,
      entregador_nome: driverInfo?.nome || null,
      entregador_veiculo: driverInfo?.veiculo || null,
      entregador_telefone: driverInfo?.telefone || null,
    };

    return NextResponse.json(publicData);
  } catch (error) {
    // SECURITY: Generic error message to avoid information leakage
    console.error('Erro ao rastrear pedido:', error);
    return NextResponse.json(
      { error: 'Erro ao processar solicitação' },
      { status: 500 }
    );
  }
}
