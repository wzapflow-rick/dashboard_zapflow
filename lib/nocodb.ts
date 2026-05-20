/**
 * @file lib/nocodb.ts
 * @description Cliente PostgreSQL que mantém compatibilidade com a interface NocoDB.
 * Todos os acessos passam por aqui para facilitar a migração.
 * 
 * MIGRADO PARA POSTGRESQL - O nome do arquivo foi mantido para compatibilidade.
 */

import db from './db';

// ============================================================
// MAPEAMENTO DE TABLE_ID PARA NOMES DE TABELA
// ============================================================

const TABLE_MAP: Record<string, string> = {
  // Principais
  'mp08yd7oaxn5xo2': 'empresas',
  'msrjfeb28e07cwx': 'usuarios',
  'mui7bozvx9zb2n9': 'pedidos',
  'mkodxks6hpm2bg9': 'clientes',
  // Cardapio
  'mh81t2xp1uml6pc': 'produtos',
  'mo5so5g7gvlbwyo': 'categorias',
  'm3o1prjcnvi678q': 'grupos_complementos',
  'mj3ut032mx8zi72': 'complementos',
  'm6muivyaadyh38c': 'produto_grupos_complementos',
  'm1h9jeye8hcd4k6': 'grupos_slots',
  'mfcp67skbxq4nt5': 'itens_base',
  // Estoque
  'mvis2y8mlpwqr9q': 'insumos',
  'mev9fkmt1jaapiv': 'produto_insumos',
  // Entregadores
  'm4hbqkhwu2qvrry': 'entregadores',
  'me4x6mmfsbndf42': 'comissoes_entregadores',
  'm9lt0hyfnh3c47q': 'historico_entregas',
  // Fidelidade
  'mjzzdfgdohupgjh': 'loyalty_config',
  'm8slxvm3dp4sup4': 'loyalty_points',
  'm5echqy6luac5g6': 'cupons',
  // Configuracoes
  'm9yccghg9s23utv': 'taxas_entrega',
  'mpaclmaji3b6dla': 'horarios',
  'mlev3jx4tj2x74d': 'pagamentos_config',
  'm3ebs9cm1yjgmo1': 'avaliacoes',
  'mtkx66k8jacnezx': 'configuracoes_loja',
  // Metadados
  'm97yi797b432f4q': 'produtos_metadados',
  // Assinaturas
  'm1hq56kbk1zhcrp': 'pending_signups',
  'mhpkvk982298q8a': 'assinaturas',
  // Mesas
  'mzft45xyoznab9k': 'mesas',
  'mkpep3jg6ri9d7x': 'comandas',
  // Campanhas
  'campanhas_config': 'campanhas_config',
  'campanhas_disparos': 'campanhas_disparos',
  // Outros
  'item_base_insumo': 'item_base_insumo',
  'cliente_enderecos': 'cliente_enderecos',
  'configuracoes_entrega': 'configuracoes_entrega',
  'acertos_entregadores': 'acertos_entregadores',
  'faturas_assinatura': 'faturas_assinatura',
  'cupons_plataforma': 'cupons_plataforma',
  'bot_config': 'bot_config',
  'loyalty_history': 'loyalty_history',
  'rate_limit_attempts': 'rate_limit_attempts',
};

function getTableName(tableId: string): string {
  // Se ja for um nome de tabela valido, retorna direto
  if (TABLE_MAP[tableId]) {
    return TABLE_MAP[tableId];
  }
  // Se nao estiver no mapa, assume que ja e o nome da tabela
  return tableId;
}

// ============================================================
// TIPOS E INTERFACES
// ============================================================

export interface NocoListOptions {
  where?: string;
  sort?: string;
  limit?: number;
  offset?: number;
  fields?: string;
}

export interface NocoListResponse<T = Record<string, unknown>> {
  list: T[];
  pageInfo: {
    totalRows: number;
    page: number;
    pageSize: number;
    isFirstPage: boolean;
    isLastPage: boolean;
  };
}

export class NocoDBError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly tableId?: string,
  ) {
    super(message);
    this.name = 'NocoDBError';
  }
}

// ============================================================
// PARSER DE WHERE NOCODB -> SQL
// ============================================================

