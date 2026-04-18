import { getLoyaltyConfig, getLoyaltyStats, saveLoyaltyConfig } from './loyalty';
import { getMe } from '@/lib/session-server';

describe('Loyalty Actions', () => {
  const mockUser = { empresaId: 1 };
  const mockConfig = {
    empresa_id: 1,
    pontos_por_real: 1,
    valor_ponto: 0.10,
    pontos_para_desconto: 100,
    desconto_tipo: 'valor_fixo',
    desconto_valor: 10,
    ativo: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getMe as jest.Mock).mockResolvedValue(mockUser);
    (global.fetch as jest.Mock).mockReset();
  });

  describe('getLoyaltyConfig', () => {
    it('should return loyalty config when found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ list: [mockConfig] })
      });

      const result = await getLoyaltyConfig();
      expect(result).toEqual(mockConfig);
    });

    it('should return default config when none found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ list: [] })
      });

      const result = await getLoyaltyConfig();
      expect(result).toMatchObject({
        empresa_id: mockUser.empresaId,
        pontos_por_real: 1,
        valor_ponto: 0.10,
        pontos_para_desconto: 100,
        desconto_tipo: 'valor_fixo',
        desconto_valor: 10,
        ativo: false
      });
    });

    it('should return null when user not found', async () => {
      (getMe as jest.Mock).mockResolvedValue(null);
      const result = await getLoyaltyConfig();
      expect(result).toBeNull();
    });
  });

  describe('getLoyaltyStats', () => {
    it('should return loyalty stats when data available', async () => {
      // First call is to getLoyaltyConfig which calls fetch
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ list: [mockConfig] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ 
            list: [
              { pontos_acumulados: 500, pontos_gastos: 50, cliente_telefone: '11999999999', cliente_nome: 'Cliente 1' },
              { pontos_acumulados: 300, pontos_gastos: 20, cliente_telefone: '11988888888', cliente_nome: 'Cliente 2' },
              { pontos_acumulados: 200, pontos_gastos: 10, cliente_telefone: '11977777777', cliente_nome: 'Cliente 3' }
            ]
          })
        });

      const result = await getLoyaltyStats();
      expect(result).toEqual({
        totalClientes: 3,
        totalPontosAcumulados: 1000,
        totalPontosResgatados: 80,
        pontosAtivos: 920,
        topClients: expect.any(Array)
      });
    });

    it('should return null when user not found', async () => {
      (getMe as jest.Mock).mockResolvedValue(null);
      const result = await getLoyaltyStats();
      expect(result).toBeNull();
    });
  });

  describe('saveLoyaltyConfig', () => {
    it('should save loyalty config successfully', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ list: [] })
        })
        .mockResolvedValueOnce({
          ok: true
        });

      const result = await saveLoyaltyConfig(mockConfig);
      expect(result).toEqual({ success: true });
    });
  });
});