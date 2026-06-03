/**
 * @file lib/tables.ts
 * @description Mapeamento de nomes de tabelas PostgreSQL para o sistema.
 * 
 * Este arquivo centraliza todos os nomes de tabelas do banco de dados.
 * Todas as operações de banco usam estas constantes via lib/postgres.ts
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
export const COMISSOES_TABLE = 'comissoes_entregadores';

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
export const CAMPANHAS_TABLE = 'campanhas_config';

/** Tabela de disparos de campanhas */
export const DISPAROS_TABLE = 'campanhas_disparos';

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

/** Tabela de configurações de entrega */
export const CONFIGURACOES_ENTREGA_TABLE = 'configuracoes_entrega';

/** Tabela de endereços dos clientes */
export const CLIENTE_ENDERECOS_TABLE = 'cliente_enderecos';

/** Tabela de cupons da plataforma */
export const CUPONS_PLATAFORMA_TABLE = 'cupons_plataforma';

/** Tabela de histórico de pontos de fidelidade */
export const LOYALTY_HISTORY_TABLE = 'loyalty_history';

/** Tabela de acertos com entregadores */
export const ACERTOS_ENTREGADORES_TABLE = 'acertos_entregadores';

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
// REMARKETING CRM
// ============================================================

/** Tabela de configuracoes gerais do remarketing */
export const REMARKETING_CONFIG_TABLE = 'remarketing_config';

/** Tabela de categorias de remarketing */
export const REMARKETING_CATEGORIAS_TABLE = 'remarketing_categorias';

/** Tabela de tipos de dor (saudade, oferta, etc) */
export const REMARKETING_TIPOS_DOR_TABLE = 'remarketing_tipos_dor';

/** Tabela de etiquetas manuais */
export const REMARKETING_ETIQUETAS_TABLE = 'remarketing_etiquetas';

/** Tabela de templates de mensagem */
export const REMARKETING_MENSAGENS_TABLE = 'remarketing_mensagens';

/** Tabela de combinacoes categoria + tipo_dor + mensagem */
export const REMARKETING_COMBINACOES_TABLE = 'remarketing_mensagens_combinacoes';

/** Tabela de contatos do remarketing */
export const REMARKETING_CONTATOS_TABLE = 'remarketing_contatos';

/** Tabela de relacao contato <-> etiquetas */
export const REMARKETING_CONTATOS_ETIQUETAS_TABLE = 'remarketing_contatos_etiquetas';

/** Tabela de relacao contato <-> categorias */
export const REMARKETING_CONTATOS_CATEGORIAS_TABLE = 'remarketing_contatos_categorias';

/** Tabela de fila de disparos */
export const REMARKETING_FILA_TABLE = 'remarketing_fila';

/** Tabela de historico de acoes */
export const REMARKETING_HISTORICO_TABLE = 'remarketing_historico';

// ============================================================
// FUNIL / CADENCIAS (sistema de follow-up)
// ============================================================

/** Tabela de cadencias do funil (passos automaticos por estagio) */
export const REMARKETING_CADENCIAS_TABLE = 'remarketing_cadencias';

/** Tabela de controle de envios de cadencia (anti-duplicidade) */
export const REMARKETING_CADENCIA_ENVIOS_TABLE = 'remarketing_cadencia_envios';
