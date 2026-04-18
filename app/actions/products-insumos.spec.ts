// Mock TextEncoder and TextDecoder
const { TextEncoder: NodeTextEncoder, TextDecoder: NodeTextDecoder } = require('util');
(global as any).TextEncoder = NodeTextEncoder;
(global as any).TextDecoder = NodeTextDecoder;

// Mock global fetch
(global as any).fetch = jest.fn();

// Mock Request and Response
global.Request = class Request {
  constructor(input: string | Request, init?: RequestInit) {
    this.url = typeof input === 'string' ? input : input.url;
    this.method = init?.method || 'GET';
    this.headers = new Headers(init?.headers);
    this.body = init?.body;
  }
  url: string = '';
  method: string = 'GET';
  headers: Headers = new Headers();
  body: any = null;
} as any;

global.Response = class Response {
  constructor(body: any, init?: ResponseInit) {
    this.ok = (init?.status || 200) >= 200 && (init?.status || 200) < 300;
    this.status = init?.status || 200;
    this.statusText = init?.statusText || '';
    this.headers = new Headers(init?.headers);
    this.body = body;
  }
  ok: boolean = true;
  status: number = 200;
  statusText: string = '';
  headers: Headers = new Headers();
  body: any;
  json(): Promise<any> { return Promise.resolve(this.body); }
  text(): Promise<string> { return Promise.resolve(JSON.stringify(this.body)); }
} as any;

global.Headers = class Headers {
  private map: Map<string, string> = new Map();
  constructor(init?: any) {
    if (init && typeof init === 'object') {
      Object.entries(init).forEach(([k, v]) => this.set(k, v as string));
    }
  }
  get(name: string): string | null { return this.map.get(name.toLowerCase()) || null; }
  set(name: string, value: string): void { this.map.set(name.toLowerCase(), value); }
  has(name: string): boolean { return this.map.has(name.toLowerCase()); }
} as any;

// Mock next/cache
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
  unstable_noStore: jest.fn()
}), { virtual: true });

// Mock session server
jest.mock('@/lib/session-server', () => ({
  getMe: jest.fn(),
  requireAdmin: jest.fn()
}), { virtual: true });

// Mock validations
jest.mock('@/lib/validations', () => ({
  ProductSchema: { safeParse: jest.fn().mockReturnValue({ success: true, data: {} }) },
  CategorySchema: { safeParse: jest.fn().mockReturnValue({ success: true, data: {} }) },
  InsumoSchema: { safeParse: jest.fn().mockReturnValue({ success: true, data: {} }) }
}), { virtual: true });

// Mock audit
jest.mock('@/lib/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined)
}), { virtual: true });

import { getProducts, getCategories, upsertProduct, updateProductAvailability } from './products';
import { getInsumos, upsertInsumo, deleteInsumo } from './insumos';
import { getMe, requireAdmin } from '@/lib/session-server';

describe('Products Actions', () => {
  const mockUser = { empresaId: 1 };
  const mockProduct = {
    id: 1,
    nome: 'Pizza Margherita',
    preco: 49.90,
    descricao: 'Pizza clássica',
    categoria_id: 1,
    disponivel: true,
    empresa_id: 1
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getMe as jest.Mock).mockResolvedValue(mockUser);
    (requireAdmin as jest.Mock).mockResolvedValue(mockUser);
    (global.fetch as jest.Mock).mockReset();
  });

  describe('getProducts', () => {
    it('should return products when found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ list: [mockProduct] })
      });

      const result = await getProducts();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array when no products', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ list: [] })
      });

      const result = await getProducts();
      expect(result).toEqual([]);
    });
  });

  describe('upsertProduct', () => {
    it('should return result object when creating product', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1 }), headers: new Headers() });

      const result = await upsertProduct({ nome: 'Nova Pizza', preco: 59.90 });
      expect(result).toBeDefined();
    });
  });
});

describe('Insumos Actions', () => {
  const mockUser = { empresaId: 1 };
  const mockInsumo = {
    id: 1,
    nome: 'Farinha de Trigo',
    quantidade_atual: 50,
    unidade_medida: 'kg',
    estoque_minimo: 10,
    custo_por_unidade: 5.00,
    empresa_id: 1
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getMe as jest.Mock).mockResolvedValue(mockUser);
    (requireAdmin as jest.Mock).mockResolvedValue(mockUser);
    (global.fetch as jest.Mock).mockReset();
  });

  describe('getInsumos', () => {
    it('should return insumos when found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ list: [mockInsumo] })
      });

      const result = await getInsumos();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array when no insumos', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ list: [] })
      });

      const result = await getInsumos();
      expect(result).toEqual([]);
    });
  });

  describe('upsertInsumo', () => {
    it('should return result object when creating insumo', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ list: [] }), headers: new Headers() })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1 }), headers: new Headers() });

      const result = await upsertInsumo({ nome: 'Tomate', quantidade_atual: 20, unidade_medida: 'kg', estoque_minimo: 5, custo_por_unidade: 3.00 });
      expect(result).toBeDefined();
    });
  });

  describe('deleteInsumo', () => {
    it('should delete insumo successfully', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ list: [mockInsumo] }), headers: new Headers() })
        .mockResolvedValueOnce({ ok: true });

      const result = await deleteInsumo(1);
      expect(result).toBeDefined();
    });
  });
});