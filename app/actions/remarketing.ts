'use server';

import { pg } from '@/lib/postgres';
import {
  REMARKETING_CONFIG_TABLE,
  REMARKETING_CATEGORIAS_TABLE,
  REMARKETING_TIPOS_DOR_TABLE,
  REMARKETING_ETIQUETAS_TABLE,
  REMARKETING_MENSAGENS_TABLE,
  REMARKETING_COMBINACOES_TABLE,
  REMARKETING_CONTATOS_TABLE,
  REMARKETING_CONTATOS_ETIQUETAS_TABLE,
  REMARKETING_CONTATOS_CATEGORIAS_TABLE,
  REMARKETING_FILA_TABLE,
  REMARKETING_HISTORICO_TABLE,
} from '@/lib/tables';

// ============================================================
// TIPOS
// ============================================================

export interface RemarketingConfig {
  id: number;
  instance_name: string | null;
  api_key_cron: string;
  horario_inicio: string;
  horario_fim: string;
  dias_semana: number[];
  limite_por_hora: number;
  limite_por_dia: number;
  intervalo_segundos: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface RemarketingCategoria {
  id: number;
  nome: string;
  descricao: string | null;
  cor: string;
  icone: string;
  prioridade: number;
  cooldown_horas: number;
  tipo_selecao: 'automatica' | 'manual';
  regras: Record<string, unknown> | null;
  mensagem_modo: 'automatico' | 'escolher';
  ativo: boolean;
  ordem: number;
  created_at: string;
}

export interface RemarketingTipoDor {
  id: number;
  nome: string;
  descricao: string | null;
  icone: string | null;
  ativo: boolean;
  ordem: number;
}

export interface RemarketingEtiqueta {
  id: number;
  nome: string;
  cor: string;
  descricao: string | null;
  ativo: boolean;
  ordem: number;
}

export interface RemarketingMensagem {
  id: number;
  nome: string;
  tipo_dor_id: number | null;
  conteudo: string;
  tipo_midia: string;
  midia_url: string | null;
  variaveis_disponiveis: string[];
  ativo: boolean;
  ordem: number;
  created_at: string;
  // Joined
  tipo_dor_nome?: string;
}

export interface RemarketingCombinacao {
  id: number;
  categoria_id: number;
  tipo_dor_id: number;
  mensagem_id: number;
  prioridade: number;
  ativo: boolean;
  // Joined
  categoria_nome?: string;
  tipo_dor_nome?: string;
  mensagem_nome?: string;
}

export interface RemarketingContato {
  id: number;
  remote_jid: string;
  telefone: string;
  nome: string | null;
  foto_url: string | null;
  origem: string;
  primeira_interacao: string | null;
  ultima_interacao: string | null;
  total_msgs_recebidas: number;
  total_msgs_enviadas: number;
  ultima_msg_remarketing: string | null;
  score: number;
  dados_extras: Record<string, unknown> | null;
  ativo: boolean;
  bloqueado: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  etiquetas?: RemarketingEtiqueta[];
  categorias?: RemarketingCategoria[];
}

export interface RemarketingFilaItem {
  id: number;
  contato_id: number;
  mensagem_id: number | null;
  categoria_id: number | null;
  tipo_dor_id: number | null;
  prioridade: number;
  conteudo_final: string;
  tipo_midia: string;
  midia_url: string | null;
  agendado_para: string;
  status: 'pendente' | 'enviando' | 'enviado' | 'erro' | 'cancelado';
  tentativas: number;
  max_tentativas: number;
  erro: string | null;
  created_at: string;
  enviado_em: string | null;
  // Joined
  contato_nome?: string;
  contato_telefone?: string;
  categoria_nome?: string;
}

export interface RemarketingHistorico {
  id: number;
  contato_id: number | null;
  tipo: string;
  descricao: string | null;
  dados: Record<string, unknown> | null;
  created_at: string;
  // Joined
  contato_nome?: string;
  contato_telefone?: string;
}

// ============================================================
// CONFIGURACOES
// ============================================================

export async function getConfig(): Promise<{ success: boolean; config?: RemarketingConfig; error?: string }> {
  try {
    const config = await pg.findOne<RemarketingConfig>(REMARKETING_CONFIG_TABLE);
    return { success: true, config: config || undefined };
  } catch (error) {
    console.error('[Remarketing] Erro ao buscar config:', error);
    return { success: false, error: 'Erro ao buscar configuracoes' };
  }
}

export async function saveConfig(data: Partial<RemarketingConfig>): Promise<{ success: boolean; config?: RemarketingConfig; error?: string }> {
  try {
    const existing = await pg.findOne<RemarketingConfig>(REMARKETING_CONFIG_TABLE);
    
    let config: RemarketingConfig;
    if (existing) {
      config = await pg.update<RemarketingConfig>(REMARKETING_CONFIG_TABLE, existing.id, {
        ...data,
        updated_at: new Date().toISOString(),
      });
    } else {
      config = await pg.create<RemarketingConfig>(REMARKETING_CONFIG_TABLE, {
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    
    return { success: true, config };
  } catch (error) {
    console.error('[Remarketing] Erro ao salvar config:', error);
    return { success: false, error: 'Erro ao salvar configuracoes' };
  }
}

// ============================================================
// CATEGORIAS
// ============================================================

export async function getCategorias(): Promise<{ success: boolean; categorias?: RemarketingCategoria[]; error?: string }> {
  try {
    const result = await pg.list<RemarketingCategoria>(REMARKETING_CATEGORIAS_TABLE, {
      sort: 'ordem,id',
      limit: 100,
    });
    return { success: true, categorias: result.list };
  } catch (error) {
    console.error('[Remarketing] Erro ao buscar categorias:', error);
    return { success: false, error: 'Erro ao buscar categorias' };
  }
}

export async function createCategoria(data: Partial<RemarketingCategoria>): Promise<{ success: boolean; categoria?: RemarketingCategoria; error?: string }> {
  try {
    const categoria = await pg.create<RemarketingCategoria>(REMARKETING_CATEGORIAS_TABLE, {
      nome: data.nome,
      descricao: data.descricao || null,
      cor: data.cor || '#3B82F6',
      icone: data.icone || 'tag',
      prioridade: data.prioridade ?? 3,
      cooldown_horas: data.cooldown_horas ?? 24,
      tipo_selecao: data.tipo_selecao || 'manual',
      regras: data.regras || null,
      mensagem_modo: data.mensagem_modo || 'automatico',
      ativo: data.ativo ?? true,
      ordem: data.ordem ?? 0,
      created_at: new Date().toISOString(),
    });
    return { success: true, categoria };
  } catch (error) {
    console.error('[Remarketing] Erro ao criar categoria:', error);
    return { success: false, error: 'Erro ao criar categoria' };
  }
}

export async function updateCategoria(id: number, data: Partial<RemarketingCategoria>): Promise<{ success: boolean; categoria?: RemarketingCategoria; error?: string }> {
  try {
    const categoria = await pg.update<RemarketingCategoria>(REMARKETING_CATEGORIAS_TABLE, id, data);
    return { success: true, categoria };
  } catch (error) {
    console.error('[Remarketing] Erro ao atualizar categoria:', error);
    return { success: false, error: 'Erro ao atualizar categoria' };
  }
}

export async function deleteCategoria(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    await pg.delete(REMARKETING_CATEGORIAS_TABLE, id);
    return { success: true };
  } catch (error) {
    console.error('[Remarketing] Erro ao deletar categoria:', error);
    return { success: false, error: 'Erro ao deletar categoria' };
  }
}

// ============================================================
// TIPOS DE DOR
// ============================================================

export async function getTiposDor(): Promise<{ success: boolean; tipos?: RemarketingTipoDor[]; error?: string }> {
  try {
    const result = await pg.list<RemarketingTipoDor>(REMARKETING_TIPOS_DOR_TABLE, {
      sort: 'ordem,id',
      limit: 100,
    });
    return { success: true, tipos: result.list };
  } catch (error) {
    console.error('[Remarketing] Erro ao buscar tipos de dor:', error);
    return { success: false, error: 'Erro ao buscar tipos de dor' };
  }
}

export async function createTipoDor(data: Partial<RemarketingTipoDor>): Promise<{ success: boolean; tipo?: RemarketingTipoDor; error?: string }> {
  try {
    const tipo = await pg.create<RemarketingTipoDor>(REMARKETING_TIPOS_DOR_TABLE, {
      nome: data.nome,
      descricao: data.descricao || null,
      icone: data.icone || null,
      ativo: data.ativo ?? true,
      ordem: data.ordem ?? 0,
    });
    return { success: true, tipo };
  } catch (error) {
    console.error('[Remarketing] Erro ao criar tipo de dor:', error);
    return { success: false, error: 'Erro ao criar tipo de dor' };
  }
}

export async function updateTipoDor(id: number, data: Partial<RemarketingTipoDor>): Promise<{ success: boolean; tipo?: RemarketingTipoDor; error?: string }> {
  try {
    const tipo = await pg.update<RemarketingTipoDor>(REMARKETING_TIPOS_DOR_TABLE, id, data);
    return { success: true, tipo };
  } catch (error) {
    console.error('[Remarketing] Erro ao atualizar tipo de dor:', error);
    return { success: false, error: 'Erro ao atualizar tipo de dor' };
  }
}

export async function deleteTipoDor(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    await pg.delete(REMARKETING_TIPOS_DOR_TABLE, id);
    return { success: true };
  } catch (error) {
    console.error('[Remarketing] Erro ao deletar tipo de dor:', error);
    return { success: false, error: 'Erro ao deletar tipo de dor' };
  }
}

// ============================================================
// ETIQUETAS
// ============================================================

export async function getEtiquetas(): Promise<{ success: boolean; etiquetas?: RemarketingEtiqueta[]; error?: string }> {
  try {
    const result = await pg.list<RemarketingEtiqueta>(REMARKETING_ETIQUETAS_TABLE, {
      sort: 'ordem,id',
      limit: 100,
    });
    return { success: true, etiquetas: result.list };
  } catch (error) {
    console.error('[Remarketing] Erro ao buscar etiquetas:', error);
    return { success: false, error: 'Erro ao buscar etiquetas' };
  }
}

export async function createEtiqueta(data: Partial<RemarketingEtiqueta>): Promise<{ success: boolean; etiqueta?: RemarketingEtiqueta; error?: string }> {
  try {
    const etiqueta = await pg.create<RemarketingEtiqueta>(REMARKETING_ETIQUETAS_TABLE, {
      nome: data.nome,
      cor: data.cor || '#6B7280',
      descricao: data.descricao || null,
      ativo: data.ativo ?? true,
      ordem: data.ordem ?? 0,
    });
    return { success: true, etiqueta };
  } catch (error) {
    console.error('[Remarketing] Erro ao criar etiqueta:', error);
    return { success: false, error: 'Erro ao criar etiqueta' };
  }
}

export async function updateEtiqueta(id: number, data: Partial<RemarketingEtiqueta>): Promise<{ success: boolean; etiqueta?: RemarketingEtiqueta; error?: string }> {
  try {
    const etiqueta = await pg.update<RemarketingEtiqueta>(REMARKETING_ETIQUETAS_TABLE, id, data);
    return { success: true, etiqueta };
  } catch (error) {
    console.error('[Remarketing] Erro ao atualizar etiqueta:', error);
    return { success: false, error: 'Erro ao atualizar etiqueta' };
  }
}

export async function deleteEtiqueta(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    await pg.delete(REMARKETING_ETIQUETAS_TABLE, id);
    return { success: true };
  } catch (error) {
    console.error('[Remarketing] Erro ao deletar etiqueta:', error);
    return { success: false, error: 'Erro ao deletar etiqueta' };
  }
}

// ============================================================
// MENSAGENS
// ============================================================

export async function getMensagens(): Promise<{ success: boolean; mensagens?: RemarketingMensagem[]; error?: string }> {
  try {
    const result = await pg.raw<RemarketingMensagem>(`
      SELECT m.*, t.nome as tipo_dor_nome
      FROM "${REMARKETING_MENSAGENS_TABLE}" m
      LEFT JOIN "${REMARKETING_TIPOS_DOR_TABLE}" t ON t.id = m.tipo_dor_id
      ORDER BY m.ordem, m.id
    `);
    return { success: true, mensagens: result };
  } catch (error) {
    console.error('[Remarketing] Erro ao buscar mensagens:', error);
    return { success: false, error: 'Erro ao buscar mensagens' };
  }
}

export async function createMensagem(data: Partial<RemarketingMensagem>): Promise<{ success: boolean; mensagem?: RemarketingMensagem; error?: string }> {
  try {
    const mensagem = await pg.create<RemarketingMensagem>(REMARKETING_MENSAGENS_TABLE, {
      nome: data.nome,
      tipo_dor_id: data.tipo_dor_id || null,
      conteudo: data.conteudo,
      tipo_midia: data.tipo_midia || 'texto',
      midia_url: data.midia_url || null,
      variaveis_disponiveis: JSON.stringify(data.variaveis_disponiveis || ['nome', 'telefone']),
      ativo: data.ativo ?? true,
      ordem: data.ordem ?? 0,
      created_at: new Date().toISOString(),
    });
    return { success: true, mensagem };
  } catch (error) {
    console.error('[Remarketing] Erro ao criar mensagem:', error);
    return { success: false, error: 'Erro ao criar mensagem' };
  }
}

export async function updateMensagem(id: number, data: Partial<RemarketingMensagem>): Promise<{ success: boolean; mensagem?: RemarketingMensagem; error?: string }> {
  try {
    const updateData: Record<string, unknown> = { ...data };
    if (data.variaveis_disponiveis) {
      updateData.variaveis_disponiveis = JSON.stringify(data.variaveis_disponiveis);
    }
    const mensagem = await pg.update<RemarketingMensagem>(REMARKETING_MENSAGENS_TABLE, id, updateData);
    return { success: true, mensagem };
  } catch (error) {
    console.error('[Remarketing] Erro ao atualizar mensagem:', error);
    return { success: false, error: 'Erro ao atualizar mensagem' };
  }
}

export async function deleteMensagem(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    await pg.delete(REMARKETING_MENSAGENS_TABLE, id);
    return { success: true };
  } catch (error) {
    console.error('[Remarketing] Erro ao deletar mensagem:', error);
    return { success: false, error: 'Erro ao deletar mensagem' };
  }
}

