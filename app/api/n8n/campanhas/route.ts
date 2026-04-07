import { NextRequest, NextResponse } from 'next/server';
import { getCampanhasParaN8N, registrarDisparo } from '@/app/actions/campanhas';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const empresaId = searchParams.get('empresa_id');
        const apiKey = searchParams.get('api_key');

        if (!empresaId || !apiKey) {
            return NextResponse.json(
                { error: 'Parâmetros empresa_id e api_key são obrigatórios' },
                { status: 400 }
            );
        }

        const campanhas = await getCampanhasParaN8N(empresaId, apiKey);
        return NextResponse.json(campanhas);
    } catch (error: any) {
        console.error('N8N GET error:', error);
        return NextResponse.json(
            { error: error.message || 'Erro interno' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { api_key, empresa_id, campanha_id, cliente_id, telefone, variante_usada, mensagem_enviada, status, erro_detalhe } = body;

        if (!api_key || !empresa_id || !campanha_id || !telefone || !status) {
            return NextResponse.json(
                { error: 'Parâmetros obrigatórios faltando' },
                { status: 400 }
            );
        }

        if (api_key !== process.env.N8N_WEBHOOK_SECRET) {
            return NextResponse.json(
                { error: 'API key inválida' },
                { status: 401 }
            );
        }

        const result = await registrarDisparo({
            empresaId: empresa_id,
            campanhaId: campanha_id,
            clienteId: cliente_id || 0,
            telefone,
            varianteUsada: variante_usada || 1,
            mensagemEnviada: mensagem_enviada || '',
            status,
            erroDetalhe: erro_detalhe || undefined
        });

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('N8N POST error:', error);
        return NextResponse.json(
            { error: error.message || 'Erro interno' },
            { status: 500 }
        );
    }
}