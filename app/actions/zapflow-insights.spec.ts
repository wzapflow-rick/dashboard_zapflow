const mockPg = {
  list: jest.fn(),
  raw: jest.fn(),
};

jest.mock('@/lib/postgres', () => ({ pg: mockPg }));
jest.mock('@/lib/session-server', () => ({ getMe: jest.fn() }));
jest.mock('ai', () => ({
  generateText: jest.fn(),
  Output: { object: jest.fn((value) => value) },
}));
jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn(() => jest.fn(() => ({}))),
}));

import { getMe } from '@/lib/session-server';
import { getZapflowComparativos, type ComparativoPeriodo } from './zapflow-insights';

describe('getZapflowComparativos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-10T15:00:00.000Z'));
    (getMe as jest.Mock).mockResolvedValue({ empresaId: 42 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('calcula Hoje x Ontem e respeita as regras de cada indicador', async () => {
    mockPg.raw.mockResolvedValue([
      {
        criado_em: '2026-09-09T12:00:00.000Z',
        status: 'finalizado',
        valor_total: '50',
      },
      {
        criado_em: '2026-09-10T11:00:00.000Z',
        status: 'finalizado',
        valor_total: '100',
      },
      {
        criado_em: '2026-09-10T13:00:00.000Z',
        status: 'preparando',
        valor_total: '50',
      },
      {
        criado_em: '2026-09-10T14:00:00.000Z',
        status: 'cancelado',
        valor_total: '200',
      },
    ]);

    const result = await getZapflowComparativos('hoje');

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      periodo: 'hoje',
      atualLabel: 'Hoje',
      anteriorLabel: 'Ontem',
      faturamento: { atual: 100, anterior: 50, variacao: 100 },
      ticketMedio: { atual: 75, anterior: 50, variacao: 50 },
      pedidos: { atual: 2, anterior: 1, variacao: 100 },
    });
    expect(result.data?.faturamento.serie).toHaveLength(13);
    expect(result.data?.faturamento.serie.find((ponto) => ponto.label === '8h')).toMatchObject({
      value: 100,
      detail: '1 pedido finalizado',
    });
    expect(result.data?.ticketMedio.serie.find((ponto) => ponto.label === '10h')).toMatchObject({
      value: 50,
      detail: '1 pedido válido',
    });
    expect(mockPg.raw).toHaveBeenCalledWith(
      expect.stringContaining('WHERE empresa_id = $1'),
      [42, '2026-09-09T03:00:00.000Z', '2026-09-10T15:00:00.000Z'],
    );
    expect(mockPg.raw.mock.calls[0][0]).not.toContain('LIMIT');
  });

  it.each([
    ['7dias', 7, '04/09'],
    ['30dias', 30, '12/08'],
  ] as const)('preenche todos os buckets de %s, inclusive os dias sem movimento', async (periodo, dias, primeiroLabel) => {
    mockPg.raw.mockResolvedValue([
      {
        criado_em: '2026-09-08T12:00:00.000Z',
        status: 'finalizado',
        valor_total: '80',
      },
    ]);

    const result = await getZapflowComparativos(periodo as ComparativoPeriodo);
    const serie = result.data?.faturamento.serie ?? [];

    expect(serie).toHaveLength(dias);
    expect(serie[0]).toMatchObject({ label: primeiroLabel, value: 0 });
    expect(serie.at(-1)?.label).toBe('10/09');
    expect(serie.some((ponto) => ponto.value === 0)).toBe(true);
  });

  it('usa variação segura quando o período anterior está zerado', async () => {
    mockPg.raw.mockResolvedValue([
      {
        criado_em: '2026-09-10T12:00:00.000Z',
        status: 'finalizado',
        valor_total: '25',
      },
    ]);

    const comVenda = await getZapflowComparativos('hoje');
    expect(comVenda.data?.faturamento.variacao).toBe(100);

    mockPg.raw.mockResolvedValue([]);
    const semVenda = await getZapflowComparativos('hoje');
    expect(semVenda.data?.faturamento.variacao).toBe(0);
  });

  it('rejeita período inválido antes de consultar o banco', async () => {
    const result = await getZapflowComparativos('semana' as ComparativoPeriodo);

    expect(result).toEqual({ success: false, error: 'Período inválido.' });
    expect(mockPg.raw).not.toHaveBeenCalled();
  });
});
