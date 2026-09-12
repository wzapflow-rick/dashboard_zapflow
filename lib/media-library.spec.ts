import {
  filterAndSortMediaAssets,
  getMediaCategoryCounts,
  isMediaCategory,
  sanitizeMediaName,
  type MediaAsset,
} from './media-library';

const assets: MediaAsset[] = [
  {
    id: 1,
    empresaId: 7,
    name: 'Suco de laranja.jpg',
    url: 'https://res.cloudinary.com/demo/image/upload/suco.jpg',
    category: 'drinks',
    mimeType: 'image/jpeg',
    sizeBytes: 2048,
    width: 800,
    height: 800,
    createdAt: '2026-09-10T12:00:00.000Z',
    updatedAt: '2026-09-10T12:00:00.000Z',
  },
  {
    id: 2,
    empresaId: 7,
    name: 'Burger promoção.jpg',
    url: 'https://res.cloudinary.com/demo/image/upload/burger.jpg',
    category: 'products',
    mimeType: 'image/jpeg',
    sizeBytes: 4096,
    width: 1200,
    height: 1200,
    createdAt: '2026-09-12T12:00:00.000Z',
    updatedAt: '2026-09-12T12:00:00.000Z',
  },
  {
    id: 3,
    empresaId: 7,
    name: 'Combo família.png',
    url: 'https://res.cloudinary.com/demo/image/upload/combo.png',
    category: 'combos',
    mimeType: 'image/png',
    sizeBytes: 8192,
    width: 1000,
    height: 1000,
    createdAt: '2026-09-11T12:00:00.000Z',
    updatedAt: '2026-09-11T12:00:00.000Z',
  },
];

describe('media library helpers', () => {
  it('filters by category and accent-insensitive locale search', () => {
    expect(filterAndSortMediaAssets(assets, 'promoção', 'products', 'recent')).toEqual([assets[1]]);
  });

  it('sorts recent, oldest and name without mutating the source list', () => {
    expect(filterAndSortMediaAssets(assets, '', 'all', 'recent').map((asset) => asset.id)).toEqual([2, 3, 1]);
    expect(filterAndSortMediaAssets(assets, '', 'all', 'oldest').map((asset) => asset.id)).toEqual([1, 3, 2]);
    expect(filterAndSortMediaAssets(assets, '', 'all', 'name').map((asset) => asset.id)).toEqual([2, 3, 1]);
    expect(assets.map((asset) => asset.id)).toEqual([1, 2, 3]);
  });

  it('counts each business category', () => {
    expect(getMediaCategoryCounts(assets)).toEqual({ products: 1, combos: 1, drinks: 1, other: 0 });
  });

  it('sanitizes names and validates categories', () => {
    expect(sanitizeMediaName('  promo\\setembro / principal.jpg  ')).toBe('promo-setembro - principal.jpg');
    expect(isMediaCategory('drinks')).toBe(true);
    expect(isMediaCategory('private')).toBe(false);
  });
});
