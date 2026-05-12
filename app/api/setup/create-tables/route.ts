import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

const SETUP_SECRET = process.env.CRON_SECRET || 'setup-secret-key';

export async function POST(req: NextRequest) {
  try {
    // Verificar autorizacao
    const authHeader = req.headers.get('authorization');
    const { searchParams } = new URL(req.url);
    const secretParam = searchParams.get('secret');
    
    const providedSecret = authHeader?.replace('Bearer ', '') || secretParam;
    
    if (providedSecret !== SETUP_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: { table: string; status: string; error?: string }[] = [];

    // 1. Criar tabela rate_limit_attempts
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS rate_limit_attempts (
          id SERIAL PRIMARY KEY,
          identifier VARCHAR(255) NOT NULL,
          action VARCHAR(100) NOT NULL,
          attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          blocked_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      
      // Criar indices (ignora erro se ja existirem)
      try {
        await db.query(`CREATE INDEX idx_rate_limit_identifier_action ON rate_limit_attempts(identifier, action)`);
      } catch {
        // Index ja existe
      }
      
      try {
        await db.query(`CREATE INDEX idx_rate_limit_attempted_at ON rate_limit_attempts(attempted_at)`);
      } catch {
        // Index ja existe
      }
      
      results.push({ table: 'rate_limit_attempts', status: 'created' });
    } catch (error: any) {
      results.push({ table: 'rate_limit_attempts', status: 'error', error: error.message });
    }

    // 2. Verificar tabelas existentes
    const tablesResult = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const existingTables = tablesResult.rows.map((r: any) => r.table_name);

    return NextResponse.json({
      success: true,
      message: 'Setup completed',
      results,
      existingTables,
    });

  } catch (error: any) {
    console.error('[Setup] Error:', error);
    return NextResponse.json(
      { error: 'Setup failed', details: error.message },
      { status: 500 }
    );
  }
}

// GET para verificar status das tabelas
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const secretParam = searchParams.get('secret');
    
    if (secretParam !== SETUP_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Listar tabelas existentes
    const tablesResult = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const existingTables = tablesResult.rows.map((r: any) => r.table_name);

    // Verificar se rate_limit_attempts existe
    const rateLimitExists = existingTables.includes('rate_limit_attempts');

    return NextResponse.json({
      success: true,
      existingTables,
      required: {
        rate_limit_attempts: rateLimitExists ? 'exists' : 'missing',
      },
    });

  } catch (error: any) {
    console.error('[Setup] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check tables', details: error.message },
      { status: 500 }
    );
  }
}
