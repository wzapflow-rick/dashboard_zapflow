/**
 * @file lib/postgres.ts
 * @description Cliente centralizado para comunicação direta com o PostgreSQL.
 *
 * Este módulo substitui o NocoDB, oferecendo a mesma interface de API
 * (list, findById, create, update, delete, etc.) mas usando SQL direto.
 *
 * @example
 * // Buscar registros
 * const pedidos = await pg.list(PEDIDOS_TABLE, {
 *   where: { empresa_id: empresaId },
 *   sort: '-id',
 *   limit: 100,
 * });
 *
 * // Criar registro
 * const novo = await pg.create(PEDIDOS_TABLE, { status: 'pendente', ... });
 *
 * // Atualizar registro
 * await pg.update(PEDIDOS_TABLE, 42, { status: 'finalizado' });
 *
 * // Deletar registro
 * await pg.delete(PEDIDOS_TABLE, 42);
 */

import { Pool, PoolClient } from 'pg';

// ============================================================
// TIPOS E INTERFACES
// ============================================================

/** Opções de consulta para listagem de registros */
export interface PgListOptions {
  /** Filtros no formato de objeto: { campo: valor } ou { campo: { op: 'like', value: '%teste%' } } */
  where?: Record<string, unknown>;
  /** Campo de ordenação. Use `-campo` para descendente. Ex: `-id` ou `nome` */
  sort?: string;
  /** Número máximo de registros a retornar (padrão: 25, máximo: 1000) */
  limit?: number;
  /** Número de registros a pular (para paginação) */
  offset?: number;
  /** Campos a incluir na resposta */
  fields?: string[];
}

/** Resposta paginada do PostgreSQL */
export interface PgListResponse<T = Record<string, unknown>> {
  list: T[];
  pageInfo: {
    totalRows: number;
    page: number;
    pageSize: number;
    isFirstPage: boolean;
    isLastPage: boolean;
  };
}

/** Operadores suportados para filtros */
export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is' | 'isNot';

/** Valor de filtro com operador */
export interface FilterValue {
  op: FilterOperator;
  value: unknown;
}

/** Erro customizado para falhas no PostgreSQL */
export class PostgresError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly table?: string,
  ) {
    super(message);
    this.name = 'PostgresError';
  }
}

// ============================================================
// CONFIGURAÇÃO DO POOL
// ============================================================

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      console.error('[PostgreSQL] DATABASE_URL não está configurado!');
      throw new PostgresError(
        'DATABASE_URL não está configurado nas variáveis de ambiente.'
      );
    }

    // Log sanitizado da conexão (sem senha)
    const sanitizedUrl = connectionString.replace(/:([^@]+)@/, ':****@');
    console.log('[PostgreSQL] Inicializando pool com:', sanitizedUrl);

    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: true,
    });

    pool.on('error', (err) => {
      console.error('[PostgreSQL Pool] Erro inesperado no cliente:', err);
    });

    pool.on('connect', () => {
      console.log('[PostgreSQL Pool] Nova conexão estabelecida');
    });
  }

  return pool;
}

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

/**
 * Converte filtro NocoDB para SQL WHERE clause
 * Formato NocoDB: "(campo,operador,valor)~and(campo2,operador2,valor2)"
 */
export function parseNocoDBFilter(filter: string): { clause: string; params: unknown[] } {
  const params: unknown[] = [];
  let paramIndex = 1;
  
  // Regex para capturar: (campo,operador,valor)
  const filterRegex = /\(([^,]+),([^,]+),([^)]*)\)/g;
  
  const conditions: string[] = [];
  let match;
  
  while ((match = filterRegex.exec(filter)) !== null) {
    const [, field, operator, value] = match;
    
    const sqlOperator = mapOperator(operator);
    
    if (operator === 'is' || operator === 'isNot') {
      if (value === 'null' || value === 'blank') {
        conditions.push(`"${field}" ${sqlOperator} NULL`);
      } else if (value === 'notNull' || value === 'notBlank') {
        conditions.push(`"${field}" IS NOT NULL`);
      }
    } else if (operator === 'in') {
      const values = value.split(',').map(v => v.trim());
      const placeholders = values.map(() => `$${paramIndex++}`).join(', ');
      conditions.push(`"${field}" IN (${placeholders})`);
      params.push(...values);
    } else if (operator === 'like' || operator === 'ilike') {
      conditions.push(`"${field}" ${sqlOperator} $${paramIndex++}`);
      params.push(`%${value}%`);
    } else {
      conditions.push(`"${field}" ${sqlOperator} $${paramIndex++}`);
      params.push(parseValue(value));
    }
  }
  
  // Detectar operador lógico (~and ou ~or)
  const logicalOp = filter.includes('~or') ? ' OR ' : ' AND ';
  
  return {
    clause: conditions.length > 0 ? conditions.join(logicalOp) : '1=1',
    params,
  };
}

