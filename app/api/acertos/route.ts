import { NextResponse } from 'next/server';
import { noco } from '@/lib/nocodb';
import { ENTREGADORES_TABLE_ID, PEDIDOS_TABLE_ID } from '@/lib/constants';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const empresaId = searchParams.get('empresaId');
        const periodo = searchParams.get('periodo') || 'hoje';

        if (!empresaId) {
            return NextResponse.json({ error: 'Empresa não informada' }, { status: 400 });
        }

        const [driversData, ordersData] = await Promise.all([
            noco.list(ENTREGADORES_TABLE_ID, {
                where: `(empresa_id,eq,${empresaId})`,
                limit: 100,
            }),
            noco.list(PEDIDOS_TABLE_ID, {
                where: `(empresa_id,eq,${empresaId})~and(status,eq,finalizado)`,
                limit: 1000,
            }),
        ]);

        const drivers = (driversData.list || []).map((d: any) => ({
            id: d.id,
            nome: d.nome || '',
            telefone: d.telefone || '',
            veiculo: d.veiculo || '',
            valor_por_entrega: Number(d.valor_por_entrega || 5),
            entregas_hoje: Number(d.entregas_hoje || 0),
            ultimo_acerto_data: d.ultimo_acerto_data,
            ultimo_acerto_valor: Number(d.ultimo_acerto_valor || 0)
        }));

        const hoje = new Date();
        let dataInicio: Date;

        if (periodo === 'hoje') {
            dataInicio = new Date(hoje.setHours(0, 0, 0, 0));
        } else if (periodo === 'semana') {
            dataInicio = new Date();
            dataInicio.setDate(dataInicio.getDate() - 7);
        } else {
            dataInicio = new Date();
            dataInicio.setDate(dataInicio.getDate() - 30);
        }

        const allOrders = ordersData.list || [];

        const acertos = drivers.map((driver: any) => {
            const entregasDriver = allOrders.filter((o: any) => {
                const orderDate = new Date(o.created_at);
                const isDriverOrder = Number(o.entregador_id) === driver.id;
                const isInPeriod = orderDate >= dataInicio;
                return isDriverOrder && isInPeriod;
            });
            const quantidadeEntregas = entregasDriver.length || driver.entregas_hoje;
            const valorTotal = quantidadeEntregas * driver.valor_por_entrega;
            return {
                entregador_id: driver.id,
                entregador_nome: driver.nome,
                telefone: driver.telefone,
                veiculo: driver.veiculo,
                quantidade_entregas: quantidadeEntregas,
                valor_por_entrega: driver.valor_por_entrega,
                valor_total: valorTotal,
                periodo: periodo,
                pago: driver.ultimo_acerto_data ? true : false,
                pago_em: driver.ultimo_acerto_data,
                pago_valor: driver.ultimo_acerto_valor
            };
        });

        const totais = acertos.reduce((acc: any, a: any) => ({
            entregas: acc.entregas + a.quantidade_entregas,
            valor: acc.valor + (a.pago ? 0 : a.valor_total)
        }), { entregas: 0, valor: 0 });

        return NextResponse.json({ drivers: acertos, totais });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { entregador_id, valor_pago, pago } = body;

        if (!entregador_id) {
            return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
        }

        const data = await noco.update(ENTREGADORES_TABLE_ID, {
            id: entregador_id,
            ultimo_acerto_valor: valor_pago || 0,
            ultimo_acerto_data: pago ? new Date().toISOString() : null,
            entregas_hoje: 0
        });

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
