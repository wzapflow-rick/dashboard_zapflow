jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/session-server', () => ({
  getMe: jest.fn(),
  requireRole: jest.fn(),
}));

jest.mock('@/lib/postgres', () => ({
  pg: {
    query: jest.fn(),
  },
}));

import { getMesasComDetalhes } from './tables';
import { getMe } from '@/lib/session-server';
import { pg } from '@/lib/postgres';

const mockedGetMe = getMe as jest.Mock;
const mockedQuery = pg.query as jest.Mock;

describe('getMesasComDetalhes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetMe.mockResolvedValue({ empresaId: 'empresa-1' });
  });

  it('associa pedidos recentes à comanda aberta e calcula o total da mesa', async () => {
    mockedQuery.mockImplementation((query: string) => {
      if (query.includes('FROM mesas')) {
        return Promise.resolve({
          rows: [{ id: 2, store_id: 'empresa-1', numero: 2, status: 'ocupada', taxa_entrega: 5 }],
        });
      }

      if (query.includes('FROM comandas') && !query.includes('INNER JOIN')) {
        return Promise.resolve({
          rows: [{ id: 740, mesa_id: 2, store_id: 'empresa-1', status: 'aberta' }],
        });
      }

      return Promise.resolve({
        rows: [
          { id: 9001, comanda_id: 740, empresa_id: 'empresa-1', tipo_entrega: 'mesa', status: 'pendente', valor_total: '42.50' },
          { id: 9002, comanda_id: 740, empresa_id: 'empresa-1', tipo_entrega: 'mesa', status: 'pronto', valor_total: 17.5 },
        ],
      });
    });

    const mesas = await getMesasComDetalhes();

    expect(mesas).toHaveLength(1);
    expect(mesas[0].comandas).toHaveLength(1);
    expect(mesas[0].comandas[0].pedidos).toHaveLength(2);
    expect(mesas[0].total_mesa).toBe(65);
  });

  it('busca apenas pedidos de comandas abertas da empresa sem limite histórico global', async () => {
    mockedQuery.mockResolvedValue({ rows: [] });

    await getMesasComDetalhes();

    const pedidosCall = mockedQuery.mock.calls.find(([query]) =>
      query.includes('FROM pedidos p')
    );

    expect(pedidosCall).toBeDefined();
    expect(pedidosCall[0]).toContain('INNER JOIN comandas c');
    expect(pedidosCall[0]).toContain('c.store_id = $1');
    expect(pedidosCall[0]).toContain('c.status = $2');
    expect(pedidosCall[0]).not.toMatch(/LIMIT\s+500/i);
    expect(pedidosCall[1]).toEqual(['empresa-1', 'aberta']);
  });
});
