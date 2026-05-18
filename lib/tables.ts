/**
 * @file lib/tables.ts
 * @description Mapeamento de nomes de tabelas PostgreSQL para o sistema.
 * 
 * Este arquivo centraliza todos os nomes de tabelas do banco de dados,
 * facilitando a migração do NocoDB para PostgreSQL direto.
 */

// ============================================================
// TABELAS PRINCIPAIS DO SISTEMA
// ============================================================

/** Tabela de empresas/lojistas cadastrados na plataforma */
export const EMPRESAS_TABLE = 'empresas';

/** Tabela de usuários internos (atendentes, cozinheiros, gerentes) */
export const USUARIOS_TABLE = 'usuarios';

/** Tabela de pedidos */
export const PEDIDOS_TABLE = 'pedidos';

/** Tabela de clientes finais */
export const CLIENTES_TABLE = 'clientes';

// ============================================================
// CARDÁPIO
// ============================================================

/** Tabela de produtos do cardápio */
export const PRODUTOS_TABLE = 'produtos';

/** Tabela de categorias do cardápio */
export const CATEGORIAS_TABLE = 'categorias';

/** Tabela de grupos de complementos (ex: "Borda", "Adicionais") */
export const GRUPOS_COMPLEMENTOS_TABLE = 'grupos_complementos';

/** Tabela de itens de complemento (ex: "Borda de Cheddar") */
export const COMPLEMENTOS_TABLE = 'complementos';

/** Tabela de vínculo entre produto e grupos de complementos */
export const PRODUTO_GRUPOS_COMPLEMENTOS_TABLE = 'produto_grupos_complementos';

/** Tabela de grupos de slots para produtos compostos */
export const GRUPOS_SLOTS_TABLE = 'grupos_slots';

/** Tabela de itens base para produtos compostos */
export const ITENS_BASE_TABLE = 'itens_base';

/** Tabela de relação item base <-> insumo */
export const ITEM_BASE_INSUMO_TABLE = 'item_base_insumo';

// ============================================================
// ESTOQUE E INSUMOS
// ============================================================

/** Tabela de insumos/ingredientes */
export const INSUMOS_TABLE = 'insumos';

/** Tabela de relação produto <-> insumo (receitas) */
export const PRODUTO_INSUMOS_TABLE = 'produto_insumos';

// ============================================================
// ENTREGADORES
// ============================================================

/** Tabela de entregadores/motoboys */
export const ENTREGADORES_TABLE = 'entregadores';

/** Tabela de comissões dos entregadores */
export const COMISSOES_TABLE = 'comissoes';

/** Tabela de histórico de entregas */
export const HISTORICO_ENTREGAS_TABLE = 'historico_entregas';

// ============================================================
// FIDELIDADE E MARKETING
// ============================================================

/** Tabela de configuração do programa de fidelidade por empresa */
export const LOYALTY_CONFIG_TABLE = 'loyalty_config';

/** Tabela de pontos de fidelidade por cliente */
export const LOYALTY_POINTS_TABLE = 'loyalty_points';

/** Tabela de cupons de desconto */
export const CUPONS_TABLE = 'cupons';

/** Tabela de campanhas automáticas de marketing */
export const CAMPANHAS_TABLE = 'campanhas';

/** Tabela de disparos de campanhas */
export const DISPAROS_TABLE = 'disparos';

// ============================================================
// CONFIGURAÇÕES OPERACIONAIS
// ============================================================

/** Tabela de taxas de entrega por bairro/distância */
export const TAXAS_ENTREGA_TABLE = 'taxas_entrega';

/** Tabela de horários de funcionamento */
export const HORARIOS_TABLE = 'horarios';

/** Tabela de configurações de pagamento (Mercado Pago OAuth) */
export const PAGAMENTOS_CONFIG_TABLE = 'pagamentos_config';

/** Tabela de avaliações de pedidos */
export const AVALIACOES_TABLE = 'avaliacoes';

/** Tabela de configurações extras da loja (logo, etc) */
export const CONFIGURACOES_LOJA_TABLE = 'configuracoes_loja';

