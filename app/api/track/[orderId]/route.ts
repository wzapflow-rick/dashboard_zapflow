import { NextResponse } from 'next/server';
import { pg } from '@/lib/postgres';
import { isTrackingToken } from '@/lib/order-tracking';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Rastreio publico do pedido.
 * - /track/<token>: visao completa para quem recebeu o link (sem nome do
 *   cliente nem telefone do entregador).
 * - /track/<id numerico>: links antigos. Como o ID e sequencial e qualquer um
 *   pode tentar outros numeros, devolve apenas o status, sem dados pessoais.
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ orderId: string }> }
) {
    try {
        const { orderId: identificador } = await params;

        if (isTrackingToken(identificador)) {
            const rows = await pg.raw<any>(
                'SELECT * FROM pedidos WHERE token_rastreio = $1 LIMIT 1',
                [identificador]
            );
            const order = rows[0];
            if (!order) {
                return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404, headers: NO_STORE });
            }

            let driver: any = null;
            if (order.entregador_id) {
                driver = await pg.findById('entregadores', order.entregador_id).catch(() => null);
            }

            return NextResponse.json({
                id: order.id,
                limitado: false,
                status: order.status,
                tipo_entrega: order.tipo_entrega,
                endereco_entrega: order.endereco_entrega,
                bairro_entrega: order.bairro_entrega,
                taxa_entrega: order.taxa_entrega,
                subtotal: order.subtotal,
                desconto: order.desconto,
                valor_total: order.valor_total,
                forma_pagamento: order.forma_pagamento,
                itens: order.itens,
                criado_em: order.criado_em,
                tem_entregador: !!order.entregador_id,
                entregador_nome: driver?.nome || null,
                entregador_veiculo: driver?.veiculo || null,
            }, { headers: NO_STORE });
        }

        if (!/^\d{1,12}$/.test(identificador)) {
            return NextResponse.json({ error: 'Link de rastreio inválido' }, { status: 400, headers: NO_STORE });
        }

        const order = await pg.findById('pedidos', Number(identificador)) as any;
        if (!order) {
            return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404, headers: NO_STORE });
        }

        return NextResponse.json({
            id: order.id,
            limitado: true,
            status: order.status,
            tipo_entrega: order.tipo_entrega,
            criado_em: order.criado_em,
        }, { headers: NO_STORE });
    } catch (error) {
        console.error('Erro ao rastrear pedido:', error);
        return NextResponse.json({ error: 'Erro ao processar solicitação' }, { status: 500, headers: NO_STORE });
    }
}