// ============================================================
// COMBINACOES
// ============================================================

export async function getCombinacoes(): Promise<{ success: boolean; combinacoes?: RemarketingCombinacao[]; error?: string }> {
  try {
    const result = await pg.raw<RemarketingCombinacao>(`
      SELECT c.*, 
        cat.nome as categoria_nome,
        t.nome as tipo_dor_nome,
        m.nome as mensagem_nome
      FROM "${REMARKETING_COMBINACOES_TABLE}" c
      LEFT JOIN "${REMARKETING_CATEGORIAS_TABLE}" cat ON cat.id = c.categoria_id
      LEFT JOIN "${REMARKETING_TIPOS_DOR_TABLE}" t ON t.id = c.tipo_dor_id
      LEFT JOIN "${REMARKETING_MENSAGENS_TABLE}" m ON m.id = c.mensagem_id
      ORDER BY c.categoria_id, c.tipo_dor_id, c.prioridade
    `);
    return { success: true, combinacoes: result };
  } catch (error) {
    console.error('[Remarketing] Erro ao buscar combinacoes:', error);
    return { success: false, error: 'Erro ao buscar combinacoes' };
  }
}

export async function createCombinacao(data: Partial<RemarketingCombinacao>): Promise<{ success: boolean; combinacao?: RemarketingCombinacao; error?: string }> {
  try {
    const combinacao = await pg.create<RemarketingCombinacao>(REMARKETING_COMBINACOES_TABLE, {
      categoria_id: data.categoria_id,
      tipo_dor_id: data.tipo_dor_id,
      mensagem_id: data.mensagem_id,
      prioridade: data.prioridade ?? 1,
      ativo: data.ativo ?? true,
    });
    return { success: true, combinacao };
  } catch (error) {
    console.error('[Remarketing] Erro ao criar combinacao:', error);
    return { success: false, error: 'Erro ao criar combinacao' };
  }
}

