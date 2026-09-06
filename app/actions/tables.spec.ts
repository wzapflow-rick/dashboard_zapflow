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

  it('busca apenas pedidos de comandas abertas e aceita IDs com tipos legados diferentes', async () => {
    mockedQuery.mockImplementation((query: string) => {
      if (query.includes('FROM mesas')) {
        return Promise.resolve({
          rows: [{ id: 2, store_id: 'empresa-1', numero: 2, status: 'livre' }],
        });
      }

      return Promise.resolve({ rows: [] });
    });

    await getMesasComDetalhes();

    const pedidosCall = mockedQuery.mock.calls.find(([query]) =>
      query.includes('FROM pedidos p')
    );

    expect(pedidosCall).toBeDefined();
    expect(pedidosCall[0]).toContain('INNER JOIN comandas c');
    expect(pedidosCall[0]).toContain('c.id::text = p.comanda_id::text');
    // O mesmo `$1` compara store_id (TEXT) e empresa_id (INTEGER); ambos precisam
    // do cast ::text para o Postgres não fixar `$1` como TEXT e quebrar o
    // `empresa_id = $1` com "operator does not exist: integer = text" (42883).
    expect(pedidosCall[0]).toContain('c.store_id::text = $1');
    expect(pedidosCall[0]).toContain('p.empresa_id::text = $1');
    expect(pedidosCall[0]).not.toMatch(/c\.store_id = \$1/);
    expect(pedidosCall[0]).not.toMatch(/p\.empresa_id = \$1/);
    expect(pedidosCall[0]).toContain('c.status = $2');
    expect(pedidosCall[0]).not.toMatch(/LIMIT\s+500/i);
    expect(pedidosCall[1]).toEqual(['empresa-1', 'aberta']);
  });

  it('preserva as mesas quando a consulta de detalhes falha', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    mockedQuery.mockImplementation((query: string) => {
      if (query.includes('FROM mesas')) {
        return Promise.resolve({
          rows: [{ id: 7, store_id: 'empresa-1', numero: 7, status: 'ocupada', taxa_entrega: '4.50' }],
        });
      }

      if (query.includes('FROM pedidos p')) {
        return Promise.reject(Object.assign(new Error('operator does not exist: integer = text'), {
          code: '42883',
        }));
      }

      return Promise.resolve({ rows: [] });
    });

    const mesas = await getMesasComDetalhes();

    expect(mesas).toEqual([
      expect.objectContaining({
        id: 7,
        comandas: [],
        total_mesa: 4.5,
      }),
    ]);
    expect(consoleError).toHaveBeenCalledWith(
      'Erro ao buscar detalhes das mesas:',
      expect.objectContaining({ code: '42883' })
    );

    consoleError.mockRestore();
  });
});
