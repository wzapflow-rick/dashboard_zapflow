/**
 * @file lib/nocodb.ts
 * @description Cliente centralizado para comunicação com a API do NocoDB.
 *
 * Este módulo substitui as múltiplas implementações de `nocoFetch` espalhadas
 * pelos arquivos de `app/actions/`. Todos os acessos ao banco de dados devem
 * passar por este cliente para garantir consistência, tratamento de erros
 * padronizado e facilidade de manutenção.
 *
 * @example
 * // Buscar registros
 * const pedidos = await noco.list(PEDIDOS_TABLE_ID, {
 *   where: `(empresa_id,eq,${empresaId})`,
 *   sort: '-id',
 *   limit: 100,
 * });
 *
 * // Criar registro
 * const novo = await noco.create(PEDIDOS_TABLE_ID, { status: 'pendente', ... });
 *
 * // Atualizar registro
 * await noco.update(PEDIDOS_TABLE_ID, { id: 42, status: 'finalizado' });
 *
 * // Deletar registro
 * await noco.delete(PEDIDOS_TABLE_ID, 42);
 */

// ============================================================
// TIPOS E INTERFACES
// ============================================================

/** Opções de consulta para listagem de registros */
export interface NocoListOptions {
  /** Filtro no formato NocoDB: `(campo,operador,valor)~and(campo2,operador2,valor2)` */
  where?: string;
  /** Campo de ordenação. Use `-campo` para descendente. Ex: `-id` ou `nome` */
  sort?: string;
  /** Número máximo de registros a retornar (padrão: 25, máximo: 1000) */
  limit?: number;
  /** Número de registros a pular (para paginação) */
  offset?: number;
  /** Campos a incluir na resposta, separados por vírgula */
  fields?: string;
}

/** Resposta paginada do NocoDB */
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

/** Erro customizado para falhas na API do NocoDB */
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
// CONFIGURAÇÃO
// ============================================================

function getConfig() {
  const url = process.env.NOCODB_URL;
  const token = process.env.NOCODB_TOKEN;

  if (!url) {
    throw new NocoDBError(
      'NOCODB_URL não está configurado nas variáveis de ambiente.',
    );
  }
  if (!token) {
    throw new NocoDBError(
      'NOCODB_TOKEN não está configurado nas variáveis de ambiente.',
    );
  }

  return { url, token };
}

// ============================================================
// FUNÇÃO BASE DE FETCH
// ============================================================

/**
 * Função base para todas as requisições ao NocoDB.
 * Gerencia headers, erros HTTP e parsing de JSON.
 */
async function nocoRequest<T = unknown>(
  tableId: string,
  endpoint: string,
  options: RequestInit = {},
  useCache: boolean = false,
): Promise<T> {
  const { url, token } = getConfig();

  const fullUrl = `${url}/api/v2/tables/${tableId}${endpoint}`;

  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      'xc-token': token,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    cache: useCache ? 'force-cache' : 'no-store',
    ...(useCache ? { next: { revalidate: 60 } } : {}),
  });

  if (!res.ok) {
    let errorBody = '';
    try {
      errorBody = await res.text();
    } catch {
      errorBody = 'Não foi possível ler o corpo do erro.';
    }

    const errorMessage = `NocoDB API Error [${tableId}] ${res.status}: ${errorBody}`;
    console.error('--- NOCODB ERROR LOG ---');
    console.error('Table ID:', tableId);
    console.error('Endpoint:', endpoint);
    console.error('Status:', res.status);
    console.error('Error Body:', errorBody);
    console.error('Payload Sent:', options.body);
    console.error('------------------------');

    throw new NocoDBError(errorMessage, res.status, tableId);
  }

  // DELETE retorna 200 com corpo vazio ou `{ msg: 'The record has been deleted successfully' }`
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json() as Promise<T>;
  }

  return {} as T;
}

// ============================================================
// MÉTODOS PÚBLICOS DO CLIENTE
// ============================================================

