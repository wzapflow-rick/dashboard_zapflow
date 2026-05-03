import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (secret !== 'zapflow_test_2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Verifica se DATABASE_URL esta configurada
    const dbUrlExists = !!process.env.DATABASE_URL;
    const dbUrlPreview = process.env.DATABASE_URL 
      ? process.env.DATABASE_URL.substring(0, 30) + '...' 
      : 'NAO CONFIGURADA';

    // Lista TODAS as tabelas de TODOS os schemas
    const allTables = await db.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_type = 'BASE TABLE'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `);

    // Busca especifica pela tabela assinaturas
    const assinaturasCheck = await db.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name = 'assinaturas'
    `);

    // Tenta fazer um SELECT na tabela assinaturas (pra ver se funciona)
    let assinaturasContent = null;
    let assinaturasError = null;
    try {
      const content = await db.query('SELECT COUNT(*) as total FROM assinaturas');
      assinaturasContent = content.rows[0];
    } catch (e: any) {
      assinaturasError = e.message;
    }

    return NextResponse.json({
      success: true,
      database_url_exists: dbUrlExists,
      database_url_preview: dbUrlPreview,
      assinaturas_table_found: assinaturasCheck.rows.length > 0,
      assinaturas_table_info: assinaturasCheck.rows,
      assinaturas_content: assinaturasContent,
      assinaturas_error: assinaturasError,
      all_tables: allTables.rows,
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