function parseNocoWhere(where: string): { clause: string; values: any[] } {
  if (!where) return { clause: '', values: [] };
  
  const conditions: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  // Suporta formatos:
  // (campo,eq,valor)
  // (campo,eq,valor)~and(campo2,eq,valor2)
  // (campo,eq,valor)~or(campo2,eq,valor2)
  
  // Separar por ~and e ~or
  const parts = where.split(/~(and|or)/);
  const operators: string[] = [];
  const expressions: string[] = [];
  
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === 'and' || parts[i] === 'or') {
      operators.push(parts[i].toUpperCase());
    } else if (parts[i]) {
      expressions.push(parts[i]);
    }
  }
  
  for (const expr of expressions) {
    // Parse (campo,operador,valor)
    const match = expr.match(/\(([^,]+),([^,]+),(.+)\)/);
    if (!match) continue;
    
    const [, field, op, rawValue] = match;
    const value = rawValue.trim();
    
    let sqlOp = '=';
    let sqlValue: any = value;
    
    switch (op) {
      case 'eq':
        sqlOp = '=';
        break;
      case 'neq':
        sqlOp = '!=';
        break;
      case 'gt':
        sqlOp = '>';
        break;
      case 'gte':
        sqlOp = '>=';
        break;
      case 'lt':
        sqlOp = '<';
        break;
      case 'lte':
        sqlOp = '<=';
        break;
      case 'like':
        sqlOp = 'ILIKE';
        sqlValue = `%${value}%`;
        break;
      case 'is':
        if (value === 'null') {
          conditions.push(`${field} IS NULL`);
          continue;
        }
        break;
      case 'isnot':
        if (value === 'null') {
          conditions.push(`${field} IS NOT NULL`);
          continue;
        }
        break;
      case 'in':
        const inValues = value.split(',').map(v => v.trim());
        const placeholders = inValues.map(() => `$${paramIndex++}`).join(', ');
        conditions.push(`${field} IN (${placeholders})`);
        values.push(...inValues);
        continue;
    }
    
    conditions.push(`${field} ${sqlOp} $${paramIndex}`);
    values.push(sqlValue);
    paramIndex++;
  }
  
  if (conditions.length === 0) return { clause: '', values: [] };
  
  // Juntar condicoes com AND/OR
  let finalClause = conditions[0];
  for (let i = 1; i < conditions.length; i++) {
    const op = operators[i - 1] || 'AND';
    finalClause = `(${finalClause}) ${op} (${conditions[i]})`;
  }
  
  return { clause: `WHERE ${finalClause}`, values };
}

function buildSortClause(sort?: string): string {
  if (!sort) return 'ORDER BY id DESC';
  
  if (sort.startsWith('-')) {
    return `ORDER BY ${sort.slice(1)} DESC`;
  }
  return `ORDER BY ${sort} ASC`;
}

// ============================================================
// METODOS DO CLIENTE
// ============================================================

async function list<T = Record<string, unknown>>(
  tableId: string,
  options: NocoListOptions = {},
  useCache: boolean = false,
): Promise<NocoListResponse<T>> {
  const table = getTableName(tableId);
  const { where, sort, limit = 25, offset = 0 } = options;
  
  const { clause: whereClause, values } = parseNocoWhere(where || '');
  const sortClause = buildSortClause(sort);
  
  try {
    // Query para contar total
    const countQuery = `SELECT COUNT(*) as total FROM ${table} ${whereClause}`;
    const countResult = await db.query(countQuery, values);
    const totalRows = parseInt(countResult.rows[0]?.total || '0', 10);
    
    // Query principal
    const query = `
      SELECT * FROM ${table} 
      ${whereClause} 
      ${sortClause} 
      LIMIT $${values.length + 1} 
      OFFSET $${values.length + 2}
    `;
    
    const result = await db.query(query, [...values, limit, offset]);
    
    const page = Math.floor(offset / limit) + 1;
    const pageSize = limit;
    
    return {
      list: result.rows as T[],
      pageInfo: {
        totalRows,
        page,
        pageSize,
        isFirstPage: page === 1,
        isLastPage: offset + result.rows.length >= totalRows,
      },
    };
  } catch (error: any) {
    console.error(`[PostgreSQL] Erro em list(${table}):`, error.message);
    throw new NocoDBError(error.message, 500, tableId);
  }
}

