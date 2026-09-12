const mockPg = {
  raw: jest.fn(),
};
const mockUploadImageAction = jest.fn();

jest.mock('@/lib/postgres', () => ({ pg: mockPg }));
jest.mock('@/lib/session-server', () => ({ requireAdmin: jest.fn() }));
jest.mock('@/app/actions/products', () => ({ uploadImageAction: mockUploadImageAction }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

import {
  deleteMediaAsset,
  getMediaLibrary,
  updateMediaAsset,
  uploadMediaAsset,
} from './media-library';
import { requireAdmin } from '@/lib/session-server';

const databaseRow = {
  id: 12,
  empresa_id: 77,
  nome: 'Burger principal.jpg',
  url: 'https://res.cloudinary.com/demo/image/upload/zapflow_products/burger.jpg',
  categoria: 'products',
  mime_type: 'image/jpeg',
  tamanho_bytes: 2048,
  largura: 1000,
  altura: 1000,
  criado_em: '2026-09-12T10:00:00.000Z',
  atualizado_em: '2026-09-12T10:00:00.000Z',
};

describe('media library actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAdmin as jest.Mock).mockResolvedValue({ empresaId: 77, role: 'admin' });
    mockPg.raw.mockImplementation(async (query: string) => {
      if (query.includes('information_schema.tables')) return [{ exists: true }];
      if (query.includes('COUNT(*)')) return [{ total: 0 }];
      return [];
    });
  });

  it('lists only assets belonging to the signed-in company', async () => {
    mockPg.raw.mockImplementation(async (query: string, params: unknown[]) => {
      if (query.includes('information_schema.tables')) return [{ exists: true }];
      if (query.includes('SELECT *')) {
        expect(query).toContain('WHERE empresa_id = $1');
        expect(params[0]).toBe(77);
        return [databaseRow];
      }
      if (query.includes('COUNT(*)')) return [{ total: 1 }];
      return [];
    });

    await expect(getMediaLibrary()).resolves.toMatchObject({
      total: 1,
      assets: [{ id: 12, empresaId: 77, name: 'Burger principal.jpg' }],
    });
  });

  it('keeps the page available while the database migration is pending', async () => {
    mockPg.raw.mockImplementation(async (query: string) => {
      if (query.includes('information_schema.tables')) return [{ exists: false }];
      throw new Error(`Unexpected query: ${query}`);
    });

    await expect(getMediaLibrary()).resolves.toEqual({
      assets: [],
      total: 0,
      setupRequired: true,
    });
  });

  it('uploads with an atomic quota lock and persists optimized metadata', async () => {
    mockUploadImageAction.mockResolvedValue(databaseRow.url);
    mockPg.raw.mockImplementation(async (query: string, params: unknown[]) => {
      if (query.includes('information_schema.tables')) return [{ exists: true }];
      if (query.includes('quota_lock')) {
        expect(query).toContain('pg_advisory_xact_lock');
        expect(params).toEqual([
          77,
          'Burger principal.jpg',
          databaseRow.url,
          'products',
          'image/jpeg',
          expect.any(Number),
          1000,
          1000,
          250,
        ]);
        return [databaseRow];
      }
      if (query.includes('COUNT(*)')) return [{ total: 0 }];
      return [];
    });

    const formData = new FormData();
    formData.set('image', new File(['image'], 'Burger principal.jpg', { type: 'image/jpeg' }));
    formData.set('name', 'Burger principal.jpg');
    formData.set('category', 'products');
    formData.set('width', '1000');
    formData.set('height', '1000');

    await expect(uploadMediaAsset(formData)).resolves.toMatchObject({ id: 12, category: 'products' });
    expect(mockUploadImageAction).toHaveBeenCalledWith(formData);
  });

  it('blocks uploads before storage when the plan quota is full', async () => {
    mockPg.raw.mockImplementation(async (query: string) => {
      if (query.includes('information_schema.tables')) return [{ exists: true }];
      if (query.includes('COUNT(*)')) return [{ total: 250 }];
      return [];
    });

    const formData = new FormData();
    formData.set('image', new File(['image'], 'limite.jpg', { type: 'image/jpeg' }));

    await expect(uploadMediaAsset(formData)).rejects.toThrow('limite de 250 imagens');
    expect(mockUploadImageAction).not.toHaveBeenCalled();
  });

  it('scopes rename and delete mutations by both asset and company id', async () => {
    mockPg.raw.mockImplementation(async (query: string, params: unknown[]) => {
      if (query.includes('information_schema.tables')) return [{ exists: true }];
      if (query.includes('UPDATE')) {
        expect(query).toContain('WHERE id = $1 AND empresa_id = $2');
        expect(params.slice(0, 2)).toEqual([12, 77]);
        return [{ ...databaseRow, nome: 'Burger noite.jpg' }];
      }
      if (query.includes('DELETE')) {
        expect(query).toContain('WHERE id = $1 AND empresa_id = $2');
        expect(params).toEqual([12, 77]);
        return [{ id: 12 }];
      }
      return [];
    });

    await expect(updateMediaAsset({ id: 12, name: 'Burger noite.jpg' })).resolves.toMatchObject({
      name: 'Burger noite.jpg',
    });
    await expect(deleteMediaAsset(12)).resolves.toEqual({ id: 12 });
  });
});
