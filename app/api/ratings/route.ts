import { NextResponse } from 'next/server';
import { createRating, getAverageRatings } from '@/app/actions/ratings';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        if (!body.pedido_id || !body.empresa_id) {
            return NextResponse.json({ error: 'Dados obrigatórios faltando' }, { status: 400 });
        }

        const result = await createRating(body);
        
        if (result.success) {
            return NextResponse.json({ success: true, data: result.data });
        } else {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }
    } catch (error) {
        console.error('Rating API Error:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}