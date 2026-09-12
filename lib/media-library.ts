export const MEDIA_LIBRARY_LIMIT = 250;

export const MEDIA_CATEGORY_OPTIONS = [
  { value: 'products', label: 'Produtos' },
  { value: 'combos', label: 'Combos' },
  { value: 'drinks', label: 'Bebidas' },
  { value: 'other', label: 'Outros' },
] as const;

export type MediaCategory = (typeof MEDIA_CATEGORY_OPTIONS)[number]['value'];
export type MediaCategoryFilter = MediaCategory | 'all';
export type MediaSort = 'recent' | 'oldest' | 'name';

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

export function filterAndSortMediaAssets(
  assets: MediaAsset[],
  query: string,
  category: MediaCategoryFilter,
  sort: MediaSort,
): MediaAsset[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');

  return assets
    .filter((asset) => {
      const matchesCategory = category === 'all' || asset.category === category;
      const matchesQuery = !normalizedQuery
        || asset.name.toLocaleLowerCase('pt-BR').includes(normalizedQuery);
      return matchesCategory && matchesQuery;
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
