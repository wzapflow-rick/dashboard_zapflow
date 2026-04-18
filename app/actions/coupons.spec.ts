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
  CouponSchema: {
    safeParse: jest.fn().mockReturnValue({ success: true, data: {} })
  }
}), { virtual: true });

// Mock audit
jest.mock('@/lib/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined)
}), { virtual: true });

import { getCoupons, validateCoupon, deleteCoupon } from './coupons';
import { getMe, requireAdmin } from '@/lib/session-server';

describe('Coupon Actions', () => {
  const mockUser = { empresaId: 1 };
  const mockCoupon = {
    id: 1,
    codigo: 'PROMO20',
    tipo: 'percentual' as const,
    valor: 20,
    valor_minimo_pedido: 50,
    limite_uso: 100,
    usos_atuais: 0,
    ativo: true,
    empresa_id: 1
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getMe as jest.Mock).mockResolvedValue(mockUser);
    (requireAdmin as jest.Mock).mockResolvedValue(mockUser);
    (global.fetch as jest.Mock).mockReset();
  });

  describe('getCoupons', () => {
    it('should return coupons when found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ list: [mockCoupon] })
      });

      const result = await getCoupons();
      expect(result).toEqual([mockCoupon]);
    });

    it('should return empty array when no coupons', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ list: [] })
      });

      const result = await getCoupons();
      expect(result).toEqual([]);
    });

    it('should return empty array when user not authenticated', async () => {
      (getMe as jest.Mock).mockResolvedValue(null);
      const result = await getCoupons();
      expect(result).toEqual([]);
    });
  });

  describe('validateCoupon', () => {
    it('should validate valid coupon', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          list: [{ 
            ...mockCoupon, 
            empresa_id: 1,
            data_inicio: '2024-01-01', 
            data_fim: '2099-12-31' 
          }] 
        })
      });

      const result = await validateCoupon('PROMO20', 100);
      expect(result.valid).toBe(true);
      expect(result.cupom).toBeDefined();
    });

    it('should reject expired coupon', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          list: [{ 
            ...mockCoupon, 
            empresa_id: 1,
            data_inicio: '2023-01-01', 
            data_fim: '2023-12-31' 
          }] 
        })
      });

      const result = await validateCoupon('PROMO20', 100);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expirado');
    });

    it('should reject coupon below minimum order value', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          list: [{ 
            ...mockCoupon, 
            empresa_id: 1,
            valor_minimo_pedido: 100 
          }] 
        })
      });

      const result = await validateCoupon('PROMO20', 50);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('mínimo');
    });

    it('should reject coupon at usage limit', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          list: [{ 
            ...mockCoupon, 
            empresa_id: 1,
            limite_uso: 10, 
            usos_atuais: 10 
          }] 
        })
      });

      const result = await validateCoupon('PROMO20', 100);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Limite');
    });

    it('should reject coupon not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ list: [] })
      });

      const result = await validateCoupon('INVALID', 100);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('não encontrado');
    });
  });

  describe('upsertCoupon', () => {
    it('should create new coupon when code does not exist', async () => {
      const { upsertCoupon } = require('./coupons');
      
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ list: [] }), headers: new Headers() })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1 }), headers: new Headers() });

      const result = await upsertCoupon({ codigo: 'NEWPROMO', tipo: 'percentual', valor: 15 });
      expect(result).toHaveProperty('success');
    });
  });

  describe('deleteCoupon', () => {
    it('should delete coupon successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      const result = await deleteCoupon(1);
      expect(result.success).toBe(true);
    });
  });
});