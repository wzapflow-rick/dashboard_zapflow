import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (secret !== 'zapflow_test_2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Testa conexao e lista tabelas
    const result = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
      LIMIT 20
    `);

    // Verifica se DATABASE_URL esta configurada
    const dbUrlExists = !!process.env.DATABASE_URL;
    const dbUrlPreview = process.env.DATABASE_URL 
      ? process.env.DATABASE_URL.substring(0, 30) + '...' 
      : 'NAO CONFIGURADA';

    return NextResponse.json({
      success: true,
      database_url_exists: dbUrlExists,
      database_url_preview: dbUrlPreview,
      tables: result.rows.map((r: any) => r.table_name),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      database_url_exists: !!process.env.DATABASE_URL,
      database_url_preview: process.env.DATABASE_URL 
        ? process.env.DATABASE_URL.substring(0, 30) + '...' 
        : 'NAO CONFIGURADA',
    });
  }
}