/**
 * Converte objeto de filtro para SQL WHERE clause
 */
function buildWhereClause(where: Record<string, unknown>): { clause: string; params: unknown[] } {
  const params: unknown[] = [];
  const conditions: string[] = [];
  let paramIndex = 1;

  for (const [field, value] of Object.entries(where)) {
    if (value === undefined) continue;
    
    if (value === null) {
      conditions.push(`"${field}" IS NULL`);
    } else if (typeof value === 'object' && value !== null && 'op' in value) {
      const filterValue = value as FilterValue;
      const sqlOp = mapOperator(filterValue.op);
      
      if (filterValue.op === 'is') {
        conditions.push(`"${field}" IS NULL`);
      } else if (filterValue.op === 'isNot') {
        conditions.push(`"${field}" IS NOT NULL`);
      } else if (filterValue.op === 'in' && Array.isArray(filterValue.value)) {
        const placeholders = filterValue.value.map(() => `$${paramIndex++}`).join(', ');
        conditions.push(`"${field}" IN (${placeholders})`);
        params.push(...filterValue.value);
      } else if (filterValue.op === 'like' || filterValue.op === 'ilike') {
        conditions.push(`"${field}" ${sqlOp} $${paramIndex++}`);
        params.push(`%${filterValue.value}%`);
      } else {
        conditions.push(`"${field}" ${sqlOp} $${paramIndex++}`);
        params.push(filterValue.value);
      }
    } else {
      conditions.push(`"${field}" = $${paramIndex++}`);
      params.push(value);
    }
  }

  return {
    clause: conditions.length > 0 ? conditions.join(' AND ') : '1=1',
    params,
  };
}

/**
 * Mapeia operadores NocoDB para SQL
 */
function mapOperator(op: string): string {
  const operators: Record<string, string> = {
    'eq': '=',
    'neq': '!=',
    'gt': '>',
    'gte': '>=',
    'lt': '<',
    'lte': '<=',
    'like': 'LIKE',
    'ilike': 'ILIKE',
    'in': 'IN',
    'is': 'IS',
    'isNot': 'IS NOT',
  };
  return operators[op] || '=';
}

/**
 * Parse de valores string para tipos corretos
 */
function parseValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (!isNaN(Number(value)) && value !== '') return Number(value);
  return value;
}

/**
 * Constrói a cláusula ORDER BY
 */
function buildOrderBy(sort?: string): string {
  if (!sort) return '';
  
  const parts = sort.split(',').map(s => {
    s = s.trim();
    if (s.startsWith('-')) {
      return `"${s.substring(1)}" DESC`;
    }
    return `"${s}" ASC`;
  });
  
  return `ORDER BY ${parts.join(', ')}`;
}

/**
 * Executa query com retry
 */
async function executeQuery<T>(
  text: string,
  params: unknown[] = [],
  retries = 2
): Promise<T[]> {
  const pool = getPool();
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await pool.query(text, params);
      return result.rows as T[];
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      console.error(`[PostgreSQL] Query falhou (tentativa ${attempt}/${retries}):`, err.message);
      
      if (attempt < retries && (
        err.code === 'ECONNREFUSED' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ENOTFOUND' ||
        err.message?.includes('Connection terminated') ||
        err.message?.includes('timeout')
      )) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      
      throw new PostgresError(
        `Query falhou: ${err.message}`,
        err.code,
      );
    }
  }
  
  return [];
}

// ============================================================
// MÉTODOS PÚBLICOS DO CLIENTE
// ============================================================

/**
 * Lista registros de uma tabela com suporte a filtros, ordenação e paginação.
 * Suporta filtros no formato NocoDB (string) ou objeto.
 */
