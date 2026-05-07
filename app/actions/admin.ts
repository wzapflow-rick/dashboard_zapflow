'use server';

import db from '@/lib/db';
import { revalidatePath } from 'next/cache';

// ==================== DASHBOARD ====================

export async function getAdminStats() {
  try {
    console.log('[Admin] Buscando stats...');
    
    // Total de empresas
    const empresasResult = await db.query('SELECT COUNT(*)::int as total FROM empresas');
    const totalEmpresas = empresasResult.rows[0]?.total || 0;
    console.log('[Admin] Total empresas:', totalEmpresas);

    // Total de assinaturas ativas
    const assinaturasResult = await db.query(
      "SELECT COUNT(*)::int as total FROM assinaturas WHERE status = 'authorized'"
    );
    const assinaturasAtivas = assinaturasResult.rows[0]?.total || 0;
    console.log('[Admin] Assinaturas ativas:', assinaturasAtivas);

    // Assinaturas por plano
    const planoResult = await db.query(`
      SELECT LOWER(plano) as plano, COUNT(*)::int as total 
      FROM assinaturas 
      WHERE status = 'authorized'
      GROUP BY LOWER(plano)
    `);
    console.log('[Admin] Planos encontrados:', planoResult.rows);
    
    const assinaturasPorPlano: Record<string, number> = {
      start: 0,
      pro: 0,
      elite: 0
    };
    planoResult.rows.forEach((row: any) => {
      if (row.plano) {
        assinaturasPorPlano[row.plano] = row.total;
      }
    });

    // Assinaturas vencendo em 7 dias
    const vencendoResult = await db.query(`
      SELECT COUNT(*)::int as total 
      FROM assinaturas 
      WHERE status = 'authorized'
      AND data_proxima_cobranca <= NOW() + INTERVAL '7 days'
      AND data_proxima_cobranca > NOW()
    `);
    const vencendoEm7Dias = vencendoResult.rows[0]?.total || 0;

    // Empresas recentes (ultimos 7 dias)
    const recentesResult = await db.query(`
      SELECT COUNT(*)::int as total 
      FROM empresas 
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);
    const empresasRecentes = recentesResult.rows[0]?.total || 0;

    console.log('[Admin] Stats finais:', {
      totalEmpresas,
      assinaturasAtivas,
      assinaturasPorPlano,
      vencendoEm7Dias,
      empresasRecentes
    });

    return {
      success: true,
      stats: {
        totalEmpresas,
        empresasAtivas: totalEmpresas,
        assinaturasAtivas,
        assinaturasPorPlano,
        vencendoEm7Dias,
        empresasRecentes,
      }
    };
  } catch (error) {
    console.error('[Admin] Erro ao buscar stats:', error);
    return { 
      success: false, 
      error: 'Erro ao buscar estatisticas',
      stats: {
        totalEmpresas: 0,
        empresasAtivas: 0,
        assinaturasAtivas: 0,
        assinaturasPorPlano: { start: 0, pro: 0, elite: 0 },
        vencendoEm7Dias: 0,
        empresasRecentes: 0,
      }
    };
  }
}

// ==================== EMPRESAS ====================

export async function getEmpresas(page = 1, limit = 20, search = '') {
  try {
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT e.*, a.plano as assinatura_plano, a.status as assinatura_status, a.data_proxima_cobranca
      FROM empresas e
      LEFT JOIN assinaturas a ON e.id = a.empresa_id AND a.status = 'authorized'
    `;
    
    const params: any[] = [];
    
    if (search) {
      query += ` WHERE e.nome ILIKE $1 OR e.nome_fantasia ILIKE $1 OR e.slug ILIKE $1 OR e.email ILIKE $1`;
      params.push(`%${search}%`);
    }
    
    query += ` ORDER BY e.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Total count
    let countQuery = 'SELECT COUNT(*) as total FROM empresas';
    const countParams: any[] = [];
    
    if (search) {
      countQuery += ` WHERE nome ILIKE $1 OR nome_fantasia ILIKE $1 OR slug ILIKE $1 OR email ILIKE $1`;
      countParams.push(`%${search}%`);
    }
    
    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0]?.total || '0');

    return {
      success: true,
      empresas: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    };
  } catch (error) {
    console.error('Erro ao buscar empresas:', error);
    return { success: false, error: 'Erro ao buscar empresas' };
  }
}

export async function getEmpresaById(id: number) {
  try {
    const result = await db.query(`
      SELECT e.*, a.id as assinatura_id, a.plano, a.status as assinatura_status, 
             a.data_proxima_cobranca, a.data_inicio, a.valor
      FROM empresas e
      LEFT JOIN assinaturas a ON e.id = a.empresa_id
      WHERE e.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return { success: false, error: 'Empresa nao encontrada' };
    }

    return { success: true, empresa: result.rows[0] };
  } catch (error) {
    console.error('Erro ao buscar empresa:', error);
    return { success: false, error: 'Erro ao buscar empresa' };
  }
}

