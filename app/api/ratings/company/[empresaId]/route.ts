import { NextResponse } from 'next/server';
import { noco } from '@/lib/nocodb';
import { EMPRESAS_TABLE_ID } from '@/lib/constants';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ empresaId: string }> }
) {
    try {
        const { empresaId } = await params;

        const data = await noco.findById(EMPRESAS_TABLE_ID, Number(empresaId)) as any;

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
