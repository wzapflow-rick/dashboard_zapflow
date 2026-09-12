const mockPg = {
  raw: jest.fn(),
};
const mockDeleteStoredCloudinaryMedia = jest.fn();
const mockIsCloudinaryMediaConfigured = jest.fn(() => true);

jest.mock('@/lib/postgres', () => ({ pg: mockPg }));
jest.mock('@/lib/session-server', () => ({ requireAdmin: jest.fn() }));
jest.mock('@/lib/cloudinary-media', () => ({
  deleteStoredCloudinaryMedia: (...args: unknown[]) => mockDeleteStoredCloudinaryMedia(...args),
  isCloudinaryMediaConfigured: () => mockIsCloudinaryMediaConfigured(),
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

import {
  deleteMediaAsset,
  getMediaLibrary,
  updateMediaAsset,
} from './media-library';
import { requireAdmin } from '@/lib/session-server';

const databaseRow = {
  id: 12,
  empresa_id: 77,
  nome: 'Burger principal.jpg',
  url: 'https://res.cloudinary.com/demo/image/upload/v1/zapflow_products/burger.jpg',
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
    mockIsCloudinaryMediaConfigured.mockReturnValue(true);
    mockDeleteStoredCloudinaryMedia.mockResolvedValue(undefined);
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
      uploadConfigured: true,
      assets: [{ id: 12, empresaId: 77, name: 'Burger principal.jpg' }],
    });
  });

  it('keeps the page recoverable while the database migration is pending', async () => {
    mockPg.raw.mockImplementation(async (query: string) => {
      if (query.includes('information_schema.tables')) return [{ exists: false }];
      throw new Error(`Unexpected query: ${query}`);
    });

    await expect(getMediaLibrary()).resolves.toEqual({
      assets: [],
      total: 0,
      setupRequired: true,
      uploadConfigured: true,
    });
  });

  it('reports when signed uploads are not configured without hiding saved assets', async () => {
    mockIsCloudinaryMediaConfigured.mockReturnValue(false);
    mockPg.raw.mockImplementation(async (query: string) => {
      if (query.includes('information_schema.tables')) return [{ exists: true }];
      if (query.includes('SELECT *')) return [databaseRow];
      if (query.includes('COUNT(*)')) return [{ total: 1 }];
      return [];
    });

    await expect(getMediaLibrary()).resolves.toMatchObject({
      setupRequired: false,
      uploadConfigured: false,
      assets: [{ id: 12 }],
    });
  });

  it('scopes rename and permanent deletion by both asset and company id', async () => {
    mockPg.raw.mockImplementation(async (query: string, params: unknown[]) => {
      if (query.includes('information_schema.tables')) return [{ exists: true }];
      if (query.includes('UPDATE')) {
        expect(query).toContain('WHERE id = $1 AND empresa_id = $2');
        expect(params.slice(0, 2)).toEqual([12, 77]);
        return [{ ...databaseRow, nome: 'Burger noite.jpg' }];
      }
      if (query.includes('SELECT id, url, mime_type')) {
        expect(params).toEqual([12, 77]);
        return [{ id: 12, url: databaseRow.url, mime_type: databaseRow.mime_type }];
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
    expect(mockDeleteStoredCloudinaryMedia).toHaveBeenCalledWith({
      url: databaseRow.url,
      mimeType: databaseRow.mime_type,
    });
  });

  it('does not remove the database row when Cloudinary deletion fails', async () => {
    mockDeleteStoredCloudinaryMedia.mockRejectedValue(new Error('Cloudinary indisponível'));
    mockPg.raw.mockImplementation(async (query: string) => {
      if (query.includes('information_schema.tables')) return [{ exists: true }];
      if (query.includes('SELECT id, url, mime_type')) {
        return [{ id: 12, url: databaseRow.url, mime_type: databaseRow.mime_type }];
      }
      if (query.includes('DELETE')) throw new Error('DELETE não deveria ser executado');
      return [];
    });

    await expect(deleteMediaAsset(12)).rejects.toThrow('Cloudinary indisponível');
    expect(mockPg.raw.mock.calls.some(([query]) => String(query).includes('DELETE'))).toBe(false);
  });
});