export async function updateCombinacao(id: number, data: Partial<RemarketingCombinacao>): Promise<{ success: boolean; combinacao?: RemarketingCombinacao; error?: string }> {
  try {
    const combinacao = await pg.update<RemarketingCombinacao>(REMARKETING_COMBINACOES_TABLE, id, data);
    return { success: true, combinacao };
  } catch (error) {
    console.error('[Remarketing] Erro ao atualizar combinacao:', error);
    return { success: false, error: 'Erro ao atualizar combinacao' };
  }
}

export async function deleteCombinacao(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    await pg.delete(REMARKETING_COMBINACOES_TABLE, id);
    return { success: true };
  } catch (error) {
    console.error('[Remarketing] Erro ao deletar combinacao:', error);
    return { success: false, error: 'Erro ao deletar combinacao' };
  }
}

// ============================================================
// CONTATOS
// ============================================================

export async function getContatos(page = 1, limit = 50, search = ''): Promise<{ 
  success: boolean; 
  contatos?: RemarketingContato[]; 
  pagination?: { page: number; limit: number; total: number; totalPages: number };
  error?: string 
}> {
  try {
    const offset = (page - 1) * limit;
    
    let whereClause = '1=1';
    const params: unknown[] = [];
    
    if (search) {
      whereClause = `(c.nome ILIKE $1 OR c.telefone ILIKE $1 OR c.remote_jid ILIKE $1)`;
      params.push(`%${search}%`);
    }
    
    // Count total
    const countResult = await pg.raw<{ total: string }>(`
      SELECT COUNT(*) as total FROM "${REMARKETING_CONTATOS_TABLE}" c WHERE ${whereClause}
    `, params);
    const total = parseInt(countResult[0]?.total || '0', 10);
    
    // Get contatos
    const contatos = await pg.raw<RemarketingContato>(`
      SELECT c.* FROM "${REMARKETING_CONTATOS_TABLE}" c
      WHERE ${whereClause}
      ORDER BY c.ultima_interacao DESC NULLS LAST, c.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `, params);
    
    // Get etiquetas for each contato
    for (const contato of contatos) {
      const etiquetas = await pg.raw<RemarketingEtiqueta>(`
        SELECT e.* FROM "${REMARKETING_ETIQUETAS_TABLE}" e
        INNER JOIN "${REMARKETING_CONTATOS_ETIQUETAS_TABLE}" ce ON ce.etiqueta_id = e.id
        WHERE ce.contato_id = $1
      `, [contato.id]);
      contato.etiquetas = etiquetas;
      
      const categorias = await pg.raw<RemarketingCategoria>(`
        SELECT cat.* FROM "${REMARKETING_CATEGORIAS_TABLE}" cat
        INNER JOIN "${REMARKETING_CONTATOS_CATEGORIAS_TABLE}" cc ON cc.categoria_id = cat.id
        WHERE cc.contato_id = $1
      `, [contato.id]);
      contato.categorias = categorias;
    }
    
    return { 
      success: true, 
      contatos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    };
  } catch (error) {
    console.error('[Remarketing] Erro ao buscar contatos:', error);
    return { success: false, error: 'Erro ao buscar contatos' };
  }
}

