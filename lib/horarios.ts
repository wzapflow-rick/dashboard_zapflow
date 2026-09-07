/**
 * Helper compartilhado de horarios de funcionamento.
 *
 * Funcoes PURAS (sem 'use server') que podem ser usadas tanto no servidor
 * (actions, webhook) quanto no cliente (cardapio). Toda a logica de "loja
 * aberta/fechada" deve passar por aqui para garantir consistencia.
 *
 * Modelo de dados (tabela `horarios`):
 *   dia_semana: 0=Domingo, 1=Segunda, ... 6=Sabado
 *   hora_abertura / hora_fechamento: "HH:MM"
 *   fechado_o_dia_todo: boolean
 *
 * Suporta janelas que cruzam a meia-noite (ex.: 17:00 -> 00:00 ou 18:00 -> 02:00).
 */

export interface Horario {
  dia_semana: number;
  hora_abertura: string;
  hora_fechamento: string;
  fechado_o_dia_todo?: boolean;
}

const DIAS_SEMANA = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

/** Converte "HH:MM" para minutos desde a meia-noite. */
function toMinutes(hhmm: string | null | undefined): number {
  const [h, m] = (hhmm || '00:00').split(':').map((n) => Number(n) || 0);
  return h * 60 + m;
}

/** Retorna a data atual ajustada para o fuso de Brasilia. */
function nowBrasilia(now?: Date): Date {
  const base = now ?? new Date();
  return new Date(base.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

function findDia(horarios: Horario[], dia: number): Horario | undefined {
  return horarios.find((h) => Number(h.dia_semana) === dia);
}

/**
 * Indica se a loja esta aberta no momento (fuso de Brasilia).
 *
 * Regras:
 * - Sem horarios configurados => considera ABERTA (nao bloqueia quem nao configurou).
 * - Janela normal (fechamento > abertura): aberto se abertura <= agora < fechamento.
 * - Janela que cruza a meia-noite (fechamento <= abertura): aberto da abertura ate o
 *   fim do dia E, no dia seguinte, da meia-noite ate o fechamento.
 * - Fechamento "00:00" e tratado como fim do dia (24:00), sem transbordar para o dia seguinte.
 */
export function isAbertoAgora(horarios: Horario[] | null | undefined, now?: Date): boolean {
  if (!horarios || horarios.length === 0) return true;

  const b = nowBrasilia(now);
  const dia = b.getDay();
  const minutosAgora = b.getHours() * 60 + b.getMinutes();

  // 1) Janela do proprio dia
  const hoje = findDia(horarios, dia);
  if (hoje && !hoje.fechado_o_dia_todo) {
    const abertura = toMinutes(hoje.hora_abertura);
    let fechamento = toMinutes(hoje.hora_fechamento);
    if (fechamento === 0) fechamento = 24 * 60; // 00:00 = fim do dia

    if (fechamento > abertura) {
      if (minutosAgora >= abertura && minutosAgora < fechamento) return true;
    } else {
      // Cruza a meia-noite: aberto da abertura ate o fim do dia
      if (minutosAgora >= abertura) return true;
    }
  }

  // 2) Janela do dia ANTERIOR que transborda para depois da meia-noite
  const ontem = findDia(horarios, (dia + 6) % 7);
  if (ontem && !ontem.fechado_o_dia_todo) {
    const abertura = toMinutes(ontem.hora_abertura);
    const fechamento = toMinutes(ontem.hora_fechamento);
    // So transborda se fecha depois da meia-noite (fechamento <= abertura) e nao e "00:00"
    if (fechamento !== 0 && fechamento <= abertura) {
      if (minutosAgora < fechamento) return true;
    }
  }

  return false;
}

/** Gera o ISO local de Brasilia "YYYY-MM-DDTHH:MM:00" para um dado momento. */
export function nowBrasiliaIso(now?: Date): string {
  const b = nowBrasilia(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${b.getFullYear()}-${pad(b.getMonth() + 1)}-${pad(b.getDate())}T${pad(b.getHours())}:${pad(
    b.getMinutes(),
  )}:00`;
}

/**
 * Indica se a loja esta sob fechamento manual ativo.
 *
 * `fechadoManualAte` e um ISO local "YYYY-MM-DDTHH:MM:00" que representa o
 * momento em que o fechamento manual deixa de valer (normalmente a proxima
 * abertura programada). Enquanto agora < esse valor, a loja esta fechada
 * manualmente. Como o formato e fixo e zero-padded, a comparacao de strings
 * equivale a comparacao cronologica.
 */
export function isFechadoManualmente(
  fechadoManualAte: string | null | undefined,
  now?: Date,
): boolean {
  if (!fechadoManualAte) return false;
  return nowBrasiliaIso(now) < fechadoManualAte;
}

/**
 * ISO local de Brasilia do INICIO do proximo dia ("amanha 00:00").
 * Usado como validade padrao da abertura manual: forca a loja aberta ate o
 * fim do dia de hoje (feriado sem horario configurado, evento pontual, etc.).
 */
export function fimDoDiaBrasiliaIso(now?: Date): string {
  const b = nowBrasilia(now);
  b.setDate(b.getDate() + 1);
  b.setHours(0, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${b.getFullYear()}-${pad(b.getMonth() + 1)}-${pad(b.getDate())}T00:00:00`;
}

/**
 * Indica se ha uma ABERTURA manual ativa (botao "Abrir a Loja" acionado fora do
 * horario). Espelha `isFechadoManualmente`: enquanto agora < `abertoManualAte`,
 * a loja esta forcada aberta mesmo que o horario diga o contrario.
 */
export function isAbertoManualmente(
  abertoManualAte: string | null | undefined,
  now?: Date,
): boolean {
  if (!abertoManualAte) return false;
  return nowBrasiliaIso(now) < abertoManualAte;
}

export interface ProximaAbertura {
  /** Data/hora local no formato "YYYY-MM-DDTHH:MM:00" (compativel com o agendamento do carrinho). */
  iso: string;
  /** Texto amigavel, ex.: "hoje às 17:00", "amanhã às 09:00", "sábado às 17:00". */
  label: string;
  /** Hora de abertura "HH:MM". */
  hora: string;
}

/**
 * Calcula a proxima abertura da loja a partir de agora.
 * Retorna null se nao houver horarios configurados ou nenhum dia aberto.
 */
export function getProximaAbertura(
  horarios: Horario[] | null | undefined,
  now?: Date,
): ProximaAbertura | null {
  if (!horarios || horarios.length === 0) return null;

  const b = nowBrasilia(now);
  const dia = b.getDay();
  const minutosAgora = b.getHours() * 60 + b.getMinutes();

  for (let offset = 0; offset < 8; offset++) {
    const d = (dia + offset) % 7;
    const h = findDia(horarios, d);
    if (!h || h.fechado_o_dia_todo) continue;

    const abertura = toMinutes(h.hora_abertura);
    // Hoje, so vale se a abertura ainda nao passou.
    if (offset === 0 && abertura <= minutosAgora) continue;

    const target = new Date(b);
    target.setDate(target.getDate() + offset);
    target.setHours(Math.floor(abertura / 60), abertura % 60, 0, 0);

    const label =
      offset === 0
        ? `hoje às ${h.hora_abertura}`
        : offset === 1
          ? `amanhã às ${h.hora_abertura}`
          : `${DIAS_SEMANA[d]} às ${h.hora_abertura}`;

    const iso = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(
      target.getDate(),
    ).padStart(2, '0')}T${h.hora_abertura}:00`;

    return { iso, label, hora: h.hora_abertura };
  }

  return null;
}

export interface StatusLoja {
  /** True se a loja esta efetivamente aberta. */
  aberto: boolean;
  /** True se ha um fechamento manual ativo no momento. */
  fechadoManual: boolean;
  /** True se ha uma abertura manual ativa (loja forcada aberta fora do horario). */
  abertoManual: boolean;
  /** Proxima abertura quando a loja esta fechada; null se aberta ou sem horarios. */
  proximaAbertura: ProximaAbertura | null;
}

/**
 * Status consolidado da loja, combinando os horarios configurados com dois
 * overrides manuais mutuamente exclusivos:
 *  - Fechamento manual ("Fechar a Loja"): forca FECHADO dentro do horario.
 *  - Abertura manual ("Abrir a Loja"): forca ABERTO fora do horario (feriado,
 *    evento pontual). Expira sozinha ao fim do dia (ver `fimDoDiaBrasiliaIso`).
 *
 * Precedencia: o fechamento manual sempre vence (estado seguro = fechado).
 * Na ausencia dele, a abertura manual abre a loja; sem nenhum override,
 * vale exclusivamente o horario configurado.
 */
export function getStatusLoja(
  horarios: Horario[] | null | undefined,
  fechadoManualAte?: string | null,
  abertoManualAte?: string | null,
  now?: Date,
): StatusLoja {
  const fechadoManual = isFechadoManualmente(fechadoManualAte, now);
  const abertoManual = !fechadoManual && isAbertoManualmente(abertoManualAte, now);

  const aberto = fechadoManual
    ? false
    : abertoManual
      ? true
      : isAbertoAgora(horarios, now);

  const proximaAbertura = aberto ? null : getProximaAbertura(horarios, now);
  return { aberto, fechadoManual, abertoManual, proximaAbertura };
}
