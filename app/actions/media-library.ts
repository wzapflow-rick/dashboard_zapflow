'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session-server';
import { pg } from '@/lib/postgres';
import { PRODUCT_MEDIA_ASSETS_TABLE } from '@/lib/tables';
import {
  isMediaCategory,
  sanitizeMediaName,
  type MediaAsset,
  type MediaCategory,
} from '@/lib/media-library';
import {
  isMediaLibrarySchemaReady,
  requireMediaLibrarySchema,
  serializeMediaAsset,
} from '@/lib/media-library-server';
import {
  deleteStoredCloudinaryMedia,
  isCloudinaryMediaConfigured,
} from '@/lib/cloudinary-media';

export async function getMediaLibrary(): Promise<{
  assets: MediaAsset[];
  total: number;
  setupRequired: boolean;
  uploadConfigured: boolean;
}> {
  const user = await requireAdmin();
  const uploadConfigured = isCloudinaryMediaConfigured();
  const schemaReady = await isMediaLibrarySchemaReady();

  if (!schemaReady) {
    return { assets: [], total: 0, setupRequired: true, uploadConfigured };
  }

  try {
    const [rows, totals] = await Promise.all([
      pg.raw(
        `SELECT * FROM "${PRODUCT_MEDIA_ASSETS_TABLE}"
         WHERE empresa_id = $1
         ORDER BY criado_em DESC, id DESC
         LIMIT $2`,
        [user.empresaId, 250],
      ),
      pg.raw<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM "${PRODUCT_MEDIA_ASSETS_TABLE}"
         WHERE empresa_id = $1`,
        [user.empresaId],
      ),
    ]);

    return {
      assets: rows.map(serializeMediaAsset),
      total: Number(totals[0]?.total ?? 0),
      setupRequired: false,
      uploadConfigured,
    };
  } catch (error) {
    console.error('[MEDIA_LIBRARY] Não foi possível carregar o acervo:', error);
    return { assets: [], total: 0, setupRequired: true, uploadConfigured };
  }
}

export async function updateMediaAsset(input: {
  id: number;
  name?: string;
  category?: MediaCategory;
}): Promise<MediaAsset> {
  const user = await requireAdmin();
  await requireMediaLibrarySchema();

  if (!Number.isInteger(input.id) || input.id <= 0) throw new Error('Mídia inválida.');

  const updates: string[] = [];
  const values: unknown[] = [input.id, user.empresaId];

  if (input.name !== undefined) {
    const name = sanitizeMediaName(input.name);
    if (!name) throw new Error('O nome da mídia não pode ficar vazio.');
    values.push(name);
    updates.push(`nome = $${values.length}`);
  }

  if (input.category !== undefined) {
    if (!isMediaCategory(input.category)) throw new Error('Categoria inválida.');
    values.push(input.category);
    updates.push(`categoria = $${values.length}`);
  }

  if (updates.length === 0) throw new Error('Nenhuma alteração informada.');
  updates.push('atualizado_em = NOW()');

  const rows = await pg.raw(
    `UPDATE "${PRODUCT_MEDIA_ASSETS_TABLE}"
     SET ${updates.join(', ')}
     WHERE id = $1 AND empresa_id = $2
     RETURNING *`,
    values,
  );

  if (!rows[0]) throw new Error('Mídia não encontrada.');

  revalidatePath('/dashboard/media-library');
  return serializeMediaAsset(rows[0]);
}

export async function deleteMediaAsset(id: number): Promise<{ id: number }> {
  const user = await requireAdmin();
  await requireMediaLibrarySchema();

  if (!Number.isInteger(id) || id <= 0) throw new Error('Mídia inválida.');

  const stored = await pg.raw<{ id: number; url: string; mime_type: string }>(
    `SELECT id, url, mime_type FROM "${PRODUCT_MEDIA_ASSETS_TABLE}"
     WHERE id = $1 AND empresa_id = $2
     LIMIT 1`,
    [id, user.empresaId],
  );
  if (!stored[0]) throw new Error('Mídia não encontrada.');

  await deleteStoredCloudinaryMedia({
    url: String(stored[0].url),
    mimeType: String(stored[0].mime_type),
  });

  const rows = await pg.raw<{ id: number }>(
    `DELETE FROM "${PRODUCT_MEDIA_ASSETS_TABLE}"
     WHERE id = $1 AND empresa_id = $2
     RETURNING id`,
    [id, user.empresaId],
  );

  if (!rows[0]) throw new Error('Mídia não encontrada.');

  revalidatePath('/dashboard/media-library');
  return { id: Number(rows[0].id) };
}