export async function importarContato(data: {
  remote_jid: string;
  telefone: string;
  nome?: string;
  foto_url?: string;
  origem?: string;
}): Promise<{ success: boolean; contato?: RemarketingContato; error?: string }> {
  try {
    // Check if already exists
    const existing = await pg.findOne<RemarketingContato>(REMARKETING_CONTATOS_TABLE, {
      where: { remote_jid: data.remote_jid }
    });
    
    if (existing) {
      // Update existing
      const contato = await pg.update<RemarketingContato>(REMARKETING_CONTATOS_TABLE, existing.id, {
        nome: data.nome || existing.nome,
        foto_url: data.foto_url || existing.foto_url,
        updated_at: new Date().toISOString(),
      });
      return { success: true, contato };
    }
    
    // Create new
    const contato = await pg.create<RemarketingContato>(REMARKETING_CONTATOS_TABLE, {
      remote_jid: data.remote_jid,
      telefone: data.telefone,
      nome: data.nome || null,
      foto_url: data.foto_url || null,
      origem: data.origem || 'importado',
      score: 50,
      ativo: true,
      bloqueado: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    return { success: true, contato };
  } catch (error) {
    console.error('[Remarketing] Erro ao importar contato:', error);
    return { success: false, error: 'Erro ao importar contato' };
  }
}

export async function updateContato(id: number, data: Partial<RemarketingContato>): Promise<{ success: boolean; contato?: RemarketingContato; error?: string }> {
  try {
    const contato = await pg.update<RemarketingContato>(REMARKETING_CONTATOS_TABLE, id, {
      ...data,
      updated_at: new Date().toISOString(),
    });
    return { success: true, contato };
  } catch (error) {
    console.error('[Remarketing] Erro ao atualizar contato:', error);
    return { success: false, error: 'Erro ao atualizar contato' };
  }
}

export async function deleteContato(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete relations first
    await pg.raw(`DELETE FROM "${REMARKETING_CONTATOS_ETIQUETAS_TABLE}" WHERE contato_id = $1`, [id]);
    await pg.raw(`DELETE FROM "${REMARKETING_CONTATOS_CATEGORIAS_TABLE}" WHERE contato_id = $1`, [id]);
    await pg.delete(REMARKETING_CONTATOS_TABLE, id);
    return { success: true };
  } catch (error) {
    console.error('[Remarketing] Erro ao deletar contato:', error);
    return { success: false, error: 'Erro ao deletar contato' };
  }
}

export async function addEtiquetaToContato(contatoId: number, etiquetaId: number): Promise<{ success: boolean; error?: string }> {
  try {
    await pg.raw(`
      INSERT INTO "${REMARKETING_CONTATOS_ETIQUETAS_TABLE}" (contato_id, etiqueta_id, adicionado_em, origem)
      VALUES ($1, $2, NOW(), 'manual')
      ON CONFLICT (contato_id, etiqueta_id) DO NOTHING
    `, [contatoId, etiquetaId]);
    return { success: true };
  } catch (error) {
    console.error('[Remarketing] Erro ao adicionar etiqueta:', error);
    return { success: false, error: 'Erro ao adicionar etiqueta' };
  }
}

export async function removeEtiquetaFromContato(contatoId: number, etiquetaId: number): Promise<{ success: boolean; error?: string }> {
  try {
    await pg.raw(`
      DELETE FROM "${REMARKETING_CONTATOS_ETIQUETAS_TABLE}" 
      WHERE contato_id = $1 AND etiqueta_id = $2
    `, [contatoId, etiquetaId]);
    return { success: true };
  } catch (error) {
    console.error('[Remarketing] Erro ao remover etiqueta:', error);
    return { success: false, error: 'Erro ao remover etiqueta' };
  }
}

export async function addCategoriaToContato(contatoId: number, categoriaId: number, origem = 'manual'): Promise<{ success: boolean; error?: string }> {
  try {
    await pg.raw(`
      INSERT INTO "${REMARKETING_CONTATOS_CATEGORIAS_TABLE}" (contato_id, categoria_id, adicionado_em, origem)
      VALUES ($1, $2, NOW(), $3)
      ON CONFLICT (contato_id, categoria_id) DO NOTHING
    `, [contatoId, categoriaId, origem]);
    return { success: true };
  } catch (error) {
    console.error('[Remarketing] Erro ao adicionar categoria:', error);
    return { success: false, error: 'Erro ao adicionar categoria' };
  }
}

export async function removeCategoriaFromContato(contatoId: number, categoriaId: number): Promise<{ success: boolean; error?: string }> {
  try {
    await pg.raw(`
      DELETE FROM "${REMARKETING_CONTATOS_CATEGORIAS_TABLE}" 
      WHERE contato_id = $1 AND categoria_id = $2
    `, [contatoId, categoriaId]);
    return { success: true };
  } catch (error) {
    console.error('[Remarketing] Erro ao remover categoria:', error);
    return { success: false, error: 'Erro ao remover categoria' };
  }
}

// ============================================================
// FILA
// ============================================================

export async function getFila(page = 1, limit = 50, status?: string): Promise<{ 
  success: boolean; 
  fila?: RemarketingFilaItem[]; 
  pagination?: { page: number; limit: number; total: number; totalPages: number };
  error?: string 
}> {
  try {
    const offset = (page - 1) * limit;
    
    let whereClause = '1=1';
    const params: unknown[] = [];
    
    if (status) {
      whereClause = `f.status = $1`;
      params.push(status);
    }
    
    // Count total
    const countResult = await pg.raw<{ total: string }>(`
      SELECT COUNT(*) as total FROM "${REMARKETING_FILA_TABLE}" f WHERE ${whereClause}
    `, params);
    const total = parseInt(countResult[0]?.total || '0', 10);
    
    // Get fila
    const fila = await pg.raw<RemarketingFilaItem>(`
      SELECT f.*, 
        c.nome as contato_nome, 
        c.telefone as contato_telefone,
        cat.nome as categoria_nome
      FROM "${REMARKETING_FILA_TABLE}" f
      LEFT JOIN "${REMARKETING_CONTATOS_TABLE}" c ON c.id = f.contato_id
      LEFT JOIN "${REMARKETING_CATEGORIAS_TABLE}" cat ON cat.id = f.categoria_id
      WHERE ${whereClause}
      ORDER BY f.prioridade ASC, f.agendado_para ASC
      LIMIT ${limit} OFFSET ${offset}
    `, params);
    
    return { 
      success: true, 
      fila,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    };
  } catch (error) {
    console.error('[Remarketing] Erro ao buscar fila:', error);
    return { success: false, error: 'Erro ao buscar fila' };
  }
}

export async function addToFila(data: {
  contato_id: number;
  mensagem_id?: number;
  categoria_id?: number;
  tipo_dor_id?: number;
  conteudo_final: string;
  tipo_midia?: string;
  midia_url?: string;
  prioridade?: number;
  agendado_para?: string;
}): Promise<{ success: boolean; item?: RemarketingFilaItem; error?: string }> {
  try {
    const item = await pg.create<RemarketingFilaItem>(REMARKETING_FILA_TABLE, {
      contato_id: data.contato_id,
      mensagem_id: data.mensagem_id || null,
      categoria_id: data.categoria_id || null,
      tipo_dor_id: data.tipo_dor_id || null,
      prioridade: data.prioridade ?? 3,
      conteudo_final: data.conteudo_final,
      tipo_midia: data.tipo_midia || 'texto',
      midia_url: data.midia_url || null,
      agendado_para: data.agendado_para || new Date().toISOString(),
      status: 'pendente',
      tentativas: 0,
      max_tentativas: 3,
      created_at: new Date().toISOString(),
    });
    return { success: true, item };
  } catch (error) {
    console.error('[Remarketing] Erro ao adicionar na fila:', error);
    return { success: false, error: 'Erro ao adicionar na fila' };
  }
}

export async function updateFilaItem(id: number, data: Partial<RemarketingFilaItem>): Promise<{ success: boolean; error?: string }> {
  try {
    await pg.update(REMARKETING_FILA_TABLE, id, data);
    return { success: true };
  } catch (error) {
    console.error('[Remarketing] Erro ao atualizar item da fila:', error);
    return { success: false, error: 'Erro ao atualizar item da fila' };
  }
}

export async function cancelarFilaItem(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    await pg.update(REMARKETING_FILA_TABLE, id, { status: 'cancelado' });
    return { success: true };
  } catch (error) {
    console.error('[Remarketing] Erro ao cancelar item da fila:', error);
    return { success: false, error: 'Erro ao cancelar item da fila' };
  }
}

