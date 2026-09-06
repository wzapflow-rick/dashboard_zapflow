const mockPg = {
  list: jest.fn(),
  listAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

jest.mock('@/lib/postgres', () => ({ pg: mockPg }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/session-server', () => ({ getMe: jest.fn(), requireAdmin: jest.fn() }));
jest.mock('@/lib/validations', () => ({
  ProductSchema: { safeParse: jest.fn((data) => ({ success: true, data })) },
  CategorySchema: { safeParse: jest.fn((data) => ({ success: true, data })) },
  InsumoSchema: { safeParse: jest.fn((data) => ({ success: true, data })) },
}));
jest.mock('@/lib/audit', () => ({ logAction: jest.fn().mockResolvedValue(undefined) }));
jest.mock('./insumos', () => {
  const actual = jest.requireActual('./insumos');
  return { ...actual, saveReceitaDoProduto: jest.fn() };
});
jest.mock('cloudinary', () => ({ v2: { config: jest.fn(), uploader: {} } }));

import { getProducts, upsertProduct } from './products';
import { deleteInsumo, getInsumos, upsertInsumo } from './insumos';
import { getMe, requireAdmin } from '@/lib/session-server';

describe('Products and Insumos Actions', () => {
  const mockUser = { empresaId: 1 };

  beforeEach(() => {
    jest.clearAllMocks();
    (getMe as jest.Mock).mockResolvedValue(mockUser);
    (requireAdmin as jest.Mock).mockResolvedValue(mockUser);
    mockPg.listAll.mockResolvedValue([]);
  });

  describe('products', () => {
    const product = {
      id: 1,
      nome: 'Pizza Margherita',
      preco: 49.9,
      descricao: 'Pizza clássica',
      categoria_id: 1,
      disponivel: true,
      empresa_id: 1,
    };

    it('returns products when found', async () => {
      mockPg.list.mockResolvedValue({ list: [product] });
      await expect(getProducts()).resolves.toEqual([expect.objectContaining(product)]);
    });

    it('returns an empty array when no products exist', async () => {
      mockPg.list.mockResolvedValue({ list: [] });
      await expect(getProducts()).resolves.toEqual([]);
    });

    it('creates a product and its metadata', async () => {
      mockPg.create.mockResolvedValueOnce({ id: 7, categoria_id: null }).mockResolvedValueOnce({ id: 8 });
      mockPg.findOne.mockResolvedValue(null);
      const result = await upsertProduct({ nome: 'Nova Pizza', preco: 59.9 });
      expect(result).toMatchObject({ id: 7, nome: 'Nova Pizza', preco: 59.9 });
      expect(mockPg.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('insumos', () => {
    const insumo = {
      id: 1,
      nome: 'Farinha de Trigo',
      quantidade_atual: 50,
      unidade_medida: 'kg',
      estoque_minimo: 10,
      custo_por_unidade: 5,
      empresa_id: 1,
    };

    it('returns insumos when found', async () => {
      mockPg.list.mockResolvedValue({ list: [insumo] });
      await expect(getInsumos()).resolves.toEqual([insumo]);
    });

    it('returns an empty array when no insumos exist', async () => {
      mockPg.list.mockResolvedValue({ list: [] });
      await expect(getInsumos()).resolves.toEqual([]);
    });

    it('creates an insumo', async () => {
      mockPg.create.mockResolvedValue({ id: 2 });
      const input = {
        nome: 'Tomate',
        quantidade_atual: 20,
        unidade_medida: 'kg',
        estoque_minimo: 5,
        custo_por_unidade: 3,
      };
      await expect(upsertInsumo(input)).resolves.toMatchObject({ ...input, id: 2 });
    });

    it('deletes an insumo', async () => {
      mockPg.delete.mockResolvedValue(undefined);
      await expect(deleteInsumo(1)).resolves.toEqual({ success: true });
    });
  });
});
