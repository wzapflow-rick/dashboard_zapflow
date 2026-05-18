'use server';

import { revalidatePath } from 'next/cache';
import { getMe, requireRole } from '@/lib/session-server';
import { pg } from '@/lib/postgres';
import {
  MESA_STATUS,
  COMANDA_STATUS,
} from '@/lib/constants';

// ============================================================
// HELPERS
// ============================================================

function normalizeRecord<T extends { id?: number }>(record: T): T & { id: number } {
  return { ...record, id: record.id as number };
}

function normalizeRecordList<T extends { id?: number }>(list: T[]): (T & { id: number })[] {
  return list.map(normalizeRecord);
}

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

    const data = await pg.list('mesas', {
      where: { store_id: user.empresaId },
      sort: 'numero',
      limit: 100,
    });

    return normalizeRecordList((data.list || []) as any[]) as Mesa[];
  } catch (error) {
    console.error('Erro ao buscar mesas:', error);
    return [];
  }
}

export async function getMesaById(id: number): Promise<Mesa | null> {
  try {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');

    const mesa = await pg.findById('mesas', id) as any;
    if (!mesa) return null;

    if (String(mesa.store_id) !== String(user.empresaId)) {
      return null;
    }

    return normalizeRecord(mesa) as Mesa;
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

  const existente = await pg.findOne('mesas', {
    where: { store_id: user.empresaId, numero: data.numero },
  });

  if (existente) {
    throw new Error(`Já existe uma mesa com o número ${data.numero}`);
  }

  const payload = {
    store_id: String(user.empresaId),
    numero: data.numero,
    nome: data.nome || null,
    capacidade: data.capacidade || null,
    status: MESA_STATUS.LIVRE,
    qr_code: `mesa_${user.empresaId}_${data.numero}_${Date.now()}`,
  };

  const result = await pg.create('mesas', payload);

  revalidatePath('/dashboard/mesas');
  return normalizeRecord(result as any) as Mesa;
}

export async function updateMesa(
  id: number,
  data: Partial<Pick<Mesa, 'numero' | 'nome' | 'capacidade' | 'status' | 'qr_code'>>
): Promise<Mesa> {
  const user = await requireRole(['admin', 'gerente', 'atendente']);

  const mesa = await pg.findById('mesas', id) as any;
  if (!mesa) throw new Error('Mesa não encontrada');
  
  if (String(mesa.store_id) !== String(user.empresaId)) {
    throw new Error('Mesa não encontrada');
  }

  const result = await pg.update('mesas', id, data);

  revalidatePath('/dashboard/mesas');
  return normalizeRecord(result as any) as Mesa;
}

export async function deleteMesa(id: number): Promise<void> {
  const user = await requireRole(['admin', 'gerente']);

  const mesa = await pg.findById('mesas', id) as any;
  if (!mesa) throw new Error('Mesa não encontrada');
  
  if (String(mesa.store_id) !== String(user.empresaId)) {
    throw new Error('Mesa não encontrada');
  }

  const comandasAbertas = await pg.query(
    `SELECT id FROM comandas WHERE mesa_id = $1 AND status = $2 LIMIT 1`,
    [id, COMANDA_STATUS.ABERTA]
  );

  if (comandasAbertas.rows?.length > 0) {
    throw new Error('Não é possível excluir mesa com comandas abertas');
  }

  await pg.delete('mesas', id);

  revalidatePath('/dashboard/mesas');
}

// ============================================================
// COMANDAS - CRUD
// ============================================================

export async function getComandasByMesa(mesaId: number): Promise<Comanda[]> {
  try {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');

    const data = await pg.list('comandas', {
      where: { mesa_id: mesaId, store_id: user.empresaId },
      sort: '-id',
      limit: 100,
    });

    return normalizeRecordList((data.list || []) as any[]) as Comanda[];
  } catch (error) {
    console.error('Erro ao buscar comandas:', error);
    return [];
  }
}

export async function getComandasAbertas(): Promise<Comanda[]> {
  try {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');

    const data = await pg.query(
      `SELECT * FROM comandas WHERE store_id = $1 AND status = $2 ORDER BY id DESC LIMIT 100`,
      [user.empresaId, COMANDA_STATUS.ABERTA]
    );

    return normalizeRecordList((data.rows || []) as any[]) as Comanda[];
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

  const mesa = await pg.findById('mesas', data.mesa_id) as any;
  if (!mesa) throw new Error('Mesa não encontrada');
  
  if (String(mesa.store_id) !== String(user.empresaId)) {
    throw new Error('Mesa não encontrada');
  }

  const payload = {
    mesa_id: data.mesa_id,
    store_id: String(user.empresaId),
    nome_cliente: data.nome_cliente || null,
    status: COMANDA_STATUS.ABERTA,
    total: 0,
  };

  const result = await pg.create('comandas', payload);

  if (mesa.status === MESA_STATUS.LIVRE) {
    await pg.update('mesas', mesa.id, { status: MESA_STATUS.OCUPADA });
  }

  revalidatePath('/dashboard/mesas');
  return normalizeRecord(result as any) as Comanda;
}

export async function updateComanda(
  id: number,
  data: Partial<Pick<Comanda, 'nome_cliente' | 'status' | 'total'>>
): Promise<Comanda> {
  const user = await requireRole(['admin', 'gerente', 'atendente']);

  const comanda = await pg.findById('comandas', id) as any;
  if (!comanda) throw new Error('Comanda não encontrada');
  
  if (String(comanda.store_id) !== String(user.empresaId)) {
    throw new Error('Comanda não encontrada');
  }

  const updatePayload: any = { ...data };

  if (data.status && data.status !== COMANDA_STATUS.ABERTA) {
    updatePayload.closed_at = new Date().toISOString();
  }

  const result = await pg.update('comandas', id, updatePayload);

  if (data.status === COMANDA_STATUS.PAGA) {
    await verificarELiberarMesa(comanda.mesa_id);
  }

  revalidatePath('/dashboard/mesas');
  revalidatePath('/dashboard/expedition');
  return normalizeRecord(result as any) as Comanda;
}

async function verificarELiberarMesa(mesaId: number): Promise<void> {
  const comandasAbertas = await pg.query(
    `SELECT id FROM comandas WHERE mesa_id = $1 AND status = $2 LIMIT 1`,
    [mesaId, COMANDA_STATUS.ABERTA]
  );

  if (!comandasAbertas.rows?.length) {
    await pg.update('mesas', mesaId, { status: MESA_STATUS.LIVRE });
  }
}

// ============================================================
// MESAS COM DETALHES
// ============================================================

export async function getMesasComDetalhes(): Promise<MesaComDetalhes[]> {
  try {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');

    const mesasData = await pg.list('mesas', {
      where: { store_id: user.empresaId },
      sort: 'numero',
      limit: 100,
    });
    const mesas = normalizeRecordList((mesasData.list || []) as any[]) as Mesa[];

    if (mesas.length === 0) return [];

    const comandasData = await pg.query(
      `SELECT * FROM comandas WHERE store_id = $1 AND status = $2 LIMIT 500`,
      [user.empresaId, COMANDA_STATUS.ABERTA]
    );
    const comandas = normalizeRecordList((comandasData.rows || []) as any[]) as Comanda[];

    const pedidosData = await pg.query(
      `SELECT * FROM pedidos WHERE empresa_id = $1 AND tipo_entrega = 'mesa' AND status != 'cancelado' LIMIT 500`,
      [user.empresaId]
    );
    const pedidos = normalizeRecordList((pedidosData.rows || []) as any[]);

    const mesasComDetalhes: MesaComDetalhes[] = mesas.map((mesa) => {
      const comandasDaMesa = comandas.filter((c) => String(c.mesa_id) === String(mesa.id));

      const comandasComPedidos: ComandaComPedidos[] = comandasDaMesa.map((comanda) => {
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

  const comanda = await pg.findById('comandas', data.comanda_id) as any;
  if (!comanda) throw new Error('Comanda não encontrada');
  
  if (String(comanda.store_id) !== String(user.empresaId)) {
    throw new Error('Comanda não encontrada');
  }

  if (comanda.status !== COMANDA_STATUS.ABERTA) {
    throw new Error('Esta comanda já foi fechada');
  }

  const pedidoExistenteData = await pg.query(
    `SELECT * FROM pedidos WHERE comanda_id = $1 AND status = 'pendente' AND empresa_id = $2 ORDER BY id DESC LIMIT 1`,
    [data.comanda_id, user.empresaId]
  );

  const pedidoExistente = pedidoExistenteData.rows?.[0] as any;

  let result;

  if (pedidoExistente) {
    const itensExistentes = JSON.parse(String(pedidoExistente.itens || '[]'));
    const novosItens = JSON.parse(data.itens);

    const itensMerged = [...itensExistentes, ...novosItens];
    const novoValorTotal = (Number(pedidoExistente.valor_total) || 0) + data.valor_total;

    await pg.update('pedidos', pedidoExistente.id, {
      itens: JSON.stringify(itensMerged),
      valor_total: novoValorTotal,
    });

    result = { ...pedidoExistente, itens: JSON.stringify(itensMerged), valor_total: novoValorTotal };
  } else {
    const payload = {
      cliente_nome: data.cliente_nome || comanda.nome_cliente || `Mesa ${data.numero_mesa}`,
      telefone_cliente: '',
      itens: data.itens,
      valor_total: data.valor_total,
      status: 'pendente',
      canal: 'Mesa',
      tipo_entrega: 'mesa',
      mesa_id: data.mesa_id,
      numero_mesa: data.numero_mesa,
      comanda_id: data.comanda_id,
      empresa_id: user.empresaId,
      criado_em: new Date().toISOString(),
    };

    result = await pg.create('pedidos', payload);
  }

  const novoTotal = (Number(comanda.total) || 0) + data.valor_total;
  await pg.update('comandas', data.comanda_id, { total: novoTotal });

  revalidatePath('/dashboard/expedition');
  revalidatePath('/dashboard/mesas');
  return result;
}

// ============================================================
// ABRIR/FECHAR MESA RAPIDAMENTE
// ============================================================

export async function abrirMesa(mesaId: number, nomeCliente?: string): Promise<Comanda> {
  const user = await requireRole(['admin', 'gerente', 'atendente']);

  const mesa = await pg.findById('mesas', mesaId) as any;
  if (!mesa) throw new Error('Mesa não encontrada');
  
  if (String(mesa.store_id) !== String(user.empresaId)) {
    throw new Error('Mesa não encontrada');
  }

  const comanda = await createComanda({
    mesa_id: mesaId,
    nome_cliente: nomeCliente,
  });

  return comanda;
}

export async function fecharMesa(mesaId: number): Promise<{ total: number; comandas: number }> {
  const user = await requireRole(['admin', 'gerente', 'atendente']);

  const mesa = await pg.findById('mesas', mesaId) as any;
  if (!mesa) throw new Error('Mesa não encontrada');
  
  if (String(mesa.store_id) !== String(user.empresaId)) {
    throw new Error('Mesa não encontrada');
  }

  const comandasData = await pg.query(
    `SELECT * FROM comandas WHERE mesa_id = $1 AND status = $2 LIMIT 100`,
    [mesaId, COMANDA_STATUS.ABERTA]
  );
  const comandas = normalizeRecordList((comandasData.rows || []) as any[]) as Comanda[];

  let totalGeral = 0;

  for (const comanda of comandas) {
    totalGeral += Number(comanda.total) || 0;
    await pg.update('comandas', comanda.id, {
      status: COMANDA_STATUS.PAGA,
      closed_at: new Date().toISOString(),
    });
  }

  await pg.update('mesas', mesaId, { status: MESA_STATUS.LIVRE });

  revalidatePath('/dashboard/mesas');
  return { total: totalGeral, comandas: comandas.length };
}
