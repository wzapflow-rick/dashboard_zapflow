/**
 * @file lib/constants.ts
 * @description Constantes globais do sistema ZapFlow.
 *
 * NOTA: Os nomes de tabelas PostgreSQL estão centralizados em lib/tables.ts
 */

// ============================================================
// RATE LIMITING - CONFIGURAÇÕES GLOBAIS
// ============================================================

export const RATE_LIMIT = {
  /** Máximo de tentativas de login por janela de tempo */
  LOGIN_MAX_ATTEMPTS: 5,
  /** Janela de tempo para rate limit de login (15 minutos em ms) */
  LOGIN_WINDOW_MS: 15 * 60 * 1000,
  /** Máximo de atualizações de pedido por minuto */
  ORDER_UPDATE_MAX: 30,
  /** Janela de tempo para rate limit de pedidos (1 minuto em ms) */
  ORDER_UPDATE_WINDOW_MS: 60 * 1000,
} as const;

// ============================================================
// STATUS DE PEDIDOS
// ============================================================

export const ORDER_STATUS = {
  PENDENTE: 'pendente',
  CONFIRMADO: 'confirmado',
  PREPARANDO: 'preparando',
  PRONTO: 'pronto',
  SAIU_ENTREGA: 'saiu_entrega',
  ENTREGUE: 'entregue',
  FINALIZADO: 'finalizado',
  CANCELADO: 'cancelado',
} as const;

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

// ============================================================
// STATUS DE ENTREGADORES
// ============================================================

export const DRIVER_STATUS = {
  DISPONIVEL: 'disponivel',
  OCUPADO: 'ocupado',
  OFFLINE: 'offline',
} as const;

export type DriverStatus = typeof DRIVER_STATUS[keyof typeof DRIVER_STATUS];

// ============================================================
// PLANOS DISPONÍVEIS
// ============================================================

export const SUBSCRIPTION_PLANS = {
  INICIANTE: {
    id: 'iniciante',
    name: 'Iniciante',
    price: 0,
    description: 'Configure sua loja antes de escolher um plano.',
    trial: true,
    features: [
      'Acesso ao painel de configuracao',
      'Cadastro de produtos',
      'Configuracao do cardapio',
      'Cardapio online bloqueado ate assinar',
    ],
  },
  PARCERIA: {
    id: 'parceria',
    name: 'Parceria',
    price: 0,
    convertPrice: 29.90, // Preco promocional para conversao do trial
    description: 'Teste gratis por 7 dias com acesso total!',
    trial: true,
    trialDays: 7,
    convertTo: 'start', // Plano para converter apos o trial
    features: [
      'Cardapio digital (Link + QrCode)',
      'Painel Kanban com notificacao no WhatsApp',
      'Pix + Cartoes',
      'Taxa de entregas calculada pelo Google Maps',
      'Agente de IA no WhatsApp',
      'Cupons de desconto',
      '7 dias gratis - Acesso total',
    ],
  },
  START: {
    id: 'start',
    name: 'Start',
    price: 79.90,
    promoPrice: 29.90, // Preco promocional para quem veio do trial Parceria
    description: 'Perfeito para comecar sua jornada no delivery.',
    features: [
      'Cardapio digital (Link + QrCode)',
      'Painel Kanban basico',
      'Pix + Cartoes',
      'Taxa Fixa por bairro',
      'Suporte por email',
    ],
  },
  PRO: {
    id: 'pro',
    name: 'PRO',
    price: 149.90,
    description: 'O plano ideal para escalar suas vendas.',
    popular: true,
    features: [
      'Cardapio digital (Link + QrCode)',
      'Painel Kanban com notificacao no WhatsApp',
      'Pix + Cartoes',
      'Taxa de entregas calculada pelo Google Maps',
      'Agente de IA no WhatsApp',
      'Cupons de desconto',
    ],
  },
  ELITE: {
    id: 'elite',
    name: 'ELITE',
    price: 297.90,
    description: 'Solucao completa para operacoes avancadas.',
    features: [
      'Cardapio digital com Customizacao Total (Link + QrCode)',
      'Painel Kanban com notificacao no WhatsApp',
      'Pix + Cartoes',
      'App para os entregadores',
      'Agente de IA no WhatsApp',
      'Cupons de desconto e Programa de pontos',
      'Relatorios de Performance',
    ],
  },
} as const;

export type SubscriptionPlanId = 'iniciante' | 'parceria' | 'start' | 'pro' | 'elite';

/** Planos que permitem cardapio online ativo (incluindo codigos curtos do banco) */
export const PAID_PLANS = ['parceria', 'pcr', 'start', 'sta', 'pro', 'elite', 'eli'];

/** Mapeia codigos curtos para nomes completos */
export function normalizePlanName(plan: string | null | undefined): string {
  const map: Record<string, string> = {
    'pcr': 'parceria',
    'sta': 'start',
    'eli': 'elite',
  };
  return map[plan || ''] || plan || 'iniciante';
}

/** Verifica se o plano permite cardapio online */
export function isPaidPlan(plan: string | null | undefined): boolean {
  return PAID_PLANS.includes(plan || '');
}

/** Verifica se o plano e um trial (parceria) */
export function isTrialPlan(plan: string | null | undefined): boolean {
  return plan === 'parceria' || plan === 'pcr';
}

/** Calcula dias restantes do trial */
export function getTrialDaysRemaining(dataInicio: string | Date | null | undefined): number {
  if (!dataInicio) return 7; // Se nao tem data, assume que acabou de comecar
  const inicio = new Date(dataInicio);
  if (isNaN(inicio.getTime())) return 7; // Data invalida, assume que acabou de comecar
  const agora = new Date();
  const diffTime = agora.getTime() - inicio.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const trialDays = SUBSCRIPTION_PLANS.PARCERIA.trialDays;
  return Math.max(0, trialDays - diffDays);
}

/** Verifica se deve mostrar aviso de conversao (apenas dia 6 e 7) */
export function shouldShowTrialWarning(dataInicio: string | Date | null | undefined): boolean {
  if (!dataInicio) return false; // Sem data de inicio, nao mostrar
  const inicio = new Date(dataInicio);
  if (isNaN(inicio.getTime())) return false; // Data invalida, nao mostrar
  const remaining = getTrialDaysRemaining(dataInicio);
  return remaining <= 1; // Mostrar no dia 6 (1 dia restante) ou dia 7 (0 dias)
}

// ============================================================
// STATUS DE MESAS
// ============================================================

export const MESA_STATUS = {
  LIVRE: 'livre',
  OCUPADA: 'ocupada',
  RESERVADA: 'reservada',
} as const;

export type MesaStatus = typeof MESA_STATUS[keyof typeof MESA_STATUS];

// ============================================================
// STATUS DE COMANDAS
// ============================================================

export const COMANDA_STATUS = {
  ABERTA: 'aberta',
  FECHADA: 'fechada',
  PAGA: 'paga',
} as const;

export type ComandaStatus = typeof COMANDA_STATUS[keyof typeof COMANDA_STATUS];

// ============================================================
// TIPOS DE ENTREGA (ATUALIZADO COM MESA)
// ============================================================

export const DELIVERY_TYPE = {
  DELIVERY: 'delivery',
  RETIRADA: 'retirada',
  MESA: 'mesa',
} as const;

export type DeliveryType = typeof DELIVERY_TYPE[keyof typeof DELIVERY_TYPE];