export async function createEmpresa(data: {
  nome: string;
  nome_fantasia?: string;
  slug: string;
  email?: string;
  telefone?: string;
  plano?: string;
  dias_trial?: number;
}) {
  try {
    // Verificar se slug ja existe
    const existingSlug = await db.query('SELECT id FROM empresas WHERE slug = $1', [data.slug]);
    if (existingSlug.rows.length > 0) {
      return { success: false, error: 'Slug ja existe' };
    }

    // Criar empresa
    const empresaResult = await db.query(`
      INSERT INTO empresas (nome, nome_fantasia, slug, email, telefone, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id
    `, [data.nome, data.nome_fantasia || data.nome, data.slug, data.email, data.telefone]);

    const empresaId = empresaResult.rows[0].id;

    // Criar assinatura se plano foi especificado
    if (data.plano) {
      const diasTrial = data.dias_trial || 30;
      const dataProxima = new Date();
      dataProxima.setDate(dataProxima.getDate() + diasTrial);

      await db.query(`
        INSERT INTO assinaturas (
          empresa_id, plano, status, valor, 
          data_inicio, data_proxima_cobranca,
          cartao_ultimos_digitos, cartao_bandeira,
          created_at, updated_at
        ) VALUES ($1, $2, 'authorized', 0, NOW(), $3, 'ADMIN', 'ADMIN', NOW(), NOW())
      `, [empresaId, data.plano, dataProxima.toISOString()]);
    }

    revalidatePath('/admin/empresas');
    return { success: true, empresaId };
  } catch (error) {
    console.error('Erro ao criar empresa:', error);
    return { success: false, error: 'Erro ao criar empresa' };
  }
}

