'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session-server';
import { pg } from '@/lib/postgres';
import {
  CONFIGURACOES_LOJA_TABLE,
  PRODUCT_MEDIA_ASSETS_TABLE,
  PRODUTOS_TABLE,
} from '@/lib/tables';
import {
  formatMediaAssetUsage,
  isMediaCategory,
  sanitizeMediaName,
  type MediaAsset,
  type MediaCategory,
} from '@/lib/media-library';
import {
  isMediaLibrarySchemaReady,
  requireMediaLibrarySchema,
  serializeMediaAsset,
  serializeMediaAssetUsage,
} from '@/lib/media-library-server';
import {
  deleteStoredCloudinaryMedia,
  isCloudinaryMediaConfigured,
} from '@/lib/cloudinary-media';

const MEDIA_USAGE_SELECT = `
  (SELECT COUNT(*)::int
   FROM "${PRODUTOS_TABLE}" AS catalog_product
   WHERE catalog_product.empresa_id = media.empresa_id
     AND (catalog_product.imagem = media.url OR catalog_product.imagem_url = media.url)
  ) AS product_usage_count,
  EXISTS (
    SELECT 1
    FROM "${CONFIGURACOES_LOJA_TABLE}" AS store_config
    WHERE store_config.empresa_id = media.empresa_id AND store_config.logo = media.url
  ) AS used_as_logo,
  EXISTS (
    SELECT 1
    FROM "${CONFIGURACOES_LOJA_TABLE}" AS store_config
    WHERE store_config.empresa_id = media.empresa_id AND store_config.banner = media.url
  ) AS used_as_banner`;

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
        `SELECT media.*, ${MEDIA_USAGE_SELECT}
         FROM "${PRODUCT_MEDIA_ASSETS_TABLE}" AS media
         WHERE media.empresa_id = $1
         ORDER BY media.criado_em DESC, media.id DESC
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

  const stored = await pg.raw<Record<string, unknown>>(
    `SELECT media.id, media.url, media.mime_type, ${MEDIA_USAGE_SELECT}
     FROM "${PRODUCT_MEDIA_ASSETS_TABLE}" AS media
     WHERE media.id = $1 AND media.empresa_id = $2
     LIMIT 1`,
    [id, user.empresaId],
  );
  if (!stored[0]) throw new Error('Mídia não encontrada.');

  const usageSummary = formatMediaAssetUsage({
    usage: serializeMediaAssetUsage(stored[0]),
  });
  if (usageSummary) {
    throw new Error(
      `Esta mídia possui vínculos ativos: ${usageSummary}. Substitua-a nesses locais antes de excluir.`,
    );
  }

  await deleteStoredCloudinaryMedia({
    url: String(stored[0].url),
    mimeType: String(stored[0].mime_type),
  });

  const deleted = await pg.raw<{ id: number }>(
    `DELETE FROM "${PRODUCT_MEDIA_ASSETS_TABLE}"
     WHERE id = $1 AND empresa_id = $2
     RETURNING id`,
    [id, user.empresaId],
  );
  if (!deleted[0]) throw new Error('Mídia não encontrada.');

  revalidatePath('/dashboard/media');
  return { id: Number(deleted[0].id) };
}
