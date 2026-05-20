/**
 * @file lib/postgres.ts
 * @description Cliente PostgreSQL que substitui o NocoDB.
 * Mantém interface similar ao noco para facilitar migração.
 */

import db from './db';

// ============================================================
// TIPOS E INTERFACES
// ============================================================

export interface QueryOptions {
  where?: Record<string, any>;
  sort?: string;
  limit?: number;
  offset?: number;
  fields?: string[];
}

export interface ListResponse<T = Record<string, any>> {
  list: T[];
  pageInfo: {
    totalRows: number;
    page: number;
    pageSize: number;
    isFirstPage: boolean;
    isLastPage: boolean;
  };
}

// ============================================================
// HELPERS
// ============================================================

function buildWhereClause(where: Record<string, any>): { clause: string; values: any[] } {
  const conditions: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(where)) {
    if (value === null) {
      conditions.push(`${key} IS NULL`);
    } else if (value === undefined) {
      continue;
    } else if (typeof value === 'object' && value.$or) {
      // Suporte para OR: { $or: [{ campo1: valor1 }, { campo2: valor2 }] }
      const orConditions: string[] = [];
      for (const orItem of value.$or) {
        for (const [orKey, orValue] of Object.entries(orItem)) {
          orConditions.push(`${orKey} = $${paramIndex}`);
          values.push(orValue);
          paramIndex++;
        }
      }
      conditions.push(`(${orConditions.join(' OR ')})`);
    } else if (typeof value === 'object' && value.$like) {
      conditions.push(`${key} ILIKE $${paramIndex}`);
      values.push(`%${value.$like}%`);
      paramIndex++;
    } else if (typeof value === 'object' && value.$gt) {
      conditions.push(`${key} > $${paramIndex}`);
      values.push(value.$gt);
      paramIndex++;
    } else if (typeof value === 'object' && value.$gte) {
      conditions.push(`${key} >= $${paramIndex}`);
      values.push(value.$gte);
      paramIndex++;
    } else if (typeof value === 'object' && value.$lt) {
      conditions.push(`${key} < $${paramIndex}`);
      values.push(value.$lt);
      paramIndex++;
    } else if (typeof value === 'object' && value.$lte) {
      conditions.push(`${key} <= $${paramIndex}`);
      values.push(value.$lte);
      paramIndex++;
    } else if (typeof value === 'object' && value.$ne) {
      conditions.push(`${key} != $${paramIndex}`);
      values.push(value.$ne);
      paramIndex++;
    } else if (typeof value === 'object' && value.$in) {
      const placeholders = value.$in.map((_: any, i: number) => `$${paramIndex + i}`).join(', ');
      conditions.push(`${key} IN (${placeholders})`);
      values.push(...value.$in);
      paramIndex += value.$in.length;
    } else {
      conditions.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
  };
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

async function list<T = Record<string, any>>(
  table: string,
  options: QueryOptions = {}
): Promise<ListResponse<T>> {
  const { where = {}, sort, limit = 25, offset = 0, fields } = options;
  
  const selectFields = fields?.length ? fields.join(', ') : '*';
  const { clause: whereClause, values } = buildWhereClause(where);
  const sortClause = buildSortClause(sort);
  
  // Query para contar total
  const countQuery = `SELECT COUNT(*) as total FROM ${table} ${whereClause}`;
  const countResult = await db.query(countQuery, values);
  const totalRows = parseInt(countResult.rows[0]?.total || '0', 10);
  
  // Query principal
  const query = `
    SELECT ${selectFields} 
    FROM ${table} 
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
}

async function findById<T = Record<string, any>>(
  table: string,
  id: number | string
): Promise<T | null> {
  const query = `SELECT * FROM ${table} WHERE id = $1`;
  const result = await db.query(query, [id]);
  return result.rows[0] as T || null;
}

async function findOne<T = Record<string, any>>(
  table: string,
  options: QueryOptions = {}
): Promise<T | null> {
  const result = await list<T>(table, { ...options, limit: 1 });
  return result.list[0] || null;
}

async function create<T = Record<string, any>>(
  table: string,
  data: Record<string, any>
): Promise<T> {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  
  const query = `
    INSERT INTO ${table} (${keys.join(', ')}) 
    VALUES (${placeholders}) 
    RETURNING *
  `;
  
  const result = await db.query(query, values);
  return result.rows[0] as T;
}

async function update<T = Record<string, any>>(
  table: string,
  data: Record<string, any> & { id: number | string }
): Promise<T> {
  const { id, ...updateData } = data;
  const keys = Object.keys(updateData);
  const values = Object.values(updateData);
  
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
  
  const query = `
    UPDATE ${table} 
    SET ${setClause}, updated_at = NOW() 
    WHERE id = $${keys.length + 1} 
    RETURNING *
  `;
  
  const result = await db.query(query, [...values, id]);
  return result.rows[0] as T;
}

async function updateMany<T = Record<string, any>>(
  table: string,
  records: Array<Record<string, any> & { id: number | string }>
): Promise<T[]> {
  const results: T[] = [];
  for (const record of records) {
    const updated = await update<T>(table, record);
    results.push(updated);
  }
  return results;
}

async function remove(
  table: string,
  id: number | string
): Promise<void> {
  const query = `DELETE FROM ${table} WHERE id = $1`;
  await db.query(query, [id]);
}

async function count(
  table: string,
  where: Record<string, any> = {}
): Promise<number> {
  const { clause: whereClause, values } = buildWhereClause(where);
  const query = `SELECT COUNT(*) as total FROM ${table} ${whereClause}`;
  const result = await db.query(query, values);
  return parseInt(result.rows[0]?.total || '0', 10);
}

async function listAll<T = Record<string, any>>(
  table: string,
  options: Omit<QueryOptions, 'limit' | 'offset'> = {}
): Promise<T[]> {
  const result = await list<T>(table, { ...options, limit: 10000, offset: 0 });
  return result.list;
}

// Query SQL direto (para casos complexos)
async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const result = await db.query(sql, params);
  return result.rows as T[];
}

// ============================================================
// EXPORTACAO DO CLIENTE
// ============================================================

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
  query,
} as const;

export default pg;
