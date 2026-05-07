'use server';

import db from '@/lib/db';
import { revalidatePath } from 'next/cache';

export interface CupomPlataforma {
  id: number;
  codigo: string;
  descricao: string | null;
  tipo: 'percentual' | 'fixo';
  valor: number;
  valor_minimo: number;
  uso_maximo: number | null;
  uso_atual: number;
  data_inicio: string;
  data_fim: string | null;
  planos_aplicaveis: string[];
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CupomValidationResult {
  valid: boolean;
  cupom?: CupomPlataforma;
  desconto?: number;
  precoFinal?: number;
  mensagem: string;
}

// Listar todos os cupons
export async function listarCuponsPlataforma(): Promise<{ success: boolean; cupons?: CupomPlataforma[]; error?: string }> {
  try {
    const result = await db.query(`
      SELECT * FROM cupons_plataforma 
      ORDER BY created_at DESC
    `);
    
    return { success: true, cupons: result.rows };
  } catch (error: any) {
    console.error('[Cupons] Erro ao listar cupons:', error);
    return { success: false, error: error.message };
  }
}

// Criar novo cupom
export async function criarCupomPlataforma(data: {
  codigo: string;
  descricao?: string;
  tipo: 'percentual' | 'fixo';
  valor: number;
  valor_minimo?: number;
  uso_maximo?: number | null;
  data_inicio?: string;
  data_fim?: string | null;
  planos_aplicaveis?: string[];
}): Promise<{ success: boolean; cupom?: CupomPlataforma; error?: string }> {
  try {
    // Validar codigo (uppercase, sem espacos)
    const codigo = data.codigo.toUpperCase().trim().replace(/\s+/g, '');
    
    // Verificar se ja existe
    const existing = await db.query(
      'SELECT id FROM cupons_plataforma WHERE codigo = $1',
      [codigo]
    );
    
    if (existing.rows.length > 0) {
      return { success: false, error: 'Ja existe um cupom com este codigo' };
    }
    
    const result = await db.query(`
      INSERT INTO cupons_plataforma (
        codigo, descricao, tipo, valor, valor_minimo, 
        uso_maximo, data_inicio, data_fim, planos_aplicaveis
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      codigo,
      data.descricao || null,
      data.tipo,
      data.valor,
      data.valor_minimo || 0,
      data.uso_maximo || null,
      data.data_inicio || new Date().toISOString(),
      data.data_fim || null,
      data.planos_aplicaveis || ['start', 'pro', 'elite'],
    ]);
    
    revalidatePath('/admin/cupons');
    return { success: true, cupom: result.rows[0] };
  } catch (error: any) {
    console.error('[Cupons] Erro ao criar cupom:', error);
    return { success: false, error: error.message };
  }
}

// Atualizar cupom
export async function atualizarCupomPlataforma(
  id: number,
  data: Partial<{
    codigo: string;
    descricao: string | null;
    tipo: 'percentual' | 'fixo';
    valor: number;
    valor_minimo: number;
    uso_maximo: number | null;
    data_inicio: string;
    data_fim: string | null;
    planos_aplicaveis: string[];
    ativo: boolean;
  }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (data.codigo !== undefined) {
      fields.push(`codigo = $${paramIndex++}`);
      values.push(data.codigo.toUpperCase().trim());
    }
    if (data.descricao !== undefined) {
      fields.push(`descricao = $${paramIndex++}`);
      values.push(data.descricao);
    }
    if (data.tipo !== undefined) {
      fields.push(`tipo = $${paramIndex++}`);
      values.push(data.tipo);
    }
    if (data.valor !== undefined) {
      fields.push(`valor = $${paramIndex++}`);
      values.push(data.valor);
    }
    if (data.valor_minimo !== undefined) {
      fields.push(`valor_minimo = $${paramIndex++}`);
      values.push(data.valor_minimo);
    }
    if (data.uso_maximo !== undefined) {
      fields.push(`uso_maximo = $${paramIndex++}`);
      values.push(data.uso_maximo);
    }
    if (data.data_inicio !== undefined) {
      fields.push(`data_inicio = $${paramIndex++}`);
      values.push(data.data_inicio);
    }
    if (data.data_fim !== undefined) {
      fields.push(`data_fim = $${paramIndex++}`);
      values.push(data.data_fim);
    }
    if (data.planos_aplicaveis !== undefined) {
      fields.push(`planos_aplicaveis = $${paramIndex++}`);
      values.push(data.planos_aplicaveis);
    }
    if (data.ativo !== undefined) {
      fields.push(`ativo = $${paramIndex++}`);
      values.push(data.ativo);
    }
    
    fields.push(`updated_at = $${paramIndex++}`);
    values.push(new Date().toISOString());
    
    values.push(id);
    
    await db.query(`
      UPDATE cupons_plataforma 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
    `, values);
    
    revalidatePath('/admin/cupons');
    return { success: true };
  } catch (error: any) {
    console.error('[Cupons] Erro ao atualizar cupom:', error);
    return { success: false, error: error.message };
  }
}

// Excluir cupom
export async function excluirCupomPlataforma(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    await db.query('DELETE FROM cupons_plataforma WHERE id = $1', [id]);
    
    revalidatePath('/admin/cupons');
    return { success: true };
  } catch (error: any) {
    console.error('[Cupons] Erro ao excluir cupom:', error);
    return { success: false, error: error.message };
  }
}

// Alternar status ativo/inativo
export async function toggleCupomPlataforma(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    await db.query(`
      UPDATE cupons_plataforma 
      SET ativo = NOT ativo, updated_at = NOW()
      WHERE id = $1
    `, [id]);
    
    revalidatePath('/admin/cupons');
    return { success: true };
  } catch (error: any) {
    console.error('[Cupons] Erro ao alternar cupom:', error);
    return { success: false, error: error.message };
  }
}

// Validar cupom (usado no checkout)
export async function validarCupomPlataforma(
  codigo: string,
  plano: string,
  precoOriginal: number
): Promise<CupomValidationResult> {
  try {
    const codigoNormalizado = codigo.toUpperCase().trim();
    
    const result = await db.query(`
      SELECT * FROM cupons_plataforma 
      WHERE codigo = $1 AND ativo = true
    `, [codigoNormalizado]);
    
    if (result.rows.length === 0) {
      return { valid: false, mensagem: 'Cupom invalido ou expirado' };
    }
    
    const cupom: CupomPlataforma = result.rows[0];
    
    // Verificar data de inicio
    if (cupom.data_inicio && new Date(cupom.data_inicio) > new Date()) {
      return { valid: false, mensagem: 'Cupom ainda nao esta ativo' };
    }
    
    // Verificar data de fim
    if (cupom.data_fim && new Date(cupom.data_fim) < new Date()) {
      return { valid: false, mensagem: 'Cupom expirado' };
    }
    
    // Verificar limite de uso
    if (cupom.uso_maximo !== null && cupom.uso_atual >= cupom.uso_maximo) {
      return { valid: false, mensagem: 'Cupom esgotado' };
    }
    
    // Verificar plano aplicavel
    if (!cupom.planos_aplicaveis.includes(plano)) {
      return { valid: false, mensagem: `Cupom nao aplicavel ao plano ${plano}` };
    }
    
    // Verificar valor minimo
    if (precoOriginal < cupom.valor_minimo) {
      return { valid: false, mensagem: `Valor minimo para usar este cupom: R$ ${cupom.valor_minimo.toFixed(2)}` };
    }
    
    // Calcular desconto
    let desconto = 0;
    if (cupom.tipo === 'percentual') {
      desconto = precoOriginal * (cupom.valor / 100);
    } else {
      desconto = cupom.valor;
    }
    
    // Garantir que o desconto nao seja maior que o preco
    desconto = Math.min(desconto, precoOriginal);
    const precoFinal = precoOriginal - desconto;
    
    return {
      valid: true,
      cupom,
      desconto,
      precoFinal,
      mensagem: cupom.tipo === 'percentual' 
        ? `Desconto de ${cupom.valor}% aplicado!`
        : `Desconto de R$ ${cupom.valor.toFixed(2)} aplicado!`,
    };
  } catch (error: any) {
    console.error('[Cupons] Erro ao validar cupom:', error);
    return { valid: false, mensagem: 'Erro ao validar cupom' };
  }
}

// Incrementar uso do cupom (chamado apos pagamento confirmado)
export async function incrementarUsoCupom(cupomId: number): Promise<void> {
  try {
    await db.query(`
      UPDATE cupons_plataforma 
      SET uso_atual = uso_atual + 1, updated_at = NOW()
      WHERE id = $1
    `, [cupomId]);
  } catch (error) {
    console.error('[Cupons] Erro ao incrementar uso:', error);
  }
}
