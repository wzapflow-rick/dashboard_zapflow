import { NextResponse } from 'next/server';
import { getMe } from '@/app/actions/auth';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const EMPRESAS_TABLE_ID = 'mp08yd7oaxn5xo2';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ empresaId: string }> }
) {
    try {
        const { empresaId } = await params;
        
        const res = await fetch(
            `${NOCODB_URL}/api/v2/tables/${EMPRESAS_TABLE_ID}/records/${empresaId}`,
            {
                headers: { 'xc-token': NOCODB_TOKEN },
                cache: 'no-store',
            }
        );

        if (!res.ok) {
            return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
        }

        const data = await res.json();
        return NextResponse.json({
            id: data.id,
            nome: data.nome_fantasia
        });
    } catch (error) {
        console.error('Company API Error:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}