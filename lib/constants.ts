/**
 * @file lib/constants.ts
 * @description Centralização de todos os IDs de tabelas do NocoDB e constantes globais do sistema.
 *
 * IMPORTANTE: Os IDs de tabela são lidos prioritariamente das variáveis de ambiente.
 * Os valores hardcoded abaixo servem apenas como fallback para desenvolvimento local.
 * Em produção, SEMPRE defina as variáveis de ambiente correspondentes.
 */

// ============================================================
// TABELAS PRINCIPAIS DO SISTEMA
// ============================================================

/** Tabela de empresas/lojistas cadastrados na plataforma */
export const EMPRESAS_TABLE_ID =
  process.env.NOCODB_TABLE_EMPRESAS || 'mp08yd7oaxn5xo2';

/** Tabela de usuários internos (atendentes, cozinheiros, gerentes) */
export const USUARIOS_TABLE_ID =
  process.env.NOCODB_TABLE_USUARIOS || 'msrjfeb28e07cwx';

/** Tabela de pedidos */
export const PEDIDOS_TABLE_ID =
  process.env.NOCODB_TABLE_PEDIDOS || 'mui7bozvx9zb2n9';

/** Tabela de clientes finais */
export const CLIENTES_TABLE_ID =
  process.env.NOCODB_TABLE_CLIENTES || 'mkodxks6hpm2bg9';

// ============================================================
// CARDÁPIO
// ============================================================

/** Tabela de produtos do cardápio */
export const PRODUTOS_TABLE_ID =
  process.env.NOCODB_TABLE_PRODUTOS || 'mh81t2xp1uml6pc';

/** Tabela de categorias do cardápio */
export const CATEGORIAS_TABLE_ID =
  process.env.NOCODB_TABLE_CATEGORIAS || 'mo5so5g7gvlbwyo';

/** Tabela de grupos de complementos (ex: "Borda", "Adicionais") */
export const GRUPOS_COMPLEMENTOS_TABLE_ID =
  process.env.NOCODB_TABLE_GRUPOS_COMPLEMENTOS || 'm3o1prjcnvi678q';

/** Tabela de itens de complemento (ex: "Borda de Cheddar") */
export const COMPLEMENTOS_TABLE_ID =
  process.env.NOCODB_TABLE_COMPLEMENTOS || 'mj3ut032mx8zi72';

/** Tabela de vínculo entre produto e grupos de complementos */
export const PRODUTO_GRUPOS_COMPLEMENTOS_TABLE_ID =
  process.env.NOCODB_TABLE_PRODUTO_GRUPOS_COMPLEMENTOS || 'm6muivyaadyh38c';

/** Tabela de grupos de slots para produtos compostos */
export const GRUPOS_SLOTS_TABLE_ID =
  process.env.NOCODB_TABLE_GRUPOS_SLOTS || 'm1h9jeye8hcd4k6';

/** Tabela de itens base para produtos compostos */
export const ITENS_BASE_TABLE_ID =
  process.env.NOCODB_TABLE_ITENS_BASE || 'mfcp67skbxq4nt5';

/** Tabela de relação item base <-> insumo */
export const ITEM_BASE_INSUMO_TABLE_ID =
  process.env.NOCODB_TABLE_ITEM_BASE_INSUMO || '';

// ============================================================
// ESTOQUE E INSUMOS
// ============================================================

/** Tabela de insumos/ingredientes */
export const INSUMOS_TABLE_ID =
  process.env.NOCODB_TABLE_INSUMOS || 'mvis2y8mlpwqr9q';

/** Tabela de relação produto <-> insumo (receitas) */
export const PRODUTO_INSUMOS_TABLE_ID =
  process.env.NOCODB_TABLE_PRODUTO_INSUMOS || 'mev9fkmt1jaapiv';

// ============================================================
// ENTREGADORES
// ============================================================

/** Tabela de entregadores/motoboys */
export const ENTREGADORES_TABLE_ID =
  process.env.NOCODB_TABLE_ENTREGADORES || 'm4hbqkhwu2qvrry';

/** Tabela de comissões dos entregadores */
export const COMISSOES_TABLE_ID =
  process.env.NOCODB_TABLE_COMISSOES || 'me4x6mmfsbndf42';