/**
 * Lista registros de uma tabela com suporte a filtros, ordenação e paginação.
 */
async function list<T = Record<string, unknown>>(
  tableId: string,
  options: NocoListOptions = {},
  useCache: boolean = false,
): Promise<NocoListResponse<T>> {
  const params = new URLSearchParams();

  if (options.where) params.set('where', options.where);
  if (options.sort) params.set('sort', options.sort);
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.offset !== undefined) params.set('offset', String(options.offset));
  if (options.fields) params.set('fields', options.fields);

  const query = params.toString() ? `?${params.toString()}` : '';

  return nocoRequest<NocoListResponse<T>>(
    tableId,
    `/records${query}`,
    {},
    useCache,
  );
}

/**
 * Busca um único registro pelo seu ID.
 * Retorna `null` se o registro não for encontrado (404).
 */
async function findById<T = Record<string, unknown>>(
  tableId: string,
  id: number | string,
): Promise<T | null> {
  try {
    return await nocoRequest<T>(tableId, `/records/${id}`);
  } catch (error) {
    if (error instanceof NocoDBError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Busca o primeiro registro que satisfaz os filtros fornecidos.
 * Retorna `null` se nenhum registro for encontrado.
 */
async function findOne<T = Record<string, unknown>>(
  tableId: string,
  options: NocoListOptions = {},
): Promise<T | null> {
  const result = await list<T>(tableId, { ...options, limit: 1 });
  return result.list[0] ?? null;
}

/**
 * Cria um novo registro na tabela.
 * Retorna o registro criado com seu ID.
 */
async function create<T = Record<string, unknown>>(
  tableId: string,
  data: Record<string, unknown>,
): Promise<T> {
  return nocoRequest<T>(tableId, '/records', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Atualiza um registro existente.
 * O objeto `data` deve conter o campo `id` do registro a ser atualizado.
 */
async function update<T = Record<string, unknown>>(
  tableId: string,
  data: Record<string, unknown> & { id: number | string },
): Promise<T> {
  return nocoRequest<T>(tableId, '/records', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Atualiza múltiplos registros em uma única requisição.
 * Cada objeto no array deve conter o campo `id`.
 */
async function updateMany<T = Record<string, unknown>>(
  tableId: string,
  records: Array<Record<string, unknown> & { id: number | string }>,
): Promise<T> {
  return nocoRequest<T>(tableId, '/records', {
    method: 'PATCH',
    body: JSON.stringify(records),
  });
}

/**
 * Remove um registro pelo seu ID.
 */
async function remove(
  tableId: string,
  id: number | string,
): Promise<void> {
  await nocoRequest(tableId, '/records', {
    method: 'DELETE',
    body: JSON.stringify([{ id }]),
  });
}

/**
 * Conta o total de registros em uma tabela, com filtros opcionais.
 */
async function count(
  tableId: string,
  where?: string,
): Promise<number> {
  const result = await list(tableId, { where, limit: 1 });
  return result.pageInfo.totalRows;
}

/**
 * Busca todos os registros de uma tabela, lidando automaticamente com paginação.
 * Use com cuidado em tabelas com muitos registros.
 */
async function listAll<T = Record<string, unknown>>(
  tableId: string,
  options: Omit<NocoListOptions, 'limit' | 'offset'> = {},
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const all: T[] = [];
  let offset = 0;

  while (true) {
    const result = await list<T>(tableId, {
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

// ============================================================
// EXPORTAÇÃO DO CLIENTE
// ============================================================

/**
 * Cliente centralizado do NocoDB.
 * Importe e use `noco` em todos os arquivos de `app/actions/`.
 *
 * @example
 * import { noco } from '@/lib/nocodb';
 * import { PEDIDOS_TABLE_ID } from '@/lib/constants';
 *
 * const pedidos = await noco.list(PEDIDOS_TABLE_ID, { where: '(status,eq,pendente)' });
 */
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
