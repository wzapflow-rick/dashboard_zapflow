'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session-server';
import { pg } from '@/lib/postgres';
import { uploadImageAction } from '@/app/actions/products';
import { PRODUCT_MEDIA_ASSETS_TABLE } from '@/lib/tables';
import {
  MEDIA_LIBRARY_LIMIT,
  isMediaCategory,
  sanitizeMediaName,
  type MediaAsset,
  type MediaCategory,
} from '@/lib/media-library';

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

const MEDIA_LIBRARY_SETUP_ERROR =
  'O acervo de mídias ainda não foi configurado. Aplique a migração do banco e tente novamente.';

async function isMediaLibrarySchemaReady(): Promise<boolean> {
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

async function requireMediaLibrarySchema(): Promise<void> {
  if (!(await isMediaLibrarySchemaReady())) {
    throw new Error(MEDIA_LIBRARY_SETUP_ERROR);
  }
}

function serializeMediaAsset(row: Record<string, unknown>): MediaAsset {
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

function parseOptionalDimension(value: FormDataEntryValue | null): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 12000 ? parsed : null;
}

export async function getMediaLibrary(): Promise<{
  assets: MediaAsset[];
  total: number;
  setupRequired: boolean;
}> {
  const user = await requireAdmin();
  const schemaReady = await isMediaLibrarySchemaReady();

  if (!schemaReady) {
    return { assets: [], total: 0, setupRequired: true };
  }

  const [rows, totals] = await Promise.all([
    pg.raw(
      `SELECT * FROM "${PRODUCT_MEDIA_ASSETS_TABLE}"
       WHERE empresa_id = $1
       ORDER BY criado_em DESC, id DESC
       LIMIT $2`,
      [user.empresaId, MEDIA_LIBRARY_LIMIT],
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
  };
}

export async function uploadMediaAsset(formData: FormData): Promise<MediaAsset> {
  const user = await requireAdmin();
  await requireMediaLibrarySchema();

  const file = formData.get('image');
  if (!(file instanceof File) || file.size === 0) {
    throw new Error('Selecione uma imagem válida.');
  }
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Formato inválido. Envie uma imagem PNG, JPG ou WebP.');
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('A imagem deve ter no máximo 10 MB.');
  }

  const categoryValue = formData.get('category');
  const category: MediaCategory = isMediaCategory(categoryValue) ? categoryValue : 'products';
  const name = sanitizeMediaName(formData.get('name') || file.name);
  if (!name) throw new Error('Informe um nome para a imagem.');

  const currentUsage = await pg.raw<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM "${PRODUCT_MEDIA_ASSETS_TABLE}"
     WHERE empresa_id = $1`,
    [user.empresaId],
  );
  if (Number(currentUsage[0]?.total ?? 0) >= MEDIA_LIBRARY_LIMIT) {
    throw new Error('Seu acervo atingiu o limite de 250 imagens.');
  }

  const imageUrl = await uploadImageAction(formData);
  if (!imageUrl) throw new Error('Não foi possível enviar a imagem.');

  const parsedUrl = new URL(imageUrl);
  if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'res.cloudinary.com') {
    throw new Error('O serviço de upload retornou uma URL inválida.');
  }

  const rows = await pg.raw(
    `WITH quota_lock AS MATERIALIZED (
       SELECT pg_advisory_xact_lock(hashtext($1::text))
     ), current_usage AS MATERIALIZED (
       SELECT COUNT(*)::int AS total
       FROM "${PRODUCT_MEDIA_ASSETS_TABLE}", quota_lock
       WHERE empresa_id = $1
     )
     INSERT INTO "${PRODUCT_MEDIA_ASSETS_TABLE}"
       (empresa_id, nome, url, categoria, mime_type, tamanho_bytes, largura, altura)
     SELECT $1, $2, $3, $4, $5, $6, $7, $8
     FROM current_usage
     WHERE total < $9
     RETURNING *`,
    [
      user.empresaId,
      name,
      imageUrl,
      category,
      file.type,
      file.size,
      parseOptionalDimension(formData.get('width')),
      parseOptionalDimension(formData.get('height')),
      MEDIA_LIBRARY_LIMIT,
    ],
  );

  if (!rows[0]) throw new Error('Seu acervo atingiu o limite de 250 imagens.');

  revalidatePath('/dashboard/media-library');
  return serializeMediaAsset(rows[0]);
}

export async function updateMediaAsset(input: {
  id: number;
  name?: string;
  category?: MediaCategory;
}): Promise<MediaAsset> {
  const user = await requireAdmin();
  await requireMediaLibrarySchema();

  if (!Number.isInteger(input.id) || input.id <= 0) throw new Error('Imagem inválida.');

  const updates: string[] = [];
  const values: unknown[] = [input.id, user.empresaId];

  if (input.name !== undefined) {
    const name = sanitizeMediaName(input.name);
    if (!name) throw new Error('O nome da imagem não pode ficar vazio.');
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

  if (!rows[0]) throw new Error('Imagem não encontrada.');

  revalidatePath('/dashboard/media-library');
  return serializeMediaAsset(rows[0]);
}

export async function deleteMediaAsset(id: number): Promise<{ id: number }> {
  const user = await requireAdmin();
  await requireMediaLibrarySchema();

  if (!Number.isInteger(id) || id <= 0) throw new Error('Imagem inválida.');

  const rows = await pg.raw<{ id: number }>(
    `DELETE FROM "${PRODUCT_MEDIA_ASSETS_TABLE}"
     WHERE id = $1 AND empresa_id = $2
     RETURNING id`,
    [id, user.empresaId],
  );

  if (!rows[0]) throw new Error('Imagem não encontrada.');

  revalidatePath('/dashboard/media-library');
  return { id: Number(rows[0].id) };
}
