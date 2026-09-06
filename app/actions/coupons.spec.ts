const mockPg = {
  list: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

jest.mock('@/lib/postgres', () => ({ pg: mockPg }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/session-server', () => ({ getMe: jest.fn(), requireAdmin: jest.fn() }));
jest.mock('@/lib/validations', () => ({
  CouponSchema: { safeParse: jest.fn((data) => ({ success: true, data })) },
}));
jest.mock('@/lib/audit', () => ({ logAction: jest.fn().mockResolvedValue(undefined) }));

import { deleteCoupon, getCoupons, upsertCoupon, validateCoupon } from './coupons';
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
    empresa_id: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getMe as jest.Mock).mockResolvedValue(mockUser);
    (requireAdmin as jest.Mock).mockResolvedValue(mockUser);
  });

  it('returns coupons when found', async () => {
    mockPg.list.mockResolvedValue({ list: [mockCoupon] });
    await expect(getCoupons()).resolves.toEqual([mockCoupon]);
  });

  it('returns an empty list when no coupons exist', async () => {
    mockPg.list.mockResolvedValue({ list: [] });
    await expect(getCoupons()).resolves.toEqual([]);
  });

  it('returns an empty list when the user is unauthenticated', async () => {
    (getMe as jest.Mock).mockResolvedValue(null);
    await expect(getCoupons()).resolves.toEqual([]);
  });

  it('validates a valid coupon', async () => {
    mockPg.list.mockResolvedValue({
      list: [{ ...mockCoupon, data_inicio: '2024-01-01', data_fim: '2099-12-31' }],
    });
    const result = await validateCoupon('PROMO20', 200);
    expect(result.valid).toBe(true);
    expect(result.cupom).toBeDefined();
  });

  it('rejects an expired coupon', async () => {
    mockPg.list.mockResolvedValue({
      list: [{ ...mockCoupon, data_inicio: '2023-01-01', data_fim: '2023-12-31' }],
    });
    await expect(validateCoupon('PROMO20', 200)).resolves.toMatchObject({
      valid: false,
      error: expect.stringContaining('expirado'),
    });
  });

  it('rejects a coupon below the minimum order value', async () => {
    mockPg.list.mockResolvedValue({ list: [{ ...mockCoupon, valor_minimo_pedido: 100 }] });
    await expect(validateCoupon('PROMO20', 50)).resolves.toMatchObject({
      valid: false,
      error: expect.stringContaining('mínimo'),
    });
  });

  it('rejects a coupon at its usage limit', async () => {
    mockPg.list.mockResolvedValue({ list: [{ ...mockCoupon, limite_uso: 10, usos_atuais: 10 }] });
    await expect(validateCoupon('PROMO20', 200)).resolves.toMatchObject({
      valid: false,
      error: expect.stringContaining('Limite'),
    });
  });

  it('rejects an unknown coupon', async () => {
    mockPg.list.mockResolvedValue({ list: [] });
    await expect(validateCoupon('INVALID', 200)).resolves.toMatchObject({
      valid: false,
      error: expect.stringContaining('não encontrado'),
    });
  });

  it('creates a new coupon', async () => {
    mockPg.findOne.mockResolvedValue(null);
    mockPg.create.mockResolvedValue({ id: 1 });
    const result = await upsertCoupon({ codigo: 'NEWPROMO', tipo: 'percentual', valor: 15 });
    expect(result.success).toBe(true);
    expect(mockPg.create).toHaveBeenCalled();
  });

  it('deletes a coupon', async () => {
    mockPg.delete.mockResolvedValue(undefined);
    await expect(deleteCoupon(1)).resolves.toEqual({ success: true });
    expect(mockPg.delete).toHaveBeenCalledWith(expect.any(String), 1);
  });
});
