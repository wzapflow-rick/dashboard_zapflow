import type { PoolClient } from 'pg';
import { pg } from '@/lib/postgres';
import { PRODUCT_MEDIA_ASSETS_TABLE } from '@/lib/tables';
import {
  MEDIA_LIBRARY_LIMIT,
  isMediaCategory,
  type MediaAsset,
  type MediaCategory,
} from '@/lib/media-library';

export const MEDIA_LIBRARY_SETUP_ERROR =
  'O acervo de mídias está indisponível. Verifique o banco e aplique a migração pendente.';

export interface NewMediaAsset {
  empresaId: number | string;
  name: string;
  url: string;
  category: MediaCategory;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
}

export function serializeMediaAsset(row: Record<string, unknown>): MediaAsset {
  return {
    id: Number(row.id),
    empresaId: row.empresa_id as number | string,
    name: String(row.nome ?? ''),
    url: String(row.url ?? ''),
    category: (isMediaCategory(row.categoria) ? row.categoria : 'other') as MediaCategory,
    mimeType: String(row.mime_type ?? 'image/jpeg'),
    sizeBytes: Number(row.tamanho_bytes ?? 0),
    width: row.largura == null ? null : Number(row.largura),
    height: row.altura == null ? null : Number(row.altura),
    createdAt: new Date(String(row.criado_em)).toISOString(),
    updatedAt: new Date(String(row.atualizado_em ?? row.criado_em)).toISOString(),
  };
}

export async function isMediaLibrarySchemaReady(): Promise<boolean> {
  try {
    const rows = await pg.raw<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1
       ) AS "exists"`,
      [PRODUCT_MEDIA_ASSETS_TABLE],
    );

    return rows[0]?.exists === true;
  } catch (error) {
    console.error('[MEDIA_LIBRARY] Não foi possível verificar o schema:', error);
    return false;
  }
}

export async function requireMediaLibrarySchema(): Promise<void> {
  if (!(await isMediaLibrarySchemaReady())) throw new Error(MEDIA_LIBRARY_SETUP_ERROR);
}

export async function countMediaAssets(empresaId: number | string): Promise<number> {
  const rows = await pg.raw<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM "${PRODUCT_MEDIA_ASSETS_TABLE}"
     WHERE empresa_id = $1`,
    [empresaId],
  );
  return Number(rows[0]?.total ?? 0);
}

async function rollbackQuietly(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // A conexão já pode ter encerrado; o erro original continua sendo o relevante.
  }
}

export async function insertMediaAssetWithQuota(
  input: NewMediaAsset,
): Promise<{ asset: MediaAsset; created: boolean } | null> {
  const client = await pg.getClient();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [
      `media-library:${input.empresaId}`,
    ]);

    const existing = await client.query(
      `SELECT * FROM "${PRODUCT_MEDIA_ASSETS_TABLE}"
       WHERE empresa_id = $1 AND url = $2
       LIMIT 1`,
      [input.empresaId, input.url],
    );

    if (existing.rows[0]) {
      await client.query('COMMIT');
      return { asset: serializeMediaAsset(existing.rows[0]), created: false };
    }

    const usage = await client.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM "${PRODUCT_MEDIA_ASSETS_TABLE}"
       WHERE empresa_id = $1`,
      [input.empresaId],
    );

    if (Number(usage.rows[0]?.total ?? 0) >= MEDIA_LIBRARY_LIMIT) {
      await client.query('ROLLBACK');
      return null;
    }

    const inserted = await client.query(
      `INSERT INTO "${PRODUCT_MEDIA_ASSETS_TABLE}"
        (empresa_id, nome, url, categoria, mime_type, tamanho_bytes, largura, altura)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.empresaId,
        input.name,
        input.url,
        input.category,
        input.mimeType,
        input.sizeBytes,
        input.width,
        input.height,
      ],
    );

    await client.query('COMMIT');
    return { asset: serializeMediaAsset(inserted.rows[0]), created: true };
  } catch (error) {
    await rollbackQuietly(client);
    throw error;
  } finally {
    client.release();
  }
}
