'use server';

import { getMe } from '@/lib/session-server';
import { pg } from '@/lib/postgres';
import { PEDIDOS_TABLE, PRODUTOS_TABLE } from '@/lib/tables';
import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

// Provider OpenAI usando a chave propria do usuario (OPENAI_API_KEY),
// fora do AI Gateway. Modelo economico para o resumo diario com cache.
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODELO_IA = openai('gpt-4o-mini');

const CACHE_TABLE = 'insights_ia_cache';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
export type TipoAcao = 'campanha' | 'cupom' | 'whatsapp' | 'cardapio' | 'clientes' | 'geral';

export interface ScoreFator {
  label: string;
  impacto: number; // pode ser negativo
}

export interface NegocioScore {
  valor: number; // 0-100
  nivel: 'critico' | 'atencao' | 'saudavel' | 'excelente';
  resumo: string;
  fatores: ScoreFator[];
}

export interface MetricaComparativa {
  atual: number;
  anterior: number;
  variacao: number; // %
}

export interface InsightMetrics {
  faturamentoHoje: number;
  faturamentoOntem: number;
  variacaoFaturamento: number;
  pedidosHoje: number;
  pedidosOntem: number;
  ticketHoje: number;
  ticketOntem: number;
  variacaoTicket: number;
  faturamentoSemana: number;
  faturamentoSemanaAnterior: number;
  variacaoSemana: number;
  pedidosPendentes: number;
  minutosPedidoMaisAntigo: number;
  canceladosHoje: number;
  valorPerdidoHoje: number;
  taxaCancelamento: number; // % sobre pedidos do dia
  topProdutos: { nome: string; qtd: number }[];
  horarioPico: number | null;
  pedidosNoPico: number;
  clientesUnicosSemana: number;
  clientesRecorrentes: number;
  diaForte: string | null;
  diaFraco: string | null;
  temDados: boolean;
}

export interface AnaliseIA {
  saudacao: string;
  resumoDia: string;
  destaquePositivo: string;
  alertas: { titulo: string; descricao: string; gravidade: 'alta' | 'media' | 'baixa' }[];
  oportunidades: { titulo: string; descricao: string; acaoSugerida: string; tipoAcao: TipoAcao }[];
  sugestaoPrincipal: { titulo: string; descricao: string; acaoSugerida: string; tipoAcao: TipoAcao };
  analiseClientes: string;
  fraseMotivacional: string;
}

export interface ZapflowInsightsResult {
  success: boolean;
  nome: string;
  score: NegocioScore;
  metrics: InsightMetrics;
  ai: AnaliseIA | null;
  aiError?: string;
  geradoEm: string;
  doCache: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];

/** Converte um instante para o "relogio de parede" de Brasilia (UTC-3). */
function toBrasilia(date: Date): Date {
  return new Date(date.getTime() - 3 * 60 * 60 * 1000);
}

