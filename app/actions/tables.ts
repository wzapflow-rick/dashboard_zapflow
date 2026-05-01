'use server';

import { revalidatePath } from 'next/cache';
import { getMe, requireRole } from '@/lib/session-server';
import { noco } from '@/lib/nocodb';
import {
  MESAS_TABLE_ID,
  COMANDAS_TABLE_ID,
  PEDIDOS_TABLE_ID,
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

    if (!MESAS_TABLE_ID) {
      console.warn('MESAS_TABLE_ID não configurado');
      return [];
    }

    const data = await noco.list(MESAS_TABLE_ID, {
      where: `(store_id,eq,${user.empresaId})`,
      sort: 'numero',
      limit: 100,
    });

    return (data.list || []) as unknown as Mesa[];
  } catch (error) {
    console.error('Erro ao buscar mesas:', error);
    return [];
  }
}

export async function getMesaById(id: number): Promise<Mesa | null> {
  try {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');

    const mesa = await noco.findById(MESAS_TABLE_ID, id) as unknown as Mesa;

    if (!mesa || String(mesa.store_id) !== String(user.empresaId)) {
      return null;
    }

    return mesa;
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
  const user = await requireRole(['admin', 'gerente']);

  // Verificar se já existe mesa com esse número
  const existente = await noco.findOne(MESAS_TABLE_ID, {
    where: `(store_id,eq,${user.empresaId})~and(numero,eq,${data.numero})`,
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

  const result = await noco.create(MESAS_TABLE_ID, payload);

  revalidatePath('/dashboard/mesas');
  return result as unknown as Mesa;
}

export async function updateMesa(
  id: number,
  data: Partial<Pick<Mesa, 'numero' | 'nome' | 'capacidade' | 'status' | 'qr_code'>>
): Promise<Mesa> {
  try {
    console.log('[v0] updateMesa - id:', id, 'data:', data);
    const user = await requireRole(['admin', 'gerente', 'atendente']);

    const mesa = await noco.findById(MESAS_TABLE_ID, id) as unknown as Mesa;
    console.log('[v0] updateMesa - mesa encontrada:', mesa?.id);
    
    if (!mesa || String(mesa.store_id) !== String(user.empresaId)) {
      throw new Error('Mesa não encontrada');
    }

    const result = await noco.update(MESAS_TABLE_ID, { id, ...data });
    console.log('[v0] updateMesa - resultado:', result);

    revalidatePath('/dashboard/mesas');
    return result as unknown as Mesa;
  } catch (error) {
    console.error('[v0] updateMesa - ERRO:', error);
    throw error;
  }
}

  // Se está mudando o número, verificar duplicata
  if (data.numero && data.numero !== mesa.numero) {
    const existente = await noco.findOne(MESAS_TABLE_ID, {
      where: `(store_id,eq,${user.empresaId})~and(numero,eq,${data.numero})`,
    });
    if (existente) {
      throw new Error(`Já existe uma mesa com o número ${data.numero}`);
    }
  }

  const result = await noco.update(MESAS_TABLE_ID, { id, ...data });

  revalidatePath('/dashboard/mesas');
  return result as unknown as Mesa;
}

export async function deleteMesa(id: number): Promise<void> {
  const user = await requireRole(['admin', 'gerente']);

  const mesa = await noco.findById(MESAS_TABLE_ID, id) as unknown as Mesa;
  if (!mesa || String(mesa.store_id) !== String(user.empresaId)) {
    throw new Error('Mesa não encontrada');
  }

  // Verificar se há comandas abertas
  const comandasAbertas = await noco.list(COMANDAS_TABLE_ID, {
    where: `(mesa_id,eq,${id})~and(status,eq,${COMANDA_STATUS.ABERTA})`,
    limit: 1,
  });

  if (comandasAbertas.list?.length > 0) {
    throw new Error('Não é possível excluir mesa com comandas abertas');
  }

  await noco.delete(MESAS_TABLE_ID, id);

  revalidatePath('/dashboard/mesas');
}

// ============================================================
// COMANDAS - CRUD
// ============================================================

export async function getComandasByMesa(mesaId: number): Promise<Comanda[]> {
  try {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');

    const data = await noco.list(COMANDAS_TABLE_ID, {
      where: `(mesa_id,eq,${mesaId})~and(store_id,eq,${user.empresaId})`,
      sort: '-id',
      limit: 100,
    });

    return (data.list || []) as unknown as Comanda[];
  } catch (error) {
    console.error('Erro ao buscar comandas:', error);
    return [];
  }
}

export async function getComandasAbertas(): Promise<Comanda[]> {
  try {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');

    if (!COMANDAS_TABLE_ID) {
      console.warn('COMANDAS_TABLE_ID não configurado');
      return [];
    }

    const data = await noco.list(COMANDAS_TABLE_ID, {
      where: `(store_id,eq,${user.empresaId})~and(status,eq,${COMANDA_STATUS.ABERTA})`,
      sort: '-id',
      limit: 100,
    });

    return (data.list || []) as unknown as Comanda[];
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
  const mesa = await noco.findById(MESAS_TABLE_ID, data.mesa_id) as unknown as Mesa;
  if (!mesa || String(mesa.store_id) !== String(user.empresaId)) {
    throw new Error('Mesa não encontrada');
  }

  const payload = {
    mesa_id: data.mesa_id,
    store_id: String(user.empresaId),
    nome_cliente: data.nome_cliente || null,
    status: COMANDA_STATUS.ABERTA,
    total: 0,
  };

  const result = await noco.create(COMANDAS_TABLE_ID, payload);

  // Atualizar status da mesa para ocupada
  if (mesa.status === MESA_STATUS.LIVRE) {
    await noco.update(MESAS_TABLE_ID, {
      id: mesa.id,
      status: MESA_STATUS.OCUPADA,
    });
  }

  revalidatePath('/dashboard/mesas');
  return result as unknown as Comanda;
}

export async function updateComanda(
  id: number,
  data: Partial<Pick<Comanda, 'nome_cliente' | 'status' | 'total'>>
): Promise<Comanda> {
  const user = await requireRole(['admin', 'gerente', 'atendente']);

  const comanda = await noco.findById(COMANDAS_TABLE_ID, id) as unknown as Comanda;
  if (!comanda || String(comanda.store_id) !== String(user.empresaId)) {
    throw new Error('Comanda não encontrada');
  }

  const updatePayload: any = { id, ...data };

  // Se está fechando ou marcando como paga, adicionar data de fechamento
  if (data.status && data.status !== COMANDA_STATUS.ABERTA) {
    updatePayload.closed_at = new Date().toISOString();
  }

  const result = await noco.update(COMANDAS_TABLE_ID, updatePayload);

  // Verificar se deve liberar a mesa
  if (data.status === COMANDA_STATUS.PAGA) {
    await verificarELiberarMesa(comanda.mesa_id);
  }

  revalidatePath('/dashboard/mesas');
  revalidatePath('/dashboard/expedition');
  return result as unknown as Comanda;
}

async function verificarELiberarMesa(mesaId: number): Promise<void> {
  // Verificar se ainda há comandas abertas na mesa
  const comandasAbertas = await noco.list(COMANDAS_TABLE_ID, {
    where: `(mesa_id,eq,${mesaId})~and(status,eq,${COMANDA_STATUS.ABERTA})`,
    limit: 1,
  });

  if (!comandasAbertas.list?.length) {
    // Não há mais comandas abertas, liberar mesa
    await noco.update(MESAS_TABLE_ID, {
      id: mesaId,
      status: MESA_STATUS.LIVRE,
    });
  }
}

// ============================================================
// MESAS COM DETALHES (para visualização)
// ============================================================

export async function getMesasComDetalhes(): Promise<MesaComDetalhes[]> {
  try {
    const user = await getMe();
    if (!user?.empresaId) throw new Error('Não autorizado');

    if (!MESAS_TABLE_ID || !COMANDAS_TABLE_ID) {
      console.warn('IDs de tabelas de mesas/comandas não configurados');
      return [];
    }

    // Buscar mesas
    const mesasData = await noco.list(MESAS_TABLE_ID, {
      where: `(store_id,eq,${user.empresaId})`,
      sort: 'numero',
      limit: 100,
    });
    const mesas = (mesasData.list || []) as unknown as Mesa[];

    if (mesas.length === 0) return [];

    // Buscar todas as comandas abertas
    const comandasData = await noco.list(COMANDAS_TABLE_ID, {
      where: `(store_id,eq,${user.empresaId})~and(status,eq,${COMANDA_STATUS.ABERTA})`,
      limit: 500,
    });
    const comandas = (comandasData.list || []) as unknown as Comanda[];

    // Buscar pedidos das comandas abertas (tipo_entrega = mesa)
    const pedidosData = await noco.list(PEDIDOS_TABLE_ID, {
      where: `(empresa_id,eq,${user.empresaId})~and(tipo_entrega,eq,mesa)~and(status,neq,finalizado)~and(status,neq,cancelado)`,
      limit: 500,
    });
    const pedidos = pedidosData.list || [];

    // Montar estrutura de retorno
    const mesasComDetalhes: MesaComDetalhes[] = mesas.map((mesa) => {
      const comandasDaMesa = comandas.filter((c) => c.mesa_id === mesa.id);

      const comandasComPedidos: ComandaComPedidos[] = comandasDaMesa.map((comanda) => {
        const pedidosDaComanda = pedidos.filter(
          (p: any) => p.comanda_id === comanda.id
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
  const comanda = await noco.findById(COMANDAS_TABLE_ID, data.comanda_id) as unknown as Comanda;
  if (!comanda || String(comanda.store_id) !== String(user.empresaId)) {
    throw new Error('Comanda não encontrada');
  }

  if (comanda.status !== COMANDA_STATUS.ABERTA) {
    throw new Error('Esta comanda já foi fechada');
  }

  const payload = {
    cliente_nome: data.cliente_nome || comanda.nome_cliente || `Mesa ${data.numero_mesa}`,
    telefone_cliente: '', // Mesa não tem telefone
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

  const result = await noco.create(PEDIDOS_TABLE_ID, payload);

  // Atualizar total da comanda
  const novoTotal = (Number(comanda.total) || 0) + data.valor_total;
  await noco.update(COMANDAS_TABLE_ID, {
    id: data.comanda_id,
    total: novoTotal,
  });

  revalidatePath('/dashboard/expedition');
  revalidatePath('/dashboard/mesas');
  return result;
}

// ============================================================
// ABRIR/FECHAR MESA RAPIDAMENTE
// ============================================================

export async function abrirMesa(mesaId: number, nomeCliente?: string): Promise<Comanda> {
  try {
    console.log('[v0] abrirMesa - mesaId:', mesaId);
    const user = await requireRole(['admin', 'gerente', 'atendente']);
    console.log('[v0] abrirMesa - user:', user?.empresaId);

    const mesa = await noco.findById(MESAS_TABLE_ID, mesaId) as unknown as Mesa;
    console.log('[v0] abrirMesa - mesa encontrada:', mesa?.id);
    
    if (!mesa || String(mesa.store_id) !== String(user.empresaId)) {
      throw new Error('Mesa não encontrada');
    }

    // Criar comanda padrão
    console.log('[v0] abrirMesa - criando comanda');
    const comanda = await createComanda({
      mesa_id: mesaId,
      nome_cliente: nomeCliente,
    });
    console.log('[v0] abrirMesa - comanda criada:', comanda?.id);

    return comanda;
  } catch (error) {
    console.error('[v0] abrirMesa - ERRO:', error);
    throw error;
  }
}

export async function fecharMesa(mesaId: number): Promise<{ total: number; comandas: number }> {
  const user = await requireRole(['admin', 'gerente', 'atendente']);

  const mesa = await noco.findById(MESAS_TABLE_ID, mesaId) as unknown as Mesa;
  if (!mesa || String(mesa.store_id) !== String(user.empresaId)) {
    throw new Error('Mesa não encontrada');
  }

  // Buscar todas as comandas abertas da mesa
  const comandasData = await noco.list(COMANDAS_TABLE_ID, {
    where: `(mesa_id,eq,${mesaId})~and(status,eq,${COMANDA_STATUS.ABERTA})`,
    limit: 100,
  });
  const comandas = (comandasData.list || []) as unknown as Comanda[];

  let totalGeral = 0;

  // Fechar todas as comandas
  for (const comanda of comandas) {
    totalGeral += Number(comanda.total) || 0;
    await noco.update(COMANDAS_TABLE_ID, {
      id: comanda.id as number,
      status: COMANDA_STATUS.PAGA,
      closed_at: new Date().toISOString(),
    });
  }

  // Liberar mesa
  await noco.update(MESAS_TABLE_ID, {
    id: mesaId,
    status: MESA_STATUS.LIVRE,
  });

  revalidatePath('/dashboard/mesas');
  return { total: totalGeral, comandas: comandas.length };
}
