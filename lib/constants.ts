/**
 * @file lib/constants.ts
 * @description Constantes globais do sistema ZapFlow.
 * 
 * NOTA: O sistema agora usa PostgreSQL diretamente.
 * Os TABLE_IDs sao nomes de tabelas PostgreSQL.
 */

// ============================================================
// TABELAS PRINCIPAIS DO SISTEMA
// ============================================================

export const EMPRESAS_TABLE_ID = 'empresas';
export const USUARIOS_TABLE_ID = 'usuarios';
export const PEDIDOS_TABLE_ID = 'pedidos';
export const CLIENTES_TABLE_ID = 'clientes';

// ============================================================
// CARDAPIO
// ============================================================

export const PRODUTOS_TABLE_ID = 'produtos';
export const CATEGORIAS_TABLE_ID = 'categorias';
export const GRUPOS_COMPLEMENTOS_TABLE_ID = 'grupos_complementos';
export const COMPLEMENTOS_TABLE_ID = 'complementos';
export const PRODUTO_GRUPOS_COMPLEMENTOS_TABLE_ID = 'produto_grupos_complementos';
export const GRUPOS_SLOTS_TABLE_ID = 'grupos_slots';
export const ITENS_BASE_TABLE_ID = 'itens_base';
export const ITEM_BASE_INSUMO_TABLE_ID = 'item_base_insumo';

// ============================================================
// ESTOQUE E INSUMOS
// ============================================================

export const INSUMOS_TABLE_ID = 'insumos';
export const PRODUTO_INSUMOS_TABLE_ID = 'produto_insumos';

// ============================================================
// ENTREGADORES
// ============================================================

export const ENTREGADORES_TABLE_ID = 'entregadores';
export const COMISSOES_TABLE_ID = 'comissoes_entregadores';
export const HISTORICO_ENTREGAS_TABLE_ID = 'historico_entregas';
export const ACERTOS_TABLE_ID = 'acertos_entregadores';

// ============================================================
// FIDELIDADE E MARKETING
// ============================================================

export const LOYALTY_CONFIG_TABLE_ID = 'loyalty_config';
export const LOYALTY_POINTS_TABLE_ID = 'loyalty_points';
export const CUPONS_TABLE_ID = 'cupons';
export const CUPONS_PLATAFORMA_TABLE_ID = 'cupons_plataforma';
export const CAMPANHAS_TABLE_ID = 'campanhas_config';
export const DISPAROS_TABLE_ID = 'campanhas_disparos';

// ============================================================
// CONFIGURACOES OPERACIONAIS
// ============================================================

export const TAXAS_ENTREGA_TABLE_ID = 'taxas_entrega';
export const HORARIOS_TABLE_ID = 'horarios';
export const PAGAMENTOS_CONFIG_TABLE_ID = 'pagamentos_config';
export const AVALIACOES_TABLE_ID = 'avaliacoes';
export const CONFIGURACOES_LOJA_TABLE_ID = 'configuracoes_loja';
export const CONFIGURACOES_ENTREGA_TABLE_ID = 'configuracoes_entrega';
export const CLIENTE_ENDERECOS_TABLE_ID = 'cliente_enderecos';

// ============================================================
// METADADOS E BOT
// ============================================================

export const PRODUTOS_METADADOS_TABLE_ID = 'produtos_metadados';
export const BOT_CONFIG_TABLE_ID = 'bot_config';

// ============================================================
// ASSINATURAS E FATURAS
// ============================================================

export const PENDING_SIGNUPS_TABLE_ID = 'pending_signups';
export const ASSINATURAS_TABLE_ID = 'assinaturas';
export const FATURAS_ASSINATURA_TABLE_ID = 'faturas_assinatura';

// ============================================================
// MESAS E COMANDAS
// ============================================================

export const MESAS_TABLE_ID = 'mesas';
export const COMANDAS_TABLE_ID = 'comandas';

// ============================================================
// RATE LIMITING - CONFIGURACOES GLOBAIS
// ============================================================

export const RATE_LIMIT = {
  LOGIN_MAX_ATTEMPTS: 5,
  LOGIN_WINDOW_MS: 15 * 60 * 1000,
  ORDER_UPDATE_MAX: 30,
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
// TIPOS DE ENTREGA
// ============================================================

export const DELIVERY_TYPE = {
  DELIVERY: 'delivery',
  RETIRADA: 'retirada',
  MESA: 'mesa',
} as const;

export type DeliveryType = typeof DELIVERY_TYPE[keyof typeof DELIVERY_TYPE];

// ============================================================
// PLANOS DISPONIVEIS
// ============================================================

export const SUBSCRIPTION_PLANS = {
  PARCERIA: {
    id: 'parceria',
    name: 'Parceria',
    price: 29.90,
    description: '7 dias gratis para testar todas as funcoes.',
    trialDays: 7,
    features: [
      'Cardapio digital (Link + QrCode)',
      'Painel Kanban com notificacao WhatsApp',
      'Pix + Cartoes (pagamento online)',
      'Taxa de entregas pelo Google Maps',
      'Agente de IA no WhatsApp',
      'Cupons de desconto',
      'Acesso total a todas as funcoes',
    ],
  },
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
  START: {
    id: 'start',
    name: 'Start',
    price: 79.90,
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

export type SubscriptionPlanId = 'parceria' | 'iniciante' | 'start' | 'pro' | 'elite';

export const PAID_PLANS: SubscriptionPlanId[] = ['parceria', 'start', 'pro', 'elite'];

export function isPaidPlan(plan: string | null | undefined): boolean {
  return PAID_PLANS.includes(plan as SubscriptionPlanId);
}
