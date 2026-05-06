import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * API para ativar plano manualmente para uma empresa
 * 
 * POST /api/admin/ativar-plano
 * Body: { email: string, plano: string, dias?: number }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, plano, dias = 30 } = body;

    if (!email || !plano) {
      return NextResponse.json({ error: 'Email e plano sao obrigatorios' }, { status: 400 });
    }

    console.log(`[Admin] Ativando plano ${plano} para ${email}...`);

    // Buscar empresa pelo email
    let empresaId: number | null = null;
    let empresaNome: string | null = null;

    // Primeiro tentar na tabela empresas
    const empresaResult = await db.query(
      'SELECT id, nome, nome_fantasia, email FROM empresas WHERE email = $1',
      [email]
    );

    if (empresaResult.rows.length > 0) {
      empresaId = empresaResult.rows[0].id;
      empresaNome = empresaResult.rows[0].nome_fantasia || empresaResult.rows[0].nome;
    } else {
      // Tentar na tabela usuarios
      const usuarioResult = await db.query(
        'SELECT u.empresa_id, e.nome, e.nome_fantasia FROM usuarios u JOIN empresas e ON u.empresa_id = e.id WHERE u.email = $1',
        [email]
      );

      if (usuarioResult.rows.length > 0) {
        empresaId = usuarioResult.rows[0].empresa_id;
        empresaNome = usuarioResult.rows[0].nome_fantasia || usuarioResult.rows[0].nome;
      }
    }

    if (!empresaId) {
      // Listar empresas recentes para ajudar a identificar
      const recentesResult = await db.query(
        'SELECT id, nome, nome_fantasia, email, slug FROM empresas ORDER BY created_at DESC LIMIT 10'
      );
      
      return NextResponse.json({ 
        error: 'Empresa nao encontrada com este email',
        empresas_recentes: recentesResult.rows 
      }, { status: 404 });
    }

    // Calcular data de vencimento
    const hoje = new Date();
    const dataProxima = new Date(hoje);
    dataProxima.setDate(dataProxima.getDate() + dias);

    // Verificar se existe assinatura
    const existingResult = await db.query(
      'SELECT id, plano, status FROM assinaturas WHERE empresa_id = $1',
      [empresaId]
    );

    if (existingResult.rows.length > 0) {
      // Atualizar assinatura existente
      await db.query(`
        UPDATE assinaturas 
        SET plano = $1, 
            status = 'authorized', 
            data_proxima_cobranca = $2, 
            valor = 0,
            cartao_ultimos_digitos = 'ADMIN',
            cartao_bandeira = 'ADMIN',
            updated_at = NOW()
        WHERE empresa_id = $3
      `, [plano, dataProxima.toISOString(), empresaId]);
      
      console.log(`[Admin] Assinatura ATUALIZADA para empresa ${empresaId}`);
    } else {
      // Criar nova assinatura
      await db.query(`
        INSERT INTO assinaturas (
          empresa_id, plano, status, valor, 
          data_inicio, data_proxima_cobranca,
          cartao_ultimos_digitos, cartao_bandeira,
          created_at, updated_at
        ) VALUES ($1, $2, 'authorized', 0, NOW(), $3, 'ADMIN', 'ADMIN', NOW(), NOW())
      `, [empresaId, plano, dataProxima.toISOString()]);
      
      console.log(`[Admin] Nova assinatura CRIADA para empresa ${empresaId}`);
    }

    // Buscar resultado final
    const resultadoFinal = await db.query(`
      SELECT a.plano, a.status, a.data_proxima_cobranca, e.nome_fantasia, e.email
      FROM assinaturas a 
      JOIN empresas e ON a.empresa_id = e.id 
      WHERE a.empresa_id = $1
    `, [empresaId]);

    return NextResponse.json({
      success: true,
      message: `Plano ${plano.toUpperCase()} ativado com sucesso para ${empresaNome}`,
      data: {
        empresa_id: empresaId,
        empresa_nome: empresaNome,
        plano: plano,
        status: 'authorized',
        vencimento: dataProxima.toLocaleDateString('pt-BR'),
        detalhes: resultadoFinal.rows[0]
      }
    });

  } catch (error) {
    console.error('[Admin] Erro ao ativar plano:', error);
    return NextResponse.json({ 
      error: 'Erro ao ativar plano',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
