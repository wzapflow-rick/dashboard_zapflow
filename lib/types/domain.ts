/**
 * Formato das linhas do Postgres usadas pelas server actions.
 * Colunas numéricas (NUMERIC) chegam do driver `pg` como string, por isso
 * valores monetários aceitam `number | string` e são sempre lidos com Number().
 */

export type Id = number | string;
export type Numeric = number | string;

export type PedidoStatus =
  | 'pendente'
  | 'preparando'
  | 'pronto'
  | 'saiu_entrega'
  | 'aguardando_pagamento'
  | 'finalizado'
  | 'cancelado';

export interface ComplementoPedido {
  id?: Id;
  nome?: string;
  grupo_id?: number;
  fator_proporcao?: number | null;
  tipo_calculo?: string;
  cobrar_mais_caro?: boolean;
  preco?: Numeric;
  [key: string]: unknown;
}

export interface PedidoItem {
  id?: Id;
  produto?: string;
  nome?: string;
  quantidade?: Numeric;
  preco_unitario?: Numeric;
  subtotal?: Numeric;
  isComposite?: boolean;
  isExtra?: boolean;
  tipo_calculo?: string;
  cobrar_mais_caro?: boolean;
  complements?: ComplementoPedido[];
  adicionais?: ComplementoPedido[];
  [key: string]: unknown;
}

export interface PedidoRow {
  id: number;
  empresa_id: Id;
  status: string;
  valor_total: Numeric | null;
  criado_em: string | Date | null;
  telefone_cliente: string | null;
  cliente_nome?: string | null;
  endereco_entrega?: string | null;
  bairro_entrega?: string | null;
  tipo_entrega?: string | null;
  entregador_id?: Id | null;
  itens: string | PedidoItem[] | null;
  cupom_id?: Id | null;
  canal?: string | null;
  observacoes?: string | null;
}

export interface ClienteRow {
  id: number;
  empresa_id: Id;
  nome: string | null;
  telefone: string | null;
  ultima_compra?: string | Date | null;
  criado_em?: string | Date | null;
  [key: string]: unknown;
}

export interface EntregadorRow {
  id: number;
  empresa_id: Id;
  nome: string | null;
  telefone: string | null;
  veiculo?: string | null;
}

export interface EmpresaEstoqueRow {
  id: number;
  controle_estoque?: boolean | number | string | null;
}

/** Converte o campo `itens` (JSON em texto ou array) em lista, sem lançar erro. */
export function parsePedidoItens(itens: PedidoRow['itens']): PedidoItem[] {
  if (!itens) return [];
  if (Array.isArray(itens)) return itens;
  try {
    const parsed: unknown = JSON.parse(itens);
    return Array.isArray(parsed) ? (parsed as PedidoItem[]) : [];
  } catch {
    return [];
  }
}

export function isControleEstoqueAtivo(company: EmpresaEstoqueRow | null): boolean {
  const flag = company?.controle_estoque;
  return flag === true || flag === 1 || String(flag).toLowerCase() === 'true';
}
