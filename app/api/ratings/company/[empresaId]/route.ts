import { NextResponse } from 'next/server';
import { pg } from '@/lib/postgres';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ empresaId: string }> }
) {
    try {
        const { empresaId } = await params;

        const data = await pg.findById('empresas', Number(empresaId)) as any;

        if (!data) {
            return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
        }

        return NextResponse.json({
            id: data.id,
            nome: data.nome_fantasia
        });
    } catch (error) {
        console.error('Company API Error:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