export async function updateEmpresa(id: number, data: {
  nome?: string;
  nome_fantasia?: string;
  slug?: string;
  email?: string;
  telefone?: string;
  status?: string;
}) {
  try {
    // Se mudou slug, verificar se ja existe
    if (data.slug) {
      const existingSlug = await db.query(
        'SELECT id FROM empresas WHERE slug = $1 AND id != $2', 
        [data.slug, id]
      );
      if (existingSlug.rows.length > 0) {
        return { success: false, error: 'Slug ja existe' };
      }
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.nome !== undefined) {
      updates.push(`nome = $${paramIndex++}`);
      params.push(data.nome);
    }
    if (data.nome_fantasia !== undefined) {
      updates.push(`nome_fantasia = $${paramIndex++}`);
      params.push(data.nome_fantasia);
    }
    if (data.slug !== undefined) {
      updates.push(`slug = $${paramIndex++}`);
      params.push(data.slug);
    }
    if (data.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      params.push(data.email);
    }
    if (data.telefone !== undefined) {
      updates.push(`telefone = $${paramIndex++}`);
      params.push(data.telefone);
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(data.status);
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    await db.query(
      `UPDATE empresas SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      params
    );

    revalidatePath('/admin/empresas');
    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar empresa:', error);
    return { success: false, error: 'Erro ao atualizar empresa' };
  }
}

export async function deleteEmpresa(id: number) {
  try {
    console.log('[Admin] Deletando empresa:', id);
    
    // Primeiro deletar assinaturas relacionadas
    await db.query('DELETE FROM assinaturas WHERE empresa_id = $1', [id]);
    
    // Deletar usuarios relacionados
    await db.query('DELETE FROM usuarios WHERE empresa_id = $1', [id]);
    
    // Deletar a empresa
    await db.query('DELETE FROM empresas WHERE id = $1', [id]);

    revalidatePath('/admin/empresas');
    revalidatePath('/admin/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Erro ao deletar empresa:', error);
    return { success: false, error: 'Erro ao deletar empresa' };
  }
}

// ==================== ASSINATURAS ====================

export async function getAssinaturas(page = 1, limit = 20, search = '') {
  try {
    console.log('[Admin] Buscando assinaturas...');
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT a.*, e.nome as empresa_nome, e.nome_fantasia, e.slug, e.email
      FROM assinaturas a
      LEFT JOIN empresas e ON a.empresa_id = e.id
    `;
    
    const params: any[] = [];
    
    if (search) {
      query += ` WHERE e.nome ILIKE $1 OR e.nome_fantasia ILIKE $1 OR e.slug ILIKE $1`;
      params.push(`%${search}%`);
    }
    
    query += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    console.log('[Admin] Assinaturas encontradas:', result.rows.length);

    // Total count
    let countQuery = `
      SELECT COUNT(*)::int as total 
      FROM assinaturas a
      LEFT JOIN empresas e ON a.empresa_id = e.id
    `;
    const countParams: any[] = [];
    
    if (search) {
      countQuery += ` WHERE e.nome ILIKE $1 OR e.nome_fantasia ILIKE $1 OR e.slug ILIKE $1`;
      countParams.push(`%${search}%`);
    }
    
    const countResult = await db.query(countQuery, countParams);
    const total = countResult.rows[0]?.total || 0;
    console.log('[Admin] Total assinaturas:', total);

    return {
      success: true,
      assinaturas: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    };
  } catch (error) {
    console.error('[Admin] Erro ao buscar assinaturas:', error);
    return { success: false, error: 'Erro ao buscar assinaturas', assinaturas: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
  }
}

export async function updateAssinatura(empresaId: number, data: {
  plano?: string;
  status?: string;
  data_proxima_cobranca?: string;
  valor?: number;
}) {
  try {
    // Verificar se existe assinatura
    const existing = await db.query(
      'SELECT id FROM assinaturas WHERE empresa_id = $1',
      [empresaId]
    );

    if (existing.rows.length === 0) {
      // Criar nova assinatura
      await db.query(`
        INSERT INTO assinaturas (
          empresa_id, plano, status, valor, 
          data_inicio, data_proxima_cobranca,
          cartao_ultimos_digitos, cartao_bandeira,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, NOW(), $5, 'ADMIN', 'ADMIN', NOW(), NOW())
      `, [
        empresaId, 
        data.plano || 'start', 
        data.status || 'authorized',
        data.valor || 0,
        data.data_proxima_cobranca || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      ]);
    } else {
      // Atualizar existente
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (data.plano !== undefined) {
        updates.push(`plano = $${paramIndex++}`);
        params.push(data.plano);
      }
      if (data.status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        params.push(data.status);
      }
      if (data.data_proxima_cobranca !== undefined) {
        updates.push(`data_proxima_cobranca = $${paramIndex++}`);
        params.push(data.data_proxima_cobranca);
      }
      if (data.valor !== undefined) {
        updates.push(`valor = $${paramIndex++}`);
        params.push(data.valor);
      }

      if (updates.length > 0) {
        updates.push(`updated_at = NOW()`);
        params.push(empresaId);

        await db.query(
          `UPDATE assinaturas SET ${updates.join(', ')} WHERE empresa_id = $${paramIndex}`,
          params
        );
      }
    }

    revalidatePath('/admin/assinaturas');
    revalidatePath('/admin/empresas');
    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar assinatura:', error);
    return { success: false, error: 'Erro ao atualizar assinatura' };
  }
}

export async function concederTrialGratuito(empresaId: number, dias: number, plano: string) {
  console.log('[Admin] concederTrialGratuito chamado:', { empresaId, dias, plano });
  
  try {
    const dataProxima = new Date();
    dataProxima.setDate(dataProxima.getDate() + dias);
    console.log('[Admin] Data proxima cobranca:', dataProxima.toISOString());

    // Verificar se existe assinatura
    const existing = await db.query(
      'SELECT id FROM assinaturas WHERE empresa_id = $1',
      [empresaId]
    );
    console.log('[Admin] Assinatura existente:', existing.rows.length > 0 ? 'Sim' : 'Nao');

    if (existing.rows.length === 0) {
      // Criar nova assinatura
      console.log('[Admin] Criando nova assinatura...');
      await db.query(`
        INSERT INTO assinaturas (
          empresa_id, plano, status, valor, 
          data_inicio, data_proxima_cobranca,
          cartao_ultimos_digitos, cartao_bandeira,
          created_at, updated_at
        ) VALUES ($1, $2, 'authorized', 0, NOW(), $3, 'TRIAL', 'TRIAL', NOW(), NOW())
      `, [empresaId, plano, dataProxima.toISOString()]);
      console.log('[Admin] Nova assinatura criada com sucesso');
    } else {
      // Atualizar existente
      console.log('[Admin] Atualizando assinatura existente...');
      await db.query(`
        UPDATE assinaturas 
        SET plano = $1, status = 'authorized', data_proxima_cobranca = $2, 
            valor = 0, cartao_ultimos_digitos = 'TRIAL', cartao_bandeira = 'TRIAL',
            updated_at = NOW()
        WHERE empresa_id = $3
      `, [plano, dataProxima.toISOString(), empresaId]);
      console.log('[Admin] Assinatura atualizada com sucesso');
    }

    revalidatePath('/admin/assinaturas');
    revalidatePath('/admin/empresas');
    console.log('[Admin] Trial concedido com sucesso!');
    return { success: true };
  } catch (error: any) {
    console.error('[Admin] Erro ao conceder trial:', error);
    const errorMessage = error?.message || 'Erro ao conceder trial';
    return { success: false, error: errorMessage };
  }
}