async function list<T = Record<string, unknown>>(
  table: string,
  options: PgListOptions & { where?: string | Record<string, unknown> } = {},
): Promise<PgListResponse<T>> {
  const limit = Math.min(options.limit ?? 25, 1000);
  const offset = options.offset ?? 0;
  
  let whereClause: string;
  let whereParams: unknown[];
  
  // Suporta tanto string (formato NocoDB) quanto objeto
  if (typeof options.where === 'string') {
    const parsed = parseNocoDBFilter(options.where);
    whereClause = parsed.clause;
    whereParams = parsed.params;
  } else if (options.where) {
    const parsed = buildWhereClause(options.where);
    whereClause = parsed.clause;
    whereParams = parsed.params;
  } else {
    whereClause = '1=1';
    whereParams = [];
  }
  
  const fields = options.fields?.map(f => `"${f}"`).join(', ') || '*';
  const orderBy = buildOrderBy(options.sort);
  
  // Query para contar total
  const countQuery = `SELECT COUNT(*) as total FROM "${table}" WHERE ${whereClause}`;
  const countResult = await executeQuery<{ total: string }>(countQuery, whereParams);
  const totalRows = parseInt(countResult[0]?.total || '0', 10);
  
  // Query principal
  const nextParamIndex = whereParams.length + 1;
  const query = `
    SELECT ${fields} 
    FROM "${table}" 
    WHERE ${whereClause} 
    ${orderBy} 
    LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}
  `;
  
  const rows = await executeQuery<T>(query, [...whereParams, limit, offset]);
  
  const page = Math.floor(offset / limit) + 1;
  
  return {
    list: rows,
    pageInfo: {
      totalRows,
      page,
      pageSize: limit,
      isFirstPage: offset === 0,
      isLastPage: offset + rows.length >= totalRows,
    },
  };
}

/**
 * Busca um único registro pelo seu ID.
 * Retorna `null` se o registro não for encontrado.
 */
async function findById<T = Record<string, unknown>>(
  table: string,
  id: number | string,
): Promise<T | null> {
  const query = `SELECT * FROM "${table}" WHERE id = $1 LIMIT 1`;
  const rows = await executeQuery<T>(query, [id]);
  return rows[0] ?? null;
}

/**
 * Busca o primeiro registro que satisfaz os filtros fornecidos.
 * Retorna `null` se nenhum registro for encontrado.
 */
async function findOne<T = Record<string, unknown>>(
  table: string,
  options: PgListOptions & { where?: string | Record<string, unknown> } = {},
): Promise<T | null> {
  const result = await list<T>(table, { ...options, limit: 1 });
  return result.list[0] ?? null;
}

/**
 * Cria um novo registro na tabela.
 * Retorna o registro criado com seu ID.
 */
async function create<T = Record<string, unknown>>(
  table: string,
  data: Record<string, unknown>,
): Promise<T> {
  const fields = Object.keys(data);
  const values = Object.values(data);
  
  if (fields.length === 0) {
    throw new PostgresError('Dados para criação não podem estar vazios', undefined, table);
  }
  
  const columns = fields.map(f => `"${f}"`).join(', ');
  const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
  
  const query = `
    INSERT INTO "${table}" (${columns}) 
    VALUES (${placeholders}) 
    RETURNING *
  `;
  
  const rows = await executeQuery<T>(query, values);
  return rows[0];
}

/**
 * Atualiza um registro existente.
 * Aceita dois formatos:
 * - update(table, { id, ...data }) - objeto com id incluído
 * - update(table, id, data) - id separado do objeto de dados
 */
async function update<T = Record<string, unknown>>(
  table: string,
  dataOrId: Record<string, unknown> & { id?: number | string } | number | string,
  maybeData?: Record<string, unknown>,
): Promise<T> {
  let id: number | string;
  let updateData: Record<string, unknown>;
  
  // Suporta ambos os formatos: update(table, {id, ...data}) e update(table, id, data)
  if (maybeData !== undefined) {
    // Formato: update(table, id, data)
    id = dataOrId as number | string;
    updateData = maybeData;
  } else {
    // Formato: update(table, { id, ...data })
    const { id: extractedId, ...rest } = dataOrId as Record<string, unknown> & { id: number | string };
    id = extractedId;
    updateData = rest;
  }
  
  const fields = Object.keys(updateData);
  const values = Object.values(updateData);
  
  if (fields.length === 0) {
    throw new PostgresError('Dados para atualização não podem estar vazios', undefined, table);
  }
  
  const setClause = fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ');
  
  const query = `
    UPDATE "${table}" 
    SET ${setClause} 
    WHERE id = $${fields.length + 1} 
    RETURNING *
  `;
  
  const rows = await executeQuery<T>(query, [...values, id]);
  return rows[0];
}

