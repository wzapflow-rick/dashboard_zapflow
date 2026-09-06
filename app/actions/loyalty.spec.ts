const mockPg = {
  findOne: jest.fn(),
  list: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

jest.mock('@/lib/postgres', () => ({ pg: mockPg }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/session-server', () => ({ getMe: jest.fn() }));
jest.mock('@/lib/validations', () => ({
  LoyaltyConfigSchema: { safeParse: jest.fn((data) => ({ success: true, data })) },
  LoyaltyRedeemSchema: { safeParse: jest.fn((data) => ({ success: true, data })) },
}));
jest.mock('@/lib/audit', () => ({ logAction: jest.fn().mockResolvedValue(undefined) }));

import { getLoyaltyConfig, getLoyaltyStats, LoyaltyConfig, saveLoyaltyConfig } from './loyalty';
import { getMe } from '@/lib/session-server';

describe('Loyalty Actions', () => {
  const mockUser = { empresaId: 1 };
  const mockConfig: LoyaltyConfig = {
    empresa_id: 1,
    pontos_por_real: 1,
    valor_ponto: 0.1,
    pontos_para_desconto: 100,
    desconto_tipo: 'valor_fixo',
    desconto_valor: 10,
    ativo: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getMe as jest.Mock).mockResolvedValue(mockUser);
  });

  it('returns the loyalty configuration when found', async () => {
    mockPg.findOne.mockResolvedValue(mockConfig);
    await expect(getLoyaltyConfig()).resolves.toEqual(mockConfig);
  });

  it('returns the default configuration when none exists', async () => {
    mockPg.findOne.mockResolvedValue(null);
    await expect(getLoyaltyConfig()).resolves.toEqual(mockConfig);
  });

  it('returns null when the user is unauthenticated', async () => {
    (getMe as jest.Mock).mockResolvedValue(null);
    await expect(getLoyaltyConfig()).resolves.toBeNull();
  });

  it('calculates loyalty statistics', async () => {
    mockPg.findOne.mockResolvedValue(mockConfig);
    mockPg.list.mockResolvedValue({
      list: [
        { pontos_acumulados: 500, pontos_gastos: 50, cliente_telefone: '11999999999', cliente_nome: 'Cliente 1' },
        { pontos_acumulados: 300, pontos_gastos: 20, cliente_telefone: '11988888888', cliente_nome: 'Cliente 2' },
        { pontos_acumulados: 200, pontos_gastos: 10, cliente_telefone: '11977777777', cliente_nome: 'Cliente 3' },
      ],
    });

    await expect(getLoyaltyStats()).resolves.toEqual({
      totalClientes: 3,
      totalPontosAcumulados: 1000,
      totalPontosResgatados: 80,
      pontosAtivos: 920,
      topClients: expect.any(Array),
    });
  });

  it('returns null statistics when the user is unauthenticated', async () => {
    (getMe as jest.Mock).mockResolvedValue(null);
    await expect(getLoyaltyStats()).resolves.toBeNull();
  });

  it('creates the loyalty configuration', async () => {
    mockPg.findOne.mockResolvedValue(null);
    mockPg.create.mockResolvedValue({ id: 1 });
    await expect(saveLoyaltyConfig(mockConfig)).resolves.toEqual({ success: true });
    expect(mockPg.create).toHaveBeenCalled();
  });
});
