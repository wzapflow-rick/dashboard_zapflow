jest.mock('@/lib/postgres', () => ({
  pg: {
    raw: jest.fn(),
    list: jest.fn(),
    listAll: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.mock('@/lib/assinaturas', () => ({
  getAssinaturaByEmpresaId: jest.fn(),
}));

jest.mock('@/lib/constants', () => ({
  ...jest.requireActual('@/lib/constants'),
  isPaidPlan: () => true,
}));

jest.mock('@/lib/horarios', () => ({
  getStatusLoja: () => ({ aberto: true, proximaAbertura: null }),
}));

import { getPublicMenu } from './public-menu';
import { pg } from '@/lib/postgres';
import { getAssinaturaByEmpresaId } from '@/lib/assinaturas';
import {
  CATEGORIAS_TABLE,
  PRODUTOS_TABLE,
  GRUPOS_COMPLEMENTOS_TABLE,
  COMPLEMENTOS_TABLE,
  PRODUTOS_METADADOS_TABLE,
  HORARIOS_TABLE,
} from '@/lib/tables';

const mockedRaw = pg.raw as jest.Mock;
const mockedList = pg.list as jest.Mock;
const mockedListAll = pg.listAll as jest.Mock;
const mockedFindOne = pg.findOne as jest.Mock;
const mockedAssinatura = getAssinaturaByEmpresaId as jest.Mock;

// Produtos com disponibilidade mista: os esgotados NUNCA podem sair no cardapio.
const PRODUTOS = [
  { id: 1, nome: 'Pizza Ativa', categoria_id: 10, tipo: 'simples', preco: 30, disponivel: true },
  { id: 2, nome: 'Pizza Esgotada', categoria_id: 10, tipo: 'simples', preco: 35, disponivel: false },
  { id: 3, nome: 'Combo Esgotado', categoria_id: 20, tipo: 'composto', preco: 40, disponivel: false },
  { id: 4, nome: 'Combo Ativo', categoria_id: 20, tipo: 'composto', preco: 45, disponivel: true },
];

const CATEGORIAS = [
  { id: 10, nome: 'Pizzas', ordem: 1 },
  { id: 20, nome: 'Combos', ordem: 2 },
];

describe('getPublicMenu - filtro de disponibilidade', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedRaw.mockResolvedValue([{ id: 99, nome_fantasia: 'VR Pizza Show', slug: 'vr-pizza-show' }]);
    mockedAssinatura.mockResolvedValue({
      status: 'authorized',
      plano: 'pro',
      data_proxima_cobranca: new Date(Date.now() + 86_400_000).toISOString(),
    });
    mockedList.mockResolvedValue({ list: [] });
    mockedFindOne.mockResolvedValue(null);

    mockedListAll.mockImplementation((table: string) => {
      if (table === CATEGORIAS_TABLE) return Promise.resolve(CATEGORIAS);
      if (table === PRODUTOS_TABLE) return Promise.resolve(PRODUTOS);
      if (table === GRUPOS_COMPLEMENTOS_TABLE) return Promise.resolve([]);
      if (table === COMPLEMENTOS_TABLE) return Promise.resolve([]);
      if (table === PRODUTOS_METADADOS_TABLE) return Promise.resolve([]);
      if (table === HORARIOS_TABLE) return Promise.resolve([]);
      return Promise.resolve([]);
    });
  });

  it('exclui produtos simples esgotados do cardapio', async () => {
    const data = await getPublicMenu('vr-pizza-show');
    const pizzas = (data as any).grouped.find((c: any) => c.id === 10);

    const ids = pizzas.products.map((p: any) => p.id);
    expect(ids).toContain(1);
    expect(ids).not.toContain(2);
  });

  it('exclui produtos compostos esgotados do cardapio', async () => {
    const data = await getPublicMenu('vr-pizza-show');
    const combos = (data as any).grouped.find((c: any) => c.id === 20);

    const ids = combos.compositeProducts.map((p: any) => p.id);
    expect(ids).toContain(4);
    expect(ids).not.toContain(3);

    const topLevelIds = (data as any).compositeProducts.map((p: any) => p.id);
    expect(topLevelIds).toEqual([4]);
  });

  it('nao oferece itens esgotados como upsell', async () => {
    const data = await getPublicMenu('vr-pizza-show');
    const upsellIds = (data as any).upsellProducts.map((p: any) => p.id);

    expect(upsellIds).toContain(1);
    expect(upsellIds).toContain(4);
    expect(upsellIds).not.toContain(2);
    expect(upsellIds).not.toContain(3);
  });
});
