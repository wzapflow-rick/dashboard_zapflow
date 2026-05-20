'use server';

import { revalidatePath } from 'next/cache';
import { getMe, requireRole } from '@/lib/session-server';
import { query } from '@/lib/db';
import {
  MESA_STATUS,
  COMANDA_STATUS,
} from '@/lib/constants';

// ============================================================
// TIPOS
// ============================================================

export interface Mesa {
  id: number;
  store_id: string;
  numero: number;
  nome?: string;
  capacidade?: number;
  status: 'livre' | 'ocupada' | 'reservada';
  qr_code?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Comanda {
  id: number;
  mesa_id: number;
  store_id: string;
  nome_cliente?: string;
  status: 'aberta' | 'fechada' | 'paga';
  total?: number;
  created_at?: string;
  closed_at?: string;
}

export interface MesaComDetalhes extends Mesa {
  comandas: ComandaComPedidos[];
  total_mesa: number;
}

export interface ComandaComPedidos extends Comanda {
  pedidos: any[];
}

// ============================================================
// MESAS - CRUD
// ============================================================

export async function getMesas(): Promise<Mesa[]> {
  try {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');

    const result = await query(
      `SELECT * FROM mesas WHERE store_id = $1 ORDER BY numero ASC LIMIT 100`,
      [String(user.empresaId)]
    );

    return result.rows || [];
  } catch (error) {
    console.error('Erro ao buscar mesas:', error);
    return [];
  }
}

export async function getMesaById(id: number): Promise<Mesa | null> {
  try {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');

    const result = await query(
      `SELECT * FROM mesas WHERE id = $1 AND store_id = $2`,
      [id, String(user.empresaId)]
    );
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('Erro ao buscar mesa:', error);
    return null;
  }
}

export async function createMesa(data: {
  numero: number;
  nome?: string;
  capacidade?: number;
}): Promise<Mesa> {
  const user = await requireRole(['admin', 'gerente', 'atendente']);

  // Verificar se já existe mesa com esse número
  const existingResult = await query(
    `SELECT id FROM mesas WHERE store_id = $1 AND numero = $2`,
    [String(user.empresaId), data.numero]
  );

  if (existingResult.rows.length > 0) {
    throw new Error(`Já existe uma mesa com o número ${data.numero}`);
  }

  const result = await query(
    `INSERT INTO mesas (store_id, numero, nome, capacidade, status, qr_code)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [String(user.empresaId), data.numero, data.nome || null, data.capacidade || null, MESA_STATUS.LIVRE, `mesa_${user.empresaId}_${data.numero}_${Date.now()}`]
  );

  revalidatePath('/dashboard/mesas');
  return result.rows[0];
}

export async function updateMesa(
  id: number,
  data: Partial<Pick<Mesa, 'numero' | 'nome' | 'capacidade' | 'status' | 'qr_code'>>
): Promise<Mesa> {
  const user = await requireRole(['admin', 'gerente', 'atendente']);

  const mesaResult = await query(
    `SELECT * FROM mesas WHERE id = $1 AND store_id = $2`,
    [id, String(user.empresaId)]
  );
  
  if (!mesaResult.rows[0]) throw new Error('Mesa não encontrada');

  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.numero !== undefined) { updates.push(`numero = $${paramIndex}`); params.push(data.numero); paramIndex++; }
  if (data.nome !== undefined) { updates.push(`nome = $${paramIndex}`); params.push(data.nome); paramIndex++; }
  if (data.capacidade !== undefined) { updates.push(`capacidade = $${paramIndex}`); params.push(data.capacidade); paramIndex++; }
  if (data.status !== undefined) { updates.push(`status = $${paramIndex}`); params.push(data.status); paramIndex++; }
  if (data.qr_code !== undefined) { updates.push(`qr_code = $${paramIndex}`); params.push(data.qr_code); paramIndex++; }

  params.push(id);

  const result = await query(
    `UPDATE mesas SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  revalidatePath('/dashboard/mesas');
  return result.rows[0];
}

export async function deleteMesa(id: number): Promise<void> {
  const user = await requireRole(['admin', 'gerente']);

  const mesaResult = await query(
    `SELECT * FROM mesas WHERE id = $1 AND store_id = $2`,
    [id, String(user.empresaId)]
  );
  
  if (!mesaResult.rows[0]) throw new Error('Mesa não encontrada');

  // Verificar se há comandas abertas
  const comandasAbertas = await query(
    `SELECT id FROM comandas WHERE mesa_id = $1 AND status = $2 LIMIT 1`,
    [id, COMANDA_STATUS.ABERTA]
  );

  if (comandasAbertas.rows.length > 0) {
    throw new Error('Não é possível excluir mesa com comandas abertas');
  }

  await query(`DELETE FROM mesas WHERE id = $1`, [id]);

  revalidatePath('/dashboard/mesas');
}

// ============================================================
// COMANDAS - CRUD
// ============================================================

export async function getComandasByMesa(mesaId: number): Promise<Comanda[]> {
  try {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');

    const result = await query(
      `SELECT * FROM comandas WHERE mesa_id = $1 AND store_id = $2 ORDER BY id DESC LIMIT 100`,
      [mesaId, String(user.empresaId)]
    );

    return result.rows || [];
  } catch (error) {
    console.error('Erro ao buscar comandas:', error);
    return [];
  }
}

export async function getComandasAbertas(): Promise<Comanda[]> {
  try {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');

    const result = await query(
      `SELECT * FROM comandas WHERE store_id = $1 AND status = $2 ORDER BY id DESC LIMIT 100`,
      [String(user.empresaId), COMANDA_STATUS.ABERTA]
    );

    return result.rows || [];
  } catch (error) {
    console.error('Erro ao buscar comandas abertas:', error);
    return [];
  }
}

export async function createComanda(data: {
  mesa_id: number;
  nome_cliente?: string;
}): Promise<Comanda> {
  const user = await requireRole(['admin', 'gerente', 'atendente']);

  // Verificar se a mesa existe e pertence à empresa
  const mesaResult = await query(
    `SELECT * FROM mesas WHERE id = $1 AND store_id = $2`,
    [data.mesa_id, String(user.empresaId)]
  );
  const mesa = mesaResult.rows[0];
  
  if (!mesa) throw new Error('Mesa não encontrada');

  const result = await query(
    `INSERT INTO comandas (mesa_id, store_id, nome_cliente, status, total)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.mesa_id, String(user.empresaId), data.nome_cliente || null, COMANDA_STATUS.ABERTA, 0]
  );

  // Atualizar status da mesa para ocupada
  if (mesa.status === MESA_STATUS.LIVRE) {
    await query(
      `UPDATE mesas SET status = $1 WHERE id = $2`,
      [MESA_STATUS.OCUPADA, mesa.id]
    );
  }

  revalidatePath('/dashboard/mesas');
  return result.rows[0];
}

export async function updateComanda(
  id: number,
  data: Partial<Pick<Comanda, 'nome_cliente' | 'status' | 'total'>>
): Promise<Comanda> {
  const user = await requireRole(['admin', 'gerente', 'atendente']);

  const comandaResult = await query(
    `SELECT * FROM comandas WHERE id = $1 AND store_id = $2`,
    [id, String(user.empresaId)]
  );
  const comanda = comandaResult.rows[0];
  
  if (!comanda) throw new Error('Comanda não encontrada');

  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.nome_cliente !== undefined) { updates.push(`nome_cliente = $${paramIndex}`); params.push(data.nome_cliente); paramIndex++; }
  if (data.status !== undefined) { updates.push(`status = $${paramIndex}`); params.push(data.status); paramIndex++; }
  if (data.total !== undefined) { updates.push(`total = $${paramIndex}`); params.push(data.total); paramIndex++; }

  // Se está fechando ou marcando como paga, adicionar data de fechamento
  if (data.status && data.status !== COMANDA_STATUS.ABERTA) {
    updates.push(`closed_at = $${paramIndex}`);
    params.push(new Date().toISOString());
    paramIndex++;
  }

  params.push(id);

  const result = await query(
    `UPDATE comandas SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  // Verificar se deve liberar a mesa
  if (data.status === COMANDA_STATUS.PAGA) {
    await verificarELiberarMesa(comanda.mesa_id);
  }

  revalidatePath('/dashboard/mesas');
  revalidatePath('/dashboard/expedition');
  return result.rows[0];
}

async function verificarELiberarMesa(mesaId: number): Promise<void> {
  // Verificar se ainda há comandas abertas na mesa
  const comandasAbertas = await query(
    `SELECT id FROM comandas WHERE mesa_id = $1 AND status = $2 LIMIT 1`,
    [mesaId, COMANDA_STATUS.ABERTA]
  );

  if (comandasAbertas.rows.length === 0) {
    // Não há mais comandas abertas, liberar mesa
    await query(
      `UPDATE mesas SET status = $1 WHERE id = $2`,
      [MESA_STATUS.LIVRE, mesaId]
    );
  }
}

// ============================================================
// MESAS COM DETALHES (para visualização)
// ============================================================

export async function getMesasComDetalhes(): Promise<MesaComDetalhes[]> {
  try {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');

    // Buscar mesas
    const mesasResult = await query(
      `SELECT * FROM mesas WHERE store_id = $1 ORDER BY numero ASC LIMIT 100`,
      [String(user.empresaId)]
    );
    const mesas = mesasResult.rows || [];

    if (mesas.length === 0) return [];

    // Buscar todas as comandas abertas
    const comandasResult = await query(
      `SELECT * FROM comandas WHERE store_id = $1 AND status = $2 LIMIT 500`,
      [String(user.empresaId), COMANDA_STATUS.ABERTA]
    );
    const comandas = comandasResult.rows || [];

    // Buscar pedidos de mesa (TODOS exceto cancelados)
    const pedidosResult = await query(
      `SELECT * FROM pedidos WHERE empresa_id = $1 AND tipo_entrega = 'mesa' AND status != 'cancelado' LIMIT 500`,
      [user.empresaId]
    );
    const pedidos = pedidosResult.rows || [];

    // Montar estrutura de retorno
    const mesasComDetalhes: MesaComDetalhes[] = mesas.map((mesa: any) => {
      const comandasDaMesa = comandas.filter((c: any) => String(c.mesa_id) === String(mesa.id));

      const comandasComPedidos: ComandaComPedidos[] = comandasDaMesa.map((comanda: any) => {
        const pedidosDaComanda = pedidos.filter(
          (p: any) => String(p.comanda_id) === String(comanda.id)
        );

        return {
          ...comanda,
          pedidos: pedidosDaComanda,
        };
      });

      const totalMesa = comandasComPedidos.reduce((acc, c) => {
        const totalComanda = c.pedidos.reduce(
          (sum, p: any) => sum + (Number(p.valor_total) || 0),
          0
        );
        return acc + totalComanda;
      }, 0);

      return {
        ...mesa,
        comandas: comandasComPedidos,
        total_mesa: totalMesa,
      };
    });

    return mesasComDetalhes;
  } catch (error) {
    console.error('Erro ao buscar mesas com detalhes:', error);
    return [];
  }
}

// ============================================================
// CRIAR PEDIDO DE MESA
// ============================================================

export async function createTableOrder(data: {
  comanda_id: number;
  mesa_id: number;
  numero_mesa: number;
  cliente_nome?: string;
  itens: string;
  valor_total: number;
}): Promise<any> {
  const user = await requireRole(['admin', 'gerente', 'atendente', 'cozinheiro']);

  // Verificar comanda
  const comandaResult = await query(
    `SELECT * FROM comandas WHERE id = $1 AND store_id = $2`,
    [data.comanda_id, String(user.empresaId)]
  );
  const comanda = comandaResult.rows[0];
  
  if (!comanda) throw new Error('Comanda não encontrada');

  if (comanda.status !== COMANDA_STATUS.ABERTA) {
    throw new Error('Esta comanda já foi fechada');
  }

  // Verificar se já existe pedido pendente para esta comanda
  const pedidoExistenteResult = await query(
    `SELECT * FROM pedidos WHERE comanda_id = $1 AND status = 'pendente' AND empresa_id = $2 ORDER BY id DESC LIMIT 1`,
    [data.comanda_id, user.empresaId]
  );

  const pedidoExistente = pedidoExistenteResult.rows[0];

  let result;

  if (pedidoExistente) {
    // MERGE: Adicionar novos itens ao pedido existente
    const itensExistentes = JSON.parse(String(pedidoExistente.itens || '[]'));
    const novosItens = JSON.parse(data.itens);

    const itensMerged = [...itensExistentes, ...novosItens];
    const novoValorTotal = (Number(pedidoExistente.valor_total) || 0) + data.valor_total;

    const updateResult = await query(
      `UPDATE pedidos SET itens = $1, valor_total = $2 WHERE id = $3 RETURNING *`,
      [JSON.stringify(itensMerged), novoValorTotal, pedidoExistente.id]
    );

    result = updateResult.rows[0];
  } else {
    // CRIAR NOVO: Nenhum pedido pendente encontrado
    const insertResult = await query(
      `INSERT INTO pedidos (cliente_nome, telefone_cliente, itens, valor_total, status, canal, tipo_entrega, mesa_id, numero_mesa, comanda_id, empresa_id, criado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [data.cliente_nome || comanda.nome_cliente || `Mesa ${data.numero_mesa}`, '', data.itens, data.valor_total, 'pendente', 'Mesa', 'mesa', data.mesa_id, data.numero_mesa, data.comanda_id, user.empresaId, new Date().toISOString()]
    );

    result = insertResult.rows[0];
  }

  // Atualizar total da comanda
  const novoTotal = (Number(comanda.total) || 0) + data.valor_total;
  await query(
    `UPDATE comandas SET total = $1 WHERE id = $2`,
    [novoTotal, data.comanda_id]
  );

  revalidatePath('/dashboard/expedition');
  revalidatePath('/dashboard/mesas');
  return result;
}

// ============================================================
// ABRIR/FECHAR MESA RAPIDAMENTE
// ============================================================

export async function abrirMesa(mesaId: number, nomeCliente?: string): Promise<Comanda> {
  const user = await requireRole(['admin', 'gerente', 'atendente']);

  const mesaResult = await query(
    `SELECT * FROM mesas WHERE id = $1 AND store_id = $2`,
    [mesaId, String(user.empresaId)]
  );
  
  if (!mesaResult.rows[0]) throw new Error('Mesa não encontrada');

  // Criar comanda padrão
  const comanda = await createComanda({
    mesa_id: mesaId,
    nome_cliente: nomeCliente,
  });

  return comanda;
}

export async function fecharMesa(mesaId: number): Promise<{ total: number; comandas: number }> {
  const user = await requireRole(['admin', 'gerente', 'atendente']);

  const mesaResult = await query(
    `SELECT * FROM mesas WHERE id = $1 AND store_id = $2`,
    [mesaId, String(user.empresaId)]
  );
  
  if (!mesaResult.rows[0]) throw new Error('Mesa não encontrada');

  // Buscar todas as comandas abertas da mesa
  const comandasResult = await query(
    `SELECT * FROM comandas WHERE mesa_id = $1 AND status = $2 LIMIT 100`,
    [mesaId, COMANDA_STATUS.ABERTA]
  );
  const comandas = comandasResult.rows || [];

  let totalGeral = 0;

  // Fechar todas as comandas
  for (const comanda of comandas) {
    totalGeral += Number(comanda.total) || 0;
    await query(
      `UPDATE comandas SET status = $1, closed_at = $2 WHERE id = $3`,
      [COMANDA_STATUS.PAGA, new Date().toISOString(), comanda.id]
    );
  }

  // Liberar mesa
  await query(
    `UPDATE mesas SET status = $1 WHERE id = $2`,
    [MESA_STATUS.LIVRE, mesaId]
  );

  revalidatePath('/dashboard/mesas');
  return { total: totalGeral, comandas: comandas.length };
}