/** Tabela de histórico de entregas */
export const HISTORICO_ENTREGAS_TABLE_ID =
  process.env.NOCODB_TABLE_HISTORICO_ENTREGAS || 'm9lt0hyfnh3c47q';

// ============================================================
// FIDELIDADE E MARKETING
// ============================================================

/** Tabela de configuração do programa de fidelidade por empresa */
export const LOYALTY_CONFIG_TABLE_ID =
  process.env.NOCODB_TABLE_LOYALTY_CONFIG || 'mjzzdfgdohupgjh';

/** Tabela de pontos de fidelidade por cliente */
export const LOYALTY_POINTS_TABLE_ID =
  process.env.NOCODB_TABLE_LOYALTY_POINTS || 'm8slxvm3dp4sup4';

/** Tabela de cupons de desconto */
export const CUPONS_TABLE_ID =
  process.env.NOCODB_TABLE_CUPONS || 'm5echqy6luac5g6';

/** Tabela de campanhas automáticas de marketing */
export const CAMPANHAS_TABLE_ID =
  process.env.NOCODB_TABLE_CAMPANHAS || '';

/** Tabela de disparos de campanhas */
export const DISPAROS_TABLE_ID =
  process.env.NOCODB_TABLE_DISPAROS || '';

// ============================================================
// CONFIGURAÇÕES OPERACIONAIS
// ============================================================

/** Tabela de taxas de entrega por bairro/distância */
export const TAXAS_ENTREGA_TABLE_ID =
  process.env.NOCODB_TABLE_TAXAS_ENTREGA || 'm9yccghg9s23utv';

/** Tabela de horários de funcionamento */
export const HORARIOS_TABLE_ID =
  process.env.NOCODB_TABLE_HORARIOS || 'mpaclmaji3b6dla';

/** Tabela de configurações de pagamento (Mercado Pago OAuth) */
export const PAGAMENTOS_CONFIG_TABLE_ID =
  process.env.NOCODB_TABLE_PAGAMENTOS_CONFIG || 'mlev3jx4tj2x74d';

/** Tabela de avaliações de pedidos */
export const AVALIACOES_TABLE_ID =
  process.env.NOCODB_TABLE_AVALIACOES || 'm3ebs9cm1yjgmo1';

/** Tabela de configurações extras da loja (logo, etc) */
export const CONFIGURACOES_LOJA_TABLE_ID =
  process.env.NOCODB_TABLE_CONFIGURACOES_LOJA || 'mtkx66k8jacnezx';

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

/** Tabela de metadados de produtos (Upsell, Tamanhos, etc.) */
export const PRODUTOS_METADADOS_TABLE_ID =
  process.env.NOCODB_TABLE_PRODUTOS_METADADOS || 'm97yi797b432f4q';

// ============================================================
// ASSINATURAS E FATURAS
// ============================================================

/** Tabela de assinaturas de planos */
export const ASSINATURAS_TABLE_ID =
  process.env.NOCODB_TABLE_ASSINATURAS || 'msrjfeb28e07cwx';

/** Tabela de faturas de assinaturas */
export const FATURAS_ASSINATURA_TABLE_ID =
  process.env.NOCODB_TABLE_FATURAS_ASSINATURA || 'mhpkvk982298q8a';

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

export type SubscriptionPlanId = 'iniciante' | 'start' | 'pro' | 'elite';

/** Planos que permitem cardapio online ativo */
export const PAID_PLANS: SubscriptionPlanId[] = ['start', 'pro', 'elite'];

/** Verifica se o plano permite cardapio online */
export function isPaidPlan(plan: string | null | undefined): boolean {
  return PAID_PLANS.includes(plan as SubscriptionPlanId);
}

// ============================================================
// MESAS E COMANDAS (CONSUMO LOCAL)
// ============================================================

/** Tabela de mesas do estabelecimento */
export const MESAS_TABLE_ID =
  process.env.NOCODB_TABLE_MESAS || 'mzft45xyoznab9k';

/** Tabela de comandas (contas individuais por pessoa na mesa) */
export const COMANDAS_TABLE_ID =
  process.env.NOCODB_TABLE_COMANDAS || 'mkpep3jg6ri9d7x';

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
