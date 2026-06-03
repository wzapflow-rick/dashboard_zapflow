/**
 * @file lib/funil-config.ts
 * @description Constantes e tipos compartilhados do funil de follow-up.
 *
 * Mantido fora de app/actions/funil.ts porque arquivos "use server" so
 * podem exportar funcoes async — constantes/tipos precisam ficar aqui.
 */

/** Estagios do funil, na ordem em que aparecem no Kanban. */
export const FUNIL_ESTAGIOS = [
  'lead_quente',
  'lead_morno',
  'lead_frio',
  'trial',
  'cliente',
  'perdido',
] as const;

export type FunilEstagio = (typeof FUNIL_ESTAGIOS)[number];

/** Status especial da fila para itens que aguardam aprovacao manual. */
export const STATUS_AGUARDANDO_APROVACAO = 'aguardando_aprovacao';

export interface FunilContato {
  id: number;
  remote_jid: string;
  telefone: string;
  nome: string | null;
  foto_url: string | null;
  estagio: FunilEstagio;
  estagio_desde: string | null;
  empresa_id: number | null;
  kanban_ordem: number;
  score: number;
  ativo: boolean;
  bloqueado: boolean;
  // Computados
  horas_no_estagio?: number;
  proxima_acao?: string | null;
  proxima_acao_em?: string | null;
}

export interface Cadencia {
  id: number;
  estagio: string;
  passo_ordem: number;
  rotulo: string | null;
  offset_horas: number;
  recorrente: boolean;
  intervalo_horas: number | null;
  mensagem_id: number | null;
  modo: 'auto' | 'aprovacao';
  ativo: boolean;
  created_at: string;
  // Joined
  mensagem_nome?: string | null;
  mensagem_conteudo?: string | null;
}

export interface FilaAprovacaoItem {
  id: number;
  contato_id: number;
  mensagem_id: number | null;
  conteudo_final: string;
  tipo_midia: string;
  midia_url: string | null;
  agendado_para: string;
  status: string;
  created_at: string;
  // Joined
  contato_nome?: string | null;
  contato_telefone?: string | null;
  contato_estagio?: string | null;
}
