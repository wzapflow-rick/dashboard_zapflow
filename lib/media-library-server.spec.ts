const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};
const mockPg = {
  getClient: jest.fn(async () => mockClient),
};

jest.mock('@/lib/postgres', () => ({ pg: mockPg }));

import { insertMediaAssetWithQuota } from './media-library-server';

const databaseRow = {
  id: 12,
  empresa_id: 77,
  nome: 'Burger principal.webp',
  url: 'https://res.cloudinary.com/demo/image/upload/v1/zapflow_media/company/file.webp',
  categoria: 'products',
  mime_type: 'image/webp',
  tamanho_bytes: 2048,
  largura: 1000,
  altura: 1000,
  criado_em: '2026-09-12T10:00:00.000Z',
  atualizado_em: '2026-09-12T10:00:00.000Z',
};

const newAsset = {
  empresaId: 77,
  name: 'Burger principal.webp',
  url: databaseRow.url,
  category: 'products' as const,
  mimeType: 'image/webp',
  sizeBytes: 2048,
  width: 1000,
  height: 1000,
};

describe('media library persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('locks the company quota and inserts verified metadata atomically', async () => {
    mockClient.query.mockImplementation(async (query: string, params?: unknown[]) => {
      if (query.includes('pg_advisory_xact_lock')) {
        expect(params).toEqual(['media-library:77']);
        return { rows: [] };
      }
      if (query.includes('SELECT *')) return { rows: [] };
      if (query.includes('COUNT(*)')) return { rows: [{ total: 3 }] };
      if (query.includes('INSERT INTO')) {
        expect(params).toEqual([
          77,
          newAsset.name,
          newAsset.url,
          'products',
          'image/webp',
          2048,
          1000,
          1000,
        ]);
        return { rows: [databaseRow] };
      }
      return { rows: [] };
    });

    await expect(insertMediaAssetWithQuota(newAsset)).resolves.toMatchObject({
      created: true,
      asset: { id: 12, mimeType: 'image/webp' },
    });
    expect(mockClient.query.mock.calls.map(([query]) => String(query))).toEqual(expect.arrayContaining([
      'BEGIN',
      expect.stringContaining('pg_advisory_xact_lock'),
      expect.stringContaining('INSERT INTO'),
      'COMMIT',
    ]));
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('rejects the insert under the same lock when the quota is full', async () => {
    mockClient.query.mockImplementation(async (query: string) => {
      if (query.includes('SELECT *')) return { rows: [] };
      if (query.includes('COUNT(*)')) return { rows: [{ total: 250 }] };
      return { rows: [] };
    });

    await expect(insertMediaAssetWithQuota(newAsset)).resolves.toBeNull();
    expect(mockClient.query.mock.calls.some(([query]) => String(query).includes('INSERT INTO'))).toBe(false);
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns an existing record idempotently before consuming quota', async () => {
    mockClient.query.mockImplementation(async (query: string) => {
      if (query.includes('SELECT *')) return { rows: [databaseRow] };
      return { rows: [] };
    });

    await expect(insertMediaAssetWithQuota(newAsset)).resolves.toMatchObject({
      created: false,
      asset: { id: 12 },
    });
    expect(mockClient.query.mock.calls.some(([query]) => String(query).includes('COUNT(*)'))).toBe(false);
    expect(mockClient.query.mock.calls.some(([query]) => String(query).includes('INSERT INTO'))).toBe(false);
  });
});
