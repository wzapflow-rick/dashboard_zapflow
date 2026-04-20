import { NextResponse } from 'next/server';
import { noco } from '@/lib/nocodb';
import { PEDIDOS_TABLE_ID, ENTREGADORES_TABLE_ID } from '@/lib/constants';

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

        const sanitizedOrderId = Number(orderId.replace(/[^0-9]/g, ''));

        const order = await noco.findById(PEDIDOS_TABLE_ID, sanitizedOrderId) as any;

        if (!order) {
            return NextResponse.json(
                { error: 'Pedido não encontrado' },
                { status: 404 }
            );
        }

        let driverInfo = null;
        if (order.entregador_id) {
            try {
                const driver = await noco.findById(ENTREGADORES_TABLE_ID, order.entregador_id) as any;
                if (driver) {
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