/**
 * Atualiza múltiplos registros em uma única transação.
 * Cada objeto no array deve conter o campo `id`.
 */
async function updateMany<T = Record<string, unknown>>(
  table: string,
  records: Array<Record<string, unknown> & { id: number | string }>,
): Promise<T[]> {
  if (records.length === 0) return [];
  
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const results: T[] = [];
    
    for (const record of records) {
      const { id, ...updateData } = record;
      const fields = Object.keys(updateData);
      const values = Object.values(updateData);
      
      if (fields.length === 0) continue;
      
      const setClause = fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ');
      const query = `
        UPDATE "${table}" 
        SET ${setClause} 
        WHERE id = $${fields.length + 1} 
        RETURNING *
      `;
      
      const result = await client.query(query, [...values, id]);
      if (result.rows[0]) {
        results.push(result.rows[0] as T);
      }
    }
    
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Remove um registro pelo seu ID.
 */
async function remove(
  table: string,
  id: number | string,
): Promise<void> {
  const query = `DELETE FROM "${table}" WHERE id = $1`;
  await executeQuery(query, [id]);
}

/**
 * Conta o total de registros em uma tabela, com filtros opcionais.
 */
async function count(
  table: string,
  where?: string | Record<string, unknown>,
): Promise<number> {
  let whereClause: string;
  let whereParams: unknown[];
  
  if (typeof where === 'string') {
    const parsed = parseNocoDBFilter(where);
    whereClause = parsed.clause;
    whereParams = parsed.params;
  } else if (where) {
    const parsed = buildWhereClause(where);
    whereClause = parsed.clause;
    whereParams = parsed.params;
  } else {
    whereClause = '1=1';
    whereParams = [];
  }
  
  const query = `SELECT COUNT(*) as total FROM "${table}" WHERE ${whereClause}`;
  const rows = await executeQuery<{ total: string }>(query, whereParams);
  return parseInt(rows[0]?.total || '0', 10);
}

/**
 * Busca todos os registros de uma tabela, lidando automaticamente com paginação.
 * Use com cuidado em tabelas com muitos registros.
 */
async function listAll<T = Record<string, unknown>>(
  table: string,
  options: Omit<PgListOptions, 'limit' | 'offset'> & { where?: string | Record<string, unknown> } = {},
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const all: T[] = [];
  let offset = 0;

  while (true) {
    const result = await list<T>(table, {
      ...options,
      limit: PAGE_SIZE,
      offset,
    });

    all.push(...result.list);

    if (result.pageInfo.isLastPage) break;
    offset += PAGE_SIZE;
  }

  return all;
}

/**
 * Executa uma query SQL raw.
 * Use com cuidado e sempre parametrize valores.
 */
async function raw<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = [],
): Promise<T[]> {
  return executeQuery<T>(query, params);
}

/**
 * Executa uma query SQL e retorna resultado no formato compatível com pg (com .rows).
 * Compatível com código que espera result.rows
 */
async function query<T = Record<string, unknown>>(
  queryStr: string,
  params: unknown[] = [],
): Promise<{ rows: T[] }> {
  const rows = await executeQuery<T>(queryStr, params);
  return { rows };
}

/**
 * Obtém um cliente do pool para transações manuais.
 */
async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

// ============================================================
// EXPORTAÇÃO DO CLIENTE
// ============================================================

/**
 * Cliente centralizado do PostgreSQL.
 * Importe e use `pg` em todos os arquivos de `app/actions/`.
 *
 * @example
 * import { pg } from '@/lib/postgres';
 * import { PEDIDOS_TABLE } from '@/lib/tables';
 *
 * const pedidos = await pg.list(PEDIDOS_TABLE, { where: { status: 'pendente' } });
 * 
 * // Ou usando filtro formato NocoDB (para compatibilidade):
 * const pedidos = await pg.list(PEDIDOS_TABLE, { where: '(status,eq,pendente)' });
 */
export const pg = {
  list,
  findById,
  findOne,
  create,
  update,
  updateMany,
  delete: remove,
  count,
  listAll,
  raw,
  query,
  getClient,
} as const;

export default pg;