// ============================================================
// HISTORICO
// ============================================================

export async function getHistorico(page = 1, limit = 50, contatoId?: number): Promise<{ 
  success: boolean; 
  historico?: RemarketingHistorico[]; 
  pagination?: { page: number; limit: number; total: number; totalPages: number };
  error?: string 
}> {
  try {
    const offset = (page - 1) * limit;
    
    let whereClause = '1=1';
    const params: unknown[] = [];
    
    if (contatoId) {
      whereClause = `h.contato_id = $1`;
      params.push(contatoId);
    }
    
    // Count total
    const countResult = await pg.raw<{ total: string }>(`
      SELECT COUNT(*) as total FROM "${REMARKETING_HISTORICO_TABLE}" h WHERE ${whereClause}
    `, params);
    const total = parseInt(countResult[0]?.total || '0', 10);
    
    // Get historico
    const historico = await pg.raw<RemarketingHistorico>(`
      SELECT h.*, 
        c.nome as contato_nome, 
        c.telefone as contato_telefone
      FROM "${REMARKETING_HISTORICO_TABLE}" h
      LEFT JOIN "${REMARKETING_CONTATOS_TABLE}" c ON c.id = h.contato_id
      WHERE ${whereClause}
      ORDER BY h.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `, params);
    
    return { 
      success: true, 
      historico,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    };
  } catch (error) {
    console.error('[Remarketing] Erro ao buscar historico:', error);
    return { success: false, error: 'Erro ao buscar historico' };
  }
}