async function findById<T = Record<string, unknown>>(
  tableId: string,
  id: number | string,
): Promise<T | null> {
  const table = getTableName(tableId);
  
  try {
    const query = `SELECT * FROM ${table} WHERE id = $1`;
    const result = await db.query(query, [id]);
    return result.rows[0] as T || null;
  } catch (error: any) {
    console.error(`[PostgreSQL] Erro em findById(${table}, ${id}):`, error.message);
    return null;
  }
}

async function findOne<T = Record<string, unknown>>(
  tableId: string,
  options: NocoListOptions = {},
): Promise<T | null> {
  const result = await list<T>(tableId, { ...options, limit: 1 });
  return result.list[0] ?? null;
}

async function create<T = Record<string, unknown>>(
  tableId: string,
  data: Record<string, unknown>,
): Promise<T> {
  const table = getTableName(tableId);
  
  // Filtrar campos undefined
  const filteredData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      filteredData[key] = value;
    }
  }
  
  const keys = Object.keys(filteredData);
  const values = Object.values(filteredData);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  
  try {
    const query = `
      INSERT INTO ${table} (${keys.join(', ')}) 
      VALUES (${placeholders}) 
      RETURNING *
    `;
    
    const result = await db.query(query, values);
    return result.rows[0] as T;
  } catch (error: any) {
    console.error(`[PostgreSQL] Erro em create(${table}):`, error.message);
    throw new NocoDBError(error.message, 500, tableId);
  }
}

async function update<T = Record<string, unknown>>(
  tableId: string,
  data: Record<string, unknown> & { id: number | string },
): Promise<T> {
  const table = getTableName(tableId);
  const { id, ...updateData } = data;
  
  // Filtrar campos undefined
  const filteredData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updateData)) {
    if (value !== undefined) {
      filteredData[key] = value;
    }
  }
  
  const keys = Object.keys(filteredData);
  const values = Object.values(filteredData);
  
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
  
  try {
    const query = `
      UPDATE ${table} 
      SET ${setClause}${keys.length > 0 ? ', ' : ''}updated_at = NOW() 
      WHERE id = $${keys.length + 1} 
      RETURNING *
    `;
    
    const result = await db.query(query, [...values, id]);
    return result.rows[0] as T;
  } catch (error: any) {
    // Se updated_at nao existe, tenta sem
    if (error.message.includes('updated_at')) {
      const query = `
        UPDATE ${table} 
        SET ${setClause} 
        WHERE id = $${keys.length + 1} 
        RETURNING *
      `;
      const result = await db.query(query, [...values, id]);
      return result.rows[0] as T;
    }
    console.error(`[PostgreSQL] Erro em update(${table}):`, error.message);
    throw new NocoDBError(error.message, 500, tableId);
  }
}

async function updateMany<T = Record<string, unknown>>(
  tableId: string,
  records: Array<Record<string, unknown> & { id: number | string }>,
): Promise<T> {
  const results: any[] = [];
  for (const record of records) {
    const updated = await update(tableId, record);
    results.push(updated);
  }
  return results as unknown as T;
}

async function remove(
  tableId: string,
  id: number | string,
): Promise<void> {
  const table = getTableName(tableId);
  
  try {
    const query = `DELETE FROM ${table} WHERE id = $1`;
    await db.query(query, [id]);
  } catch (error: any) {
    console.error(`[PostgreSQL] Erro em delete(${table}, ${id}):`, error.message);
    throw new NocoDBError(error.message, 500, tableId);
  }
}

async function count(
  tableId: string,
  where?: string,
): Promise<number> {
  const result = await list(tableId, { where, limit: 1 });
  return result.pageInfo.totalRows;
}

async function listAll<T = Record<string, unknown>>(
  tableId: string,
  options: Omit<NocoListOptions, 'limit' | 'offset'> = {},
): Promise<T[]> {
  const result = await list<T>(tableId, { ...options, limit: 10000, offset: 0 });
  return result.list;
}

// ============================================================
// EXPORTACAO DO CLIENTE
// ============================================================

export const noco = {
  list,
  findById,
  findOne,
  create,
  update,
  updateMany,
  delete: remove,
  count,
  listAll,
} as const;

export default noco;
