import { NextResponse } from 'next/server';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const DRIVERS_TABLE_ID = 'm4hbqkhwu2qvrry';
const ORDERS_TABLE_ID = 'mui7bozvx9zb2n9';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const empresaId = searchParams.get('empresaId');
        const periodo = searchParams.get('periodo') || 'hoje'; // hoje, semana, mes

        if (!empresaId) {
            return NextResponse.json({ error: 'Empresa não informada' }, { status: 400 });
        }

        // Fetch entregadores - filtrar por empresa
        const driversRes = await fetch(
            `${NOCODB_URL}/api/v2/tables/${DRIVERS_TABLE_ID}/records?limit=100&where=(empresa_id,eq,${empresaId})`,
            {
                headers: { 'xc-token': NOCODB_TOKEN }
            }
        );

        if (!driversRes.ok) {
            return NextResponse.json({ error: 'Erro ao buscar entregadores' }, { status: driversRes.status });
        }

        const driversData = await driversRes.json();
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

        // Calcular data de início do período
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

        // Buscar todos os pedidos do período
        const ordersRes = await fetch(
            `${NOCODB_URL}/api/v2/tables/${ORDERS_TABLE_ID}/records?limit=1000&where=(empresa_id,eq,${empresaId})~and(status,eq,finalizado)`,
            {
                headers: { 'xc-token': NOCODB_TOKEN }
            }
        );

        let allOrders: any[] = [];
        if (ordersRes.ok) {
            const ordersData = await ordersRes.json();
            allOrders = ordersData.list || [];
        }

        // Para cada entregador, calcular entregas e valor
        const acertos = drivers.map((driver: any) => {
            // Filtrar entregas do entregador (pela data de criação)
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

        // Calcular totais (apenas não pagos)
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

        // Atualizar entregador com status de pagamento E resetar entregas
        const res = await fetch(
            `${NOCODB_URL}/api/v2/tables/${DRIVERS_TABLE_ID}/records`,
            {
                method: 'PATCH',
                headers: {
                    'xc-token': NOCODB_TOKEN,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    Id: entregador_id,
                    id: entregador_id,
                    ultimo_acerto_valor: valor_pago || 0,
                    ultimo_acerto_data: pago ? new Date().toISOString() : null,
                    entregas_hoje: 0
                })
            }
        );

        if (!res.ok) {
            const errorText = await res.text();
            console.error('NocoDB PATCH error:', res.status, errorText);
            return NextResponse.json({ error: 'Erro ao atualizar: ' + errorText }, { status: res.status });
        }

        const data = await res.json();
        console.log('PATCH response:', data);
        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}