/** Tabela de configuração do bot de saudação WhatsApp */
export const BOT_CONFIG_TABLE = 'bot_config';

// ============================================================
// METADADOS DE PRODUTOS
// ============================================================

/** Tabela de metadados de produtos (Upsell, Tamanhos, etc.) */
export const PRODUTOS_METADADOS_TABLE = 'produtos_metadados';

// ============================================================
// ASSINATURAS E FATURAS
// ============================================================

/** Tabela de cadastros pendentes (pos-pagamento) */
export const PENDING_SIGNUPS_TABLE = 'pending_signups';

/** Tabela de assinaturas de planos */
export const ASSINATURAS_TABLE = 'assinaturas';

/** Tabela de faturas de assinaturas */
export const FATURAS_ASSINATURA_TABLE = 'faturas_assinatura';

// ============================================================
// MESAS E COMANDAS (CONSUMO LOCAL)
// ============================================================

/** Tabela de mesas do estabelecimento */
export const MESAS_TABLE = 'mesas';

/** Tabela de comandas (contas individuais por pessoa na mesa) */
export const COMANDAS_TABLE = 'comandas';

// ============================================================
// MAPEAMENTO LEGADO (NocoDB ID -> Nome da tabela)
// ============================================================

/**
 * Mapeamento de IDs de tabela do NocoDB para nomes de tabelas PostgreSQL.
 * Útil durante a migração para manter compatibilidade.
 */
export const NOCODB_TO_PG_TABLE: Record<string, string> = {
  // Principais
  'mp08yd7oaxn5xo2': EMPRESAS_TABLE,
  'msrjfeb28e07cwx': USUARIOS_TABLE,
  'mui7bozvx9zb2n9': PEDIDOS_TABLE,
  'mkodxks6hpm2bg9': CLIENTES_TABLE,
  
  // Cardápio
  'mh81t2xp1uml6pc': PRODUTOS_TABLE,
  'mo5so5g7gvlbwyo': CATEGORIAS_TABLE,
  'm3o1prjcnvi678q': GRUPOS_COMPLEMENTOS_TABLE,
  'mj3ut032mx8zi72': COMPLEMENTOS_TABLE,
  'm6muivyaadyh38c': PRODUTO_GRUPOS_COMPLEMENTOS_TABLE,
  'm1h9jeye8hcd4k6': GRUPOS_SLOTS_TABLE,
  'mfcp67skbxq4nt5': ITENS_BASE_TABLE,
  
  // Estoque
  'mvis2y8mlpwqr9q': INSUMOS_TABLE,
  'mev9fkmt1jaapiv': PRODUTO_INSUMOS_TABLE,
  
  // Entregadores
  'm4hbqkhwu2qvrry': ENTREGADORES_TABLE,
  'me4x6mmfsbndf42': COMISSOES_TABLE,
  'm9lt0hyfnh3c47q': HISTORICO_ENTREGAS_TABLE,
  
  // Fidelidade
  'mjzzdfgdohupgjh': LOYALTY_CONFIG_TABLE,
  'm8slxvm3dp4sup4': LOYALTY_POINTS_TABLE,
  'm5echqy6luac5g6': CUPONS_TABLE,
  
  // Configurações
  'm9yccghg9s23utv': TAXAS_ENTREGA_TABLE,
  'mpaclmaji3b6dla': HORARIOS_TABLE,
  'mlev3jx4tj2x74d': PAGAMENTOS_CONFIG_TABLE,
  'm3ebs9cm1yjgmo1': AVALIACOES_TABLE,
  'mtkx66k8jacnezx': CONFIGURACOES_LOJA_TABLE,
  
  // Metadados
  'm97yi797b432f4q': PRODUTOS_METADADOS_TABLE,
  
  // Assinaturas
  'm1hq56kbk1zhcrp': PENDING_SIGNUPS_TABLE,
  'mhpkvk982298q8a': ASSINATURAS_TABLE,
  
  // Mesas e Comandas
  'mzft45xyoznab9k': MESAS_TABLE,
  'mkpep3jg6ri9d7x': COMANDAS_TABLE,
};
