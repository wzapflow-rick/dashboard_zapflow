import { getStatusLoja, type Horario } from './horarios';

/**
 * Horario base: aberto apenas na SEGUNDA-feira (dia 1) das 09:00 as 18:00.
 * Todos os testes usam datas fixas no fuso de Brasilia para serem deterministicos.
 */
const horarios: Horario[] = [
  { dia_semana: 1, hora_abertura: '09:00', hora_fechamento: '18:00' },
];

// Segunda-feira 2024-01-01, 12:00 (dentro do horario) — America/Sao_Paulo (UTC-3).
const segNoHorario = new Date('2024-01-01T15:00:00Z');
// Terca-feira 2024-01-02, 12:00 (nenhum horario configurado nesse dia = fechado).
const terFechado = new Date('2024-01-02T15:00:00Z');

describe('getStatusLoja - abertura manual (feriado / fora do horario)', () => {
  it('segue o horario quando nao ha override', () => {
    expect(getStatusLoja(horarios, null, null, segNoHorario).aberto).toBe(true);
    expect(getStatusLoja(horarios, null, null, terFechado).aberto).toBe(false);
  });

  it('abertura manual forca ABERTO num dia fechado pelo horario', () => {
    // Override valido ate o fim do dia de terca.
    const status = getStatusLoja(horarios, null, '2024-01-03T00:00:00', terFechado);
    expect(status.aberto).toBe(true);
    expect(status.abertoManual).toBe(true);
  });

  it('abertura manual expira sozinha (agora >= abertoManualAte)', () => {
    // Override expirou ontem: volta a valer o horario (terca = fechado).
    const status = getStatusLoja(horarios, null, '2024-01-02T00:00:00', terFechado);
    expect(status.aberto).toBe(false);
    expect(status.abertoManual).toBe(false);
  });

  it('fechamento manual tem precedencia sobre abertura manual', () => {
    const status = getStatusLoja(
      horarios,
      '2024-01-03T00:00:00', // fechado manual ativo
      '2024-01-03T00:00:00', // abertura manual tambem ativa
      terFechado,
    );
    expect(status.aberto).toBe(false);
    expect(status.fechadoManual).toBe(true);
    expect(status.abertoManual).toBe(false);
  });

  it('fechamento manual fecha a loja mesmo dentro do horario', () => {
    const status = getStatusLoja(horarios, '2024-01-02T00:00:00', null, segNoHorario);
    expect(status.aberto).toBe(false);
    expect(status.fechadoManual).toBe(true);
  });
});
