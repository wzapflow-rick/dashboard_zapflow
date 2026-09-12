export const MEDIA_LIBRARY_LIMIT = 250;
export const MEDIA_MAX_FILES_PER_SELECTION = 20;
export const MEDIA_MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const MEDIA_MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;

export const MEDIA_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MEDIA_VIDEO_MIME_TYPES = ['video/mp4'] as const;

export const MEDIA_CATEGORY_OPTIONS = [
  { value: 'products', label: 'Produtos' },
  { value: 'combos', label: 'Combos' },
  { value: 'drinks', label: 'Bebidas' },
  { value: 'other', label: 'Outros' },
] as const;

export type MediaCategory = (typeof MEDIA_CATEGORY_OPTIONS)[number]['value'];
export type MediaCategoryFilter = MediaCategory | 'all';
export type MediaSort = 'recent' | 'oldest' | 'name';
export type MediaKind = 'image' | 'video';
export type MediaTypeFilter = MediaKind | 'all';

export interface MediaAsset {
  id: number;
  empresaId: number | string;
  name: string;
  url: string;
  category: MediaCategory;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MediaUploadDescriptor {
  name: unknown;
  category: unknown;
  mimeType: unknown;
  sizeBytes: unknown;
}

export type MediaUploadValidation =
  | { valid: true; kind: MediaKind; name: string; category: MediaCategory; mimeType: string; sizeBytes: number }
  | { valid: false; error: string };

export function isMediaCategory(value: unknown): value is MediaCategory {
  return MEDIA_CATEGORY_OPTIONS.some((option) => option.value === value);
}

export function sanitizeMediaName(value: unknown): string {
  if (typeof value !== 'string') return '';

  return value
    .replace(/[\\/]/g, '-')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

export function getMediaKindFromMimeType(mimeType: unknown): MediaKind | null {
  if (typeof mimeType !== 'string') return null;
  if ((MEDIA_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) return 'image';
  if ((MEDIA_VIDEO_MIME_TYPES as readonly string[]).includes(mimeType)) return 'video';
  return null;
}

export function getMediaAssetKind(asset: Pick<MediaAsset, 'mimeType'>): MediaKind {
  return getMediaKindFromMimeType(asset.mimeType) ?? 'image';
}

export function validateMediaUploadDescriptor(
  descriptor: MediaUploadDescriptor,
): MediaUploadValidation {
  const name = sanitizeMediaName(descriptor.name);
  if (!name) return { valid: false, error: 'Informe um nome para a mídia.' };
  if (!isMediaCategory(descriptor.category)) {
    return { valid: false, error: 'Selecione uma categoria válida.' };
  }

  const kind = getMediaKindFromMimeType(descriptor.mimeType);
  if (!kind) {
    return { valid: false, error: 'Formato inválido. Use JPG, PNG, WebP ou MP4.' };
  }

  const sizeBytes = Number(descriptor.sizeBytes);
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    return { valid: false, error: 'O arquivo selecionado está vazio ou é inválido.' };
  }

  const limit = kind === 'image' ? MEDIA_MAX_IMAGE_SIZE_BYTES : MEDIA_MAX_VIDEO_SIZE_BYTES;
  if (sizeBytes > limit) {
    return {
      valid: false,
      error: kind === 'image'
        ? 'Cada imagem deve ter no máximo 10 MB.'
        : 'Cada vídeo deve ter no máximo 50 MB.',
    };
  }

  return {
    valid: true,
    kind,
    name,
    category: descriptor.category,
    mimeType: String(descriptor.mimeType),
    sizeBytes,
  };
}

function normalizeSearchValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

export function filterAndSortMediaAssets(
  assets: MediaAsset[],
  query: string,
  category: MediaCategoryFilter,
  sort: MediaSort,
  type: MediaTypeFilter = 'all',
): MediaAsset[] {
  const normalizedQuery = normalizeSearchValue(query.trim());

  return assets
    .filter((asset) => {
      const matchesCategory = category === 'all' || asset.category === category;
      const matchesType = type === 'all' || getMediaAssetKind(asset) === type;
      const matchesQuery = !normalizedQuery
        || normalizeSearchValue(asset.name).includes(normalizedQuery);
      return matchesCategory && matchesType && matchesQuery;
    })
    .sort((left, right) => {
      if (sort === 'name') {
        return left.name.localeCompare(right.name, 'pt-BR', { sensitivity: 'base' });
      }

      const direction = sort === 'recent' ? -1 : 1;
      return (Date.parse(left.createdAt) - Date.parse(right.createdAt)) * direction;
    });
}

export function getMediaCategoryCounts(assets: MediaAsset[]) {
  return MEDIA_CATEGORY_OPTIONS.reduce<Record<MediaCategory, number>>(
    (counts, option) => {
      counts[option.value] = assets.filter((asset) => asset.category === option.value).length;
      return counts;
    },
    { products: 0, combos: 0, drinks: 0, other: 0 },
  );
}

export function getMediaCategoryLabel(category: MediaCategory): string {
  return MEDIA_CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? 'Outros';
}