function parseItens(order: any): any[] {
  try {
    if (typeof order.itens === 'string') return JSON.parse(order.itens);
    if (Array.isArray(order.itens)) return order.itens;
  } catch {
    /* ignora */
  }
  return [];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function variacao(atual: number, anterior: number): number {
  if (anterior <= 0) return atual > 0 ? 100 : 0;
  return Math.round(((atual - anterior) / anterior) * 100);
}

// ---------------------------------------------------------------------------
// Coleta de metricas (deterministica, sem IA)
// ---------------------------------------------------------------------------
async function coletarMetricas(empresaId: number): Promise<InsightMetrics> {
  const ordersData = await pg.list(PEDIDOS_TABLE, {
    where: { empresa_id: empresaId },
    sort: '-id',
    limit: 800,
  });
  const allOrders = ordersData.list || [];

  const now = new Date();
  const nowBr = toBrasilia(now);

  const inicioHoje = new Date(nowBr);
  inicioHoje.setUTCHours(0, 0, 0, 0);
  const inicioOntem = new Date(inicioHoje.getTime() - 24 * 60 * 60 * 1000);
  const inicioSemana = new Date(inicioHoje.getTime() - 7 * 24 * 60 * 60 * 1000);
  const inicioSemanaAnterior = new Date(inicioHoje.getTime() - 14 * 24 * 60 * 60 * 1000);

  const naoCancelado = (o: any) => o.status !== 'cancelado';
  const dataBr = (o: any) => (o.criado_em ? toBrasilia(new Date(o.criado_em)) : null);

  const pedidosHoje = allOrders.filter((o: any) => {
    const d = dataBr(o);
    return d && d >= inicioHoje && naoCancelado(o);
  });
  const pedidosOntem = allOrders.filter((o: any) => {
    const d = dataBr(o);
    return d && d >= inicioOntem && d < inicioHoje && naoCancelado(o);
  });
  const pedidosSemana = allOrders.filter((o: any) => {
    const d = dataBr(o);
    return d && d >= inicioSemana && naoCancelado(o);
  });
  const pedidosSemanaAnterior = allOrders.filter((o: any) => {
    const d = dataBr(o);
    return d && d >= inicioSemanaAnterior && d < inicioSemana && naoCancelado(o);
  });

  const somaValor = (arr: any[]) => arr.reduce((s: number, o: any) => s + Number(o.valor_total || 0), 0);
  const somaFinalizados = (arr: any[]) =>
    arr.filter((o: any) => o.status === 'finalizado').reduce((s: number, o: any) => s + Number(o.valor_total || 0), 0);

  const faturamentoHoje = somaFinalizados(pedidosHoje);
  const faturamentoOntem = somaFinalizados(pedidosOntem);
  const faturamentoSemana = somaFinalizados(pedidosSemana);
  const faturamentoSemanaAnterior = somaFinalizados(pedidosSemanaAnterior);

  const ticketHoje = pedidosHoje.length > 0 ? somaValor(pedidosHoje) / pedidosHoje.length : 0;
  const ticketOntem = pedidosOntem.length > 0 ? somaValor(pedidosOntem) / pedidosOntem.length : 0;

  // Pendentes / preparando
  const pendentes = allOrders.filter((o: any) => o.status === 'pendente' || o.status === 'preparando');
  let minutosPedidoMaisAntigo = 0;
  if (pendentes.length > 0) {
    const maisAntigo = pendentes
      .map((o: any) => Date.now() - new Date(o.criado_em).getTime())
      .sort((a, b) => b - a)[0];
    minutosPedidoMaisAntigo = Math.floor(maisAntigo / (1000 * 60));
  }

  // Cancelados hoje
  const canceladosHojeArr = allOrders.filter((o: any) => {
    const d = dataBr(o);
    return d && d >= inicioHoje && o.status === 'cancelado';
  });
  const valorPerdidoHoje = somaValor(canceladosHojeArr);
  const totalHojeComCancelados = pedidosHoje.length + canceladosHojeArr.length;
  const taxaCancelamento =
    totalHojeComCancelados > 0 ? Math.round((canceladosHojeArr.length / totalHojeComCancelados) * 100) : 0;

  // Top produtos (semana)
  const produtoStats = new Map<string, number>();
  pedidosSemana.forEach((order: any) => {
    parseItens(order).forEach((item: any) => {
      const nome = String(item.produto || item.nome || 'Item').split(' (')[0].trim();
      produtoStats.set(nome, (produtoStats.get(nome) || 0) + Number(item.quantidade || 1));
    });
  });
  const topProdutos = Array.from(produtoStats.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([nome, qtd]) => ({ nome, qtd }));

  // Horario de pico (semana)
  const porHora: Record<number, number> = {};
  pedidosSemana.forEach((o: any) => {
    const d = dataBr(o);
    if (d) porHora[d.getUTCHours()] = (porHora[d.getUTCHours()] || 0) + 1;
  });
  const picoEntry = Object.entries(porHora).sort(([, a], [, b]) => b - a)[0];
  const horarioPico = picoEntry ? Number(picoEntry[0]) : null;
  const pedidosNoPico = picoEntry ? picoEntry[1] : 0;

  // Clientes (semana)
  const telefones = new Map<string, number>();
  pedidosSemana.forEach((o: any) => {
    const tel = o.telefone_cliente;
    if (tel) telefones.set(tel, (telefones.get(tel) || 0) + 1);
  });
  const clientesUnicosSemana = telefones.size;
  const clientesRecorrentes = Array.from(telefones.values()).filter((c) => c >= 2).length;

  // Dia forte / fraco (sobre os pedidos disponiveis)
  const porDia: Record<number, number> = {};
  pedidosSemana.forEach((o: any) => {
    const d = dataBr(o);
    if (d) porDia[d.getUTCDay()] = (porDia[d.getUTCDay()] || 0) + Number(o.valor_total || 0);
  });
  const diasOrdenados = Object.entries(porDia).sort(([, a], [, b]) => b - a);
  const diaForte = diasOrdenados.length > 0 ? DIAS_SEMANA[Number(diasOrdenados[0][0])] : null;
  const diaFraco = diasOrdenados.length > 1 ? DIAS_SEMANA[Number(diasOrdenados[diasOrdenados.length - 1][0])] : null;

  return {
    faturamentoHoje: round2(faturamentoHoje),
    faturamentoOntem: round2(faturamentoOntem),
    variacaoFaturamento: variacao(faturamentoHoje, faturamentoOntem),
    pedidosHoje: pedidosHoje.length,
    pedidosOntem: pedidosOntem.length,
    ticketHoje: round2(ticketHoje),
    ticketOntem: round2(ticketOntem),
    variacaoTicket: variacao(ticketHoje, ticketOntem),
    faturamentoSemana: round2(faturamentoSemana),
    faturamentoSemanaAnterior: round2(faturamentoSemanaAnterior),
    variacaoSemana: variacao(faturamentoSemana, faturamentoSemanaAnterior),
    pedidosPendentes: pendentes.length,
    minutosPedidoMaisAntigo,
    canceladosHoje: canceladosHojeArr.length,
    valorPerdidoHoje: round2(valorPerdidoHoje),
    taxaCancelamento,
    topProdutos,
    horarioPico,
    pedidosNoPico,
    clientesUnicosSemana,
    clientesRecorrentes,
    diaForte,
    diaFraco,
    temDados: pedidosSemana.length > 0 || pedidosHoje.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Score do negocio (deterministico, sem IA)
// ---------------------------------------------------------------------------
function calcularScore(m: InsightMetrics): NegocioScore {
  let valor = 60; // baseline
  const fatores: ScoreFator[] = [];

  const add = (label: string, impacto: number) => {
    valor += impacto;
    if (impacto !== 0) fatores.push({ label, impacto });
  };

  // Tendencia semanal (peso maior)
  if (m.faturamentoSemanaAnterior > 0) {
    const v = m.variacaoSemana;
    const imp = Math.max(-18, Math.min(18, Math.round(v / 3)));
    add(imp >= 0 ? `Faturamento da semana subiu ${v}%` : `Faturamento da semana caiu ${Math.abs(v)}%`, imp);
  }

  // Ticket medio
  if (m.ticketOntem > 0) {
    const imp = Math.max(-8, Math.min(8, Math.round(m.variacaoTicket / 4)));
    add(imp >= 0 ? 'Ticket medio estavel/subindo' : 'Ticket medio caindo', imp);
  }

  // Cancelamentos
  if (m.taxaCancelamento >= 20) add('Taxa de cancelamento alta', -15);
  else if (m.taxaCancelamento >= 10) add('Alguns cancelamentos hoje', -7);
  else if (m.canceladosHoje === 0 && m.pedidosHoje > 0) add('Nenhum cancelamento hoje', 5);

  // Pedidos atrasados
  if (m.minutosPedidoMaisAntigo >= 40) add('Pedido parado ha muito tempo', -10);
  else if (m.minutosPedidoMaisAntigo >= 25) add('Pedido aguardando ha um tempo', -4);

  // Fidelizacao
  if (m.clientesUnicosSemana > 0) {
    const taxaRec = m.clientesRecorrentes / m.clientesUnicosSemana;
    if (taxaRec >= 0.3) add('Boa base de clientes recorrentes', 12);
    else if (taxaRec >= 0.15) add('Clientes recorrentes crescendo', 6);
    else add('Poucos clientes voltando', -6);
  }

  // Volume do dia
  if (m.pedidosHoje > m.pedidosOntem && m.pedidosOntem > 0) add('Mais pedidos que ontem', 4);

  valor = Math.max(0, Math.min(100, Math.round(valor)));

  let nivel: NegocioScore['nivel'] = 'saudavel';
  let resumo = 'Seu negocio esta saudavel.';
  if (valor >= 80) {
    nivel = 'excelente';
    resumo = 'Excelente! Seu delivery esta voando.';
  } else if (valor >= 60) {
    nivel = 'saudavel';
    resumo = 'Tudo sob controle, da pra crescer mais.';
  } else if (valor >= 40) {
    nivel = 'atencao';
    resumo = 'Atencao: alguns pontos precisam de acao.';
  } else {
    nivel = 'critico';
    resumo = 'Alerta: seu negocio precisa de atencao urgente.';
  }

  return { valor, nivel, resumo, fatores: fatores.sort((a, b) => Math.abs(b.impacto) - Math.abs(a.impacto)) };
}

// ---------------------------------------------------------------------------
// Analise com IA (com cache diario no banco)
// ---------------------------------------------------------------------------
const analiseSchema = z.object({
  saudacao: z.string().describe('Saudacao curta e calorosa usando o primeiro nome do dono, ex: "Bom dia, Joao!"'),
  resumoDia: z.string().describe('1 a 2 frases resumindo o que aconteceu no negocio, em linguagem simples de dono de delivery'),
  destaquePositivo: z.string().describe('Uma coisa boa para comemorar hoje/na semana'),
  alertas: z
    .array(
      z.object({
        titulo: z.string(),
        descricao: z.string().describe('O problema e o porque importa, em 1 frase'),
        gravidade: z.enum(['alta', 'media', 'baixa']),
      })
    )
    .describe('Problemas que merecem atencao. Vazio se nao houver.'),
  oportunidades: z
    .array(
      z.object({
        titulo: z.string(),
        descricao: z.string().describe('A oportunidade em 1 frase'),
        acaoSugerida: z.string().describe('Acao pratica e curta, ex: "Criar cupom de 10% para terca"'),
        tipoAcao: z.enum(['campanha', 'cupom', 'whatsapp', 'cardapio', 'clientes', 'geral']),
      })
    )
    .describe('2 a 4 oportunidades de vender mais'),
  sugestaoPrincipal: z
    .object({
      titulo: z.string(),
      descricao: z.string(),
      acaoSugerida: z.string(),
      tipoAcao: z.enum(['campanha', 'cupom', 'whatsapp', 'cardapio', 'clientes', 'geral']),
    })
    .describe('A jogada numero 1 de maior impacto para hoje'),
  analiseClientes: z.string().describe('1 a 2 frases sobre a base de clientes (recorrencia, retencao)'),
  fraseMotivacional: z.string().describe('Frase curta e motivadora para o dono fechar o dia'),
});

function construirPrompt(nome: string, m: InsightMetrics): string {
  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  return [
    `Dono: ${nome}`,
    `--- METRICAS DO DELIVERY ---`,
    `Faturamento hoje: ${fmt(m.faturamentoHoje)} (ontem: ${fmt(m.faturamentoOntem)}, variacao ${m.variacaoFaturamento}%)`,
    `Pedidos hoje: ${m.pedidosHoje} (ontem: ${m.pedidosOntem})`,
    `Ticket medio hoje: ${fmt(m.ticketHoje)} (ontem: ${fmt(m.ticketOntem)}, variacao ${m.variacaoTicket}%)`,
    `Faturamento na semana: ${fmt(m.faturamentoSemana)} (semana anterior: ${fmt(m.faturamentoSemanaAnterior)}, variacao ${m.variacaoSemana}%)`,
    `Pedidos pendentes/preparando: ${m.pedidosPendentes}. Mais antigo aguardando: ${m.minutosPedidoMaisAntigo} min`,
    `Cancelados hoje: ${m.canceladosHoje} (${fmt(m.valorPerdidoHoje)} perdidos, taxa ${m.taxaCancelamento}%)`,
    `Top produtos da semana: ${m.topProdutos.map((p) => `${p.nome} (${p.qtd})`).join(', ') || 'sem dados'}`,
    `Horario de pico: ${m.horarioPico !== null ? m.horarioPico + 'h' : 'sem dados'} (${m.pedidosNoPico} pedidos)`,
    `Clientes unicos na semana: ${m.clientesUnicosSemana}. Recorrentes (2+ pedidos): ${m.clientesRecorrentes}`,
    `Dia mais forte: ${m.diaForte || 'sem dados'}. Dia mais fraco: ${m.diaFraco || 'sem dados'}`,
  ].join('\n');
}

async function gerarAnaliseIA(nome: string, m: InsightMetrics): Promise<AnaliseIA> {
  const primeiroNome = nome?.split(' ')[0] || 'lojista';
  const system =
    'Voce e o ZapFlow, um consultor de delivery especialista e direto, que ajuda donos de restaurantes/hamburguerias a venderem mais. ' +
    'Fale em portugues do Brasil, tom proximo e pratico, como um socio que entende do negocio. ' +
    'Baseie-se APENAS nos numeros fornecidos, nao invente dados. Se houver poucos dados, seja honesto e foque no que da pra fazer. ' +
    'Seja especifico e acionavel: prefira acoes como criar cupom, campanha de WhatsApp, combo no cardapio, recuperar clientes. ' +
    'Nunca use jargao tecnico. Frases curtas.';

  const { output } = await generateText({
    model: MODELO_IA,
    system,
    messages: [
      {
        role: 'user',
        content: `Analise o dia do delivery do ${primeiroNome} e gere o relatorio.\n\n${construirPrompt(nome, m)}`,
      },
    ],
    output: Output.object({ schema: analiseSchema }),
  });

  return output as AnaliseIA;
}

/** Fallback textual quando a IA nao esta disponivel (sem quebrar a pagina). */
function analiseFallback(nome: string, m: InsightMetrics): AnaliseIA {
  const primeiroNome = nome?.split(' ')[0] || 'lojista';
  const alertas: AnaliseIA['alertas'] = [];
  if (m.taxaCancelamento >= 10)
    alertas.push({
      titulo: 'Cancelamentos hoje',
      descricao: `${m.canceladosHoje} pedido(s) cancelado(s), ${m.taxaCancelamento}% do dia.`,
      gravidade: m.taxaCancelamento >= 20 ? 'alta' : 'media',
    });
  if (m.minutosPedidoMaisAntigo >= 25)
    alertas.push({
      titulo: 'Pedido aguardando',
      descricao: `Ha um pedido parado ha ${m.minutosPedidoMaisAntigo} minutos.`,
      gravidade: m.minutosPedidoMaisAntigo >= 40 ? 'alta' : 'media',
    });

  return {
    saudacao: `Ola, ${primeiroNome}!`,
    resumoDia: m.temDados
      ? `Hoje voce fez ${m.pedidosHoje} pedido(s) e faturou R$ ${m.faturamentoHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`
      : 'Ainda nao temos pedidos suficientes para uma analise completa. Assim que as vendas entrarem, os insights aparecem aqui.',
    destaquePositivo:
      m.topProdutos[0] ? `${m.topProdutos[0].nome} e o seu campeao de vendas da semana.` : 'Bora colocar o cardapio pra rodar!',
    alertas,
    oportunidades: [
      {
        titulo: 'Reative quem sumiu',
        descricao: 'Clientes que ja compraram sao o caminho mais barato para vender de novo.',
        acaoSugerida: 'Criar campanha de WhatsApp para clientes inativos',
        tipoAcao: 'campanha',
      },
      {
        titulo: 'Aumente o ticket medio',
        descricao: 'Combos e adicionais elevam o valor de cada pedido.',
        acaoSugerida: 'Criar um combo em destaque no cardapio',
        tipoAcao: 'cardapio',
      },
    ],
    sugestaoPrincipal: {
      titulo: 'Comece pela reativacao',
      descricao: 'Uma campanha para quem parou de comprar costuma trazer o retorno mais rapido.',
      acaoSugerida: 'Criar campanha de recuperacao',
      tipoAcao: 'campanha',
    },
    analiseClientes:
      m.clientesUnicosSemana > 0
        ? `Voce atendeu ${m.clientesUnicosSemana} cliente(s) na semana, ${m.clientesRecorrentes} deles voltaram.`
        : 'Ainda sem dados de clientes nesta semana.',
    fraseMotivacional: 'Cada pedido conta. Bora fazer hoje melhor que ontem!',
  };
}

// ---------------------------------------------------------------------------
// Cache no banco (resiliente: se a tabela nao existir, apenas ignora)
// ---------------------------------------------------------------------------
function hojeRef(): string {
  const d = toBrasilia(new Date());
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

async function lerCache(empresaId: number, dataRef: string): Promise<AnaliseIA | null> {
  try {
    const rows = await pg.raw<{ analise: any }>(
      `SELECT analise FROM "${CACHE_TABLE}" WHERE empresa_id = $1 AND data_ref = $2 LIMIT 1`,
      [empresaId, dataRef]
    );
    if (rows.length === 0) return null;
    const a = rows[0].analise;
    return typeof a === 'string' ? JSON.parse(a) : a;
  } catch (err) {
    console.warn('[ZapflowInsights] Cache indisponivel (leitura):', (err as Error).message);
    return null;
  }
}

async function gravarCache(empresaId: number, dataRef: string, analise: AnaliseIA): Promise<void> {
  try {
    await pg.raw(
      `INSERT INTO "${CACHE_TABLE}" (empresa_id, data_ref, analise)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (empresa_id, data_ref)
       DO UPDATE SET analise = EXCLUDED.analise, criado_em = now()`,
      [empresaId, dataRef, JSON.stringify(analise)]
    );
  } catch (err) {
    console.warn('[ZapflowInsights] Cache indisponivel (gravacao):', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Action principal
// ---------------------------------------------------------------------------
export async function getZapflowInsights(forceRefresh = false): Promise<ZapflowInsightsResult> {
  try {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Nao autorizado');

    const metrics = await coletarMetricas(user.empresaId);
    const score = calcularScore(metrics);

    let ai: AnaliseIA | null = null;
    let aiError: string | undefined;
    let doCache = false;
    const dataRef = hojeRef();

    // 1) tenta cache do dia
    if (!forceRefresh) {
      ai = await lerCache(user.empresaId, dataRef);
      if (ai) doCache = true;
    }

    // 2) gera com IA se nao houver cache
    if (!ai) {
      if (!process.env.OPENAI_API_KEY) {
        aiError = 'OPENAI_API_KEY nao configurada';
        ai = analiseFallback(user.nome, metrics);
      } else {
        try {
          ai = await gerarAnaliseIA(user.nome, metrics);
          await gravarCache(user.empresaId, dataRef, ai);
        } catch (err) {
          console.error('[ZapflowInsights] Falha na IA:', err);
          aiError = 'Nao foi possivel gerar a analise com IA agora.';
          ai = analiseFallback(user.nome, metrics);
        }
      }
    }

    return {
      success: true,
      nome: user.nome,
      score,
      metrics,
      ai,
      aiError,
      geradoEm: new Date().toISOString(),
      doCache,
    };
  } catch (error: any) {
    console.error('[ZapflowInsights] Erro:', error);
    return {
      success: false,
      nome: '',
      score: { valor: 0, nivel: 'critico', resumo: '', fatores: [] },
      metrics: {} as InsightMetrics,
      ai: null,
      geradoEm: new Date().toISOString(),
      doCache: false,
      error: error?.message ?? 'Falha ao carregar insights.',
    };
  }
}

// ---------------------------------------------------------------------------
// Chat: "Pergunte ao ZapFlow" (restrito ao negocio)
// ---------------------------------------------------------------------------
export async function perguntarAoZapflow(
  pergunta: string,
  historico: { role: 'user' | 'assistant'; content: string }[] = []
): Promise<{ success: boolean; resposta: string; error?: string }> {
  try {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Nao autorizado');
    if (!pergunta?.trim()) return { success: false, resposta: '', error: 'Pergunta vazia' };

    if (!process.env.OPENAI_API_KEY) {
      return {
        success: false,
        resposta: 'A IA nao esta configurada no momento. Tente novamente mais tarde.',
        error: 'OPENAI_API_KEY nao configurada',
      };
    }

    const metrics = await coletarMetricas(user.empresaId);
    const system =
      'Voce e o ZapFlow, consultor de delivery do dono deste restaurante. ' +
      'Responda SOMENTE sobre o negocio de delivery/restaurante, vendas, cardapio, clientes, marketing e operacao. ' +
      'Se perguntarem algo fora desse contexto, redirecione gentilmente para o negocio. ' +
      'Use os numeros abaixo como base e seja pratico, curto e direto. Portugues do Brasil.\n\n' +
      construirPrompt(user.nome, metrics);

    const recente = historico.slice(-6);
    const { text } = await generateText({
      model: MODELO_IA,
      system,
      messages: [...recente, { role: 'user', content: pergunta.trim() }],
    });

    return { success: true, resposta: text };
  } catch (error: any) {
    console.error('[ZapflowInsights] Erro no chat:', error);
    return { success: false, resposta: '', error: error?.message ?? 'Falha ao responder.' };
  }
}