export async function addHistorico(data: {
  contato_id?: number;
  tipo: string;
  descricao?: string;
  dados?: Record<string, unknown>;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await pg.create(REMARKETING_HISTORICO_TABLE, {
      contato_id: data.contato_id || null,
      tipo: data.tipo,
      descricao: data.descricao || null,
      dados: data.dados ? JSON.stringify(data.dados) : null,
      created_at: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    console.error('[Remarketing] Erro ao adicionar historico:', error);
    return { success: false, error: 'Erro ao adicionar historico' };
  }
}

// ============================================================
// DASHBOARD STATS
// ============================================================

export async function getDashboardStats(): Promise<{ 
  success: boolean; 
  stats?: {
    totalContatos: number;
    contatosAtivos: number;
    totalCategorias: number;
    totalMensagens: number;
    filaPendente: number;
    enviadosHoje: number;
    enviadosSemana: number;
    taxaSucesso: number;
  };
  error?: string 
}> {
  try {
    const [
      totalContatos,
      contatosAtivos,
      totalCategorias,
      totalMensagens,
      filaPendente,
      enviadosHoje,
      enviadosSemana,
      errosHoje,
    ] = await Promise.all([
      pg.count(REMARKETING_CONTATOS_TABLE),
      pg.count(REMARKETING_CONTATOS_TABLE, { ativo: true, bloqueado: false }),
      pg.count(REMARKETING_CATEGORIAS_TABLE, { ativo: true }),
      pg.count(REMARKETING_MENSAGENS_TABLE, { ativo: true }),
      pg.count(REMARKETING_FILA_TABLE, { status: 'pendente' }),
      pg.raw<{ count: string }>(`
        SELECT COUNT(*) as count FROM "${REMARKETING_FILA_TABLE}" 
        WHERE status = 'enviado' AND enviado_em >= CURRENT_DATE
      `).then(r => parseInt(r[0]?.count || '0', 10)),
      pg.raw<{ count: string }>(`
        SELECT COUNT(*) as count FROM "${REMARKETING_FILA_TABLE}" 
        WHERE status = 'enviado' AND enviado_em >= CURRENT_DATE - INTERVAL '7 days'
      `).then(r => parseInt(r[0]?.count || '0', 10)),
      pg.raw<{ count: string }>(`
        SELECT COUNT(*) as count FROM "${REMARKETING_FILA_TABLE}" 
        WHERE status = 'erro' AND created_at >= CURRENT_DATE
      `).then(r => parseInt(r[0]?.count || '0', 10)),
    ]);
    
    const totalHoje = enviadosHoje + errosHoje;
    const taxaSucesso = totalHoje > 0 ? Math.round((enviadosHoje / totalHoje) * 100) : 100;
    
    return {
      success: true,
      stats: {
        totalContatos,
        contatosAtivos,
        totalCategorias,
        totalMensagens,
        filaPendente,
        enviadosHoje,
        enviadosSemana,
        taxaSucesso,
      }
    };
  } catch (error) {
    console.error('[Remarketing] Erro ao buscar stats:', error);
    return { success: false, error: 'Erro ao buscar estatisticas' };
  }
}

// ============================================================
// BUSCAR CONTATOS DA EVOLUTION API
// ============================================================

export async function fetchEvolutionContacts(instanceName: string): Promise<{ 
  success: boolean; 
  contacts?: Array<{
    remote_jid: string;
    telefone: string;
    nome: string | null;
    foto_url: string | null;
  }>;
  error?: string 
}> {
  try {
    const EVO_URL = process.env.EVOLUTION_URL || 'https://evo.wzapflow.com.br';
    const EVO_KEY = process.env.EVOLUTION_API_KEY || '';
    
    const response = await fetch(`${EVO_URL}/chat/findContacts/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVO_KEY,
      },
      body: JSON.stringify({}),
      cache: 'no-store',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Remarketing] Erro Evolution API:', errorData);
      return { success: false, error: 'Erro ao buscar contatos da Evolution API' };
    }
    
    const data = await response.json();
    
    // Transform contacts
    const contacts = (Array.isArray(data) ? data : []).map((contact: { id?: string; remoteJid?: string; pushName?: string; profilePictureUrl?: string }) => {
      const jid = contact.id || contact.remoteJid || '';
      const telefone = jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
      
      return {
        remote_jid: jid,
        telefone,
        nome: contact.pushName || null,
        foto_url: contact.profilePictureUrl || null,
      };
    }).filter((c: { remote_jid: string }) => c.remote_jid && !c.remote_jid.includes('@g.us')); // Exclude groups
    
    return { success: true, contacts };
  } catch (error) {
    console.error('[Remarketing] Erro ao buscar contatos Evolution:', error);
    return { success: false, error: 'Erro de conexao com Evolution API' };
  }
}

export async function fetchEvolutionChats(instanceName: string): Promise<{ 
  success: boolean; 
  chats?: Array<{
    remote_jid: string;
    telefone: string;
    nome: string | null;
    foto_url: string | null;
    ultima_mensagem: string | null;
  }>;
  error?: string 
}> {
  try {
    const EVO_URL = process.env.EVOLUTION_URL || 'https://evo.wzapflow.com.br';
    const EVO_KEY = process.env.EVOLUTION_API_KEY || '';
    
    const response = await fetch(`${EVO_URL}/chat/findChats/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVO_KEY,
      },
      body: JSON.stringify({}),
      cache: 'no-store',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Remarketing] Erro Evolution API:', errorData);
      return { success: false, error: 'Erro ao buscar chats da Evolution API' };
    }
    
    const data = await response.json();
    
    // Transform chats
    const chats = (Array.isArray(data) ? data : []).map((chat: { id?: string; remoteJid?: string; name?: string; pushName?: string; profilePictureUrl?: string; lastMessage?: { content?: string } }) => {
      const jid = chat.id || chat.remoteJid || '';
      const telefone = jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
      
      return {
        remote_jid: jid,
        telefone,
        nome: chat.name || chat.pushName || null,
        foto_url: chat.profilePictureUrl || null,
        ultima_mensagem: chat.lastMessage?.content || null,
      };
    }).filter((c: { remote_jid: string }) => c.remote_jid && !c.remote_jid.includes('@g.us')); // Exclude groups
    
    return { success: true, chats };
  } catch (error) {
    console.error('[Remarketing] Erro ao buscar chats Evolution:', error);
    return { success: false, error: 'Erro de conexao com Evolution API' };
  }
}
