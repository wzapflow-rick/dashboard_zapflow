'use server';

import { revalidatePath } from 'next/cache';
import { getMe, requireRole } from '@/lib/session-server';
import { pg } from '@/lib/postgres';
import {
  MESA_STATUS,
  COMANDA_STATUS,
  ORDER_STATUS,
  DELIVERY_TYPE,
} from '@/lib/constants';

// ============================================================
// HELPERS
// ============================================================

function normalizeRecord<T extends { id?: number | null }>(record: T): T & { id: number } {
  if (record.id === null || record.id === undefined) {
    console.warn('[Tables] Record com ID null/undefined detectado:', record);
  }
  return { ...record, id: Number(record.id) || 0 };
}

function normalizeRecordList<T extends { id?: number | null }>(list: T[]): (T & { id: number })[] {
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
    await finalizarPedidosDaComanda(id, user.empresaId);
    await verificarELiberarMesa(comanda.mesa_id);
  }

  revalidatePath('/dashboard/mesas');
  revalidatePath('/dashboard/expedition');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/reports');
  return normalizeRecord(result as any) as Comanda;
}

// Marca como "finalizado" todos os pedidos de mesa ainda ativos de uma comanda.
// Necessario porque o faturamento do Dashboard e dos Relatorios so soma pedidos
// com status 'finalizado'. Sem isso, pedidos de mesa (que nascem 'pendente'/'pronto')
// nunca entram nas metricas, mesmo apos a comanda ser paga / a mesa ser fechada.
async function finalizarPedidosDaComanda(comandaId: number, empresaId: string | number): Promise<void> {
  try {
    await pg.query(
      `UPDATE pedidos
         SET status = $1
       WHERE comanda_id = $2
         AND empresa_id = $3
         AND status NOT IN ($4, $5)`,
      [
        ORDER_STATUS.FINALIZADO,
        comandaId,
        empresaId,
        ORDER_STATUS.FINALIZADO,
        ORDER_STATUS.CANCELADO,
      ]
    );
  } catch (error) {
    console.error('Erro ao finalizar pedidos da comanda:', error);
  }
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

    // As 3 consultas dependem apenas do store_id (sao independentes entre si),
    // entao rodamos em paralelo: 1 ida ao banco em vez de 3 em sequencia.
    const [mesasData, comandasData, pedidosData] = await Promise.all([
      pg.list('mesas', {
        where: { store_id: user.empresaId },
        sort: 'numero',
        limit: 100,
      }),
      pg.query(
        `SELECT * FROM comandas WHERE store_id = $1 AND status = $2 LIMIT 500`,
        [user.empresaId, COMANDA_STATUS.ABERTA]
      ),
      pg.query(
        `SELECT * FROM pedidos WHERE empresa_id = $1 AND tipo_entrega = 'mesa' AND status != 'cancelado' LIMIT 500`,
        [user.empresaId]
      ),
    ]);

    const mesas = normalizeRecordList((mesasData.list || []) as any[]) as Mesa[];

    if (mesas.length === 0) return [];

    const comandas = normalizeRecordList((comandasData.rows || []) as any[]) as Comanda[];
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

  // Modo direto (opcional por loja): quando ativo, o pedido de mesa ja nasce como
  // "pronto", pulando as etapas do Kanban (pendente -> preparando). Lojas que usam
  // o fluxo completo mantem o status padrao "pendente".
  const empresaConfig = await pg.query(
    `SELECT mesa_pedido_direto FROM empresas WHERE id = $1 LIMIT 1`,
    [user.empresaId]
  );
  const modoDireto = !!empresaConfig.rows?.[0]?.mesa_pedido_direto;
  const statusNovoPedido = modoDireto ? ORDER_STATUS.PRONTO : ORDER_STATUS.PENDENTE;

  const pedidoExistenteData = await pg.query(
    `SELECT * FROM pedidos WHERE comanda_id = $1 AND status = 'pendente' AND empresa_id = $2 ORDER BY id DESC LIMIT 1`,
    [data.comanda_id, user.empresaId]
  );

  const pedidoExistente = pedidoExistenteData.rows?.[0] as any;

  let result;

  if (pedidoExistente) {
    const itensExistentes = typeof pedidoExistente.itens === 'string' 
      ? JSON.parse(pedidoExistente.itens || '[]') 
      : (pedidoExistente.itens || []);
    const novosItens = typeof data.itens === 'string' 
      ? JSON.parse(data.itens) 
      : data.itens;

    const itensMerged = [...itensExistentes, ...novosItens];
    const novoValorTotal = (Number(pedidoExistente.valor_total) || 0) + data.valor_total;

    await pg.update('pedidos', pedidoExistente.id, {
      itens: JSON.stringify(itensMerged),
      valor_total: novoValorTotal,
    });

    result = { ...pedidoExistente, itens: JSON.stringify(itensMerged), valor_total: novoValorTotal };
  } else {
    const itensString = typeof data.itens === 'string' ? data.itens : JSON.stringify(data.itens);
    const payload = {
      cliente_nome: data.cliente_nome || comanda.nome_cliente || `Mesa ${data.numero_mesa}`,
      telefone_cliente: '',
      itens: itensString,
      valor_total: data.valor_total,
      status: statusNovoPedido,
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
    // Finaliza os pedidos da comanda para que entrem no faturamento (Dashboard/Relatorios)
    await finalizarPedidosDaComanda(comanda.id, user.empresaId);
  }

  await pg.update('mesas', mesaId, { status: MESA_STATUS.LIVRE });

  revalidatePath('/dashboard/mesas');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/reports');
  return { total: totalGeral, comandas: comandas.length };
}

// ============================================================
// CANCELAR PEDIDO DE MESA
// ============================================================

// Marca UM pedido da comanda como cancelado (o cliente desistiu do pedido).
// Diferente de "editar itens": o pedido inteiro sai da conta. O valor cancelado
// e subtraido do total da comanda e o pedido some da mesa (a query de mesas ja
// filtra status != 'cancelado') sem precisar fechar a mesa.
export async function cancelarPedidoDeMesa(pedidoId: number, motivo?: string): Promise<void> {
  const user = await requireRole(['admin', 'gerente', 'atendente']);

  const pedido = await pg.findById('pedidos', pedidoId) as any;
  if (!pedido || String(pedido.empresa_id) !== String(user.empresaId)) {
    throw new Error('Pedido não encontrado');
  }

  if (pedido.status === ORDER_STATUS.CANCELADO) return;

  const nowStr = new Date().toLocaleString('pt-BR');
  const nota = motivo?.trim()
    ? `❌ CANCELADO (${nowStr}): ${motivo.trim()}`
    : `❌ CANCELADO (${nowStr})`;

  await pg.update('pedidos', {
    id: pedidoId,
    status: ORDER_STATUS.CANCELADO,
    observacoes: pedido.observacoes ? `${pedido.observacoes}\n${nota}` : nota,
  });

  // Ajusta o total da comanda subtraindo o valor do pedido cancelado.
  if (pedido.comanda_id) {
    const comanda = await pg.findById('comandas', pedido.comanda_id) as any;
    if (comanda) {
      const novoTotal = Math.max(
        0,
        (Number(comanda.total) || 0) - (Number(pedido.valor_total) || 0)
      );
      await pg.update('comandas', pedido.comanda_id, { total: novoTotal });
    }
  }

  revalidatePath('/dashboard/mesas');
  revalidatePath('/dashboard/expedition');
}

// ============================================================
// TRANSFORMAR COMANDA EM DELIVERY
// ============================================================

// Cliente pediu na mesa e depois quer receber em casa: converte todos os pedidos
// ativos da comanda em pedidos de delivery (define endereco/telefone, muda o
// tipo_entrega para 'delivery'), fecha a comanda (SEM marcar como paga — o
// pagamento acontece na entrega) e libera a mesa. Os pedidos deixam a visao de
// mesas (que filtra tipo_entrega = 'mesa') e passam a aparecer no Kanban de
// expedicao no fluxo de entrega, mantendo o status atual da cozinha.
export async function transformarComandaEmDelivery(
  comandaId: number,
  data: { endereco: string; bairro?: string; telefone?: string; taxaEntrega?: number }
): Promise<{ pedidos: number }> {
  const user = await requireRole(['admin', 'gerente', 'atendente']);

  if (!data.endereco?.trim()) {
    throw new Error('Informe o endereço de entrega');
  }

  const comanda = await pg.findById('comandas', comandaId) as any;
  if (!comanda || String(comanda.store_id) !== String(user.empresaId)) {
    throw new Error('Comanda não encontrada');
  }

  const pedidosData = await pg.query(
    `SELECT * FROM pedidos
       WHERE comanda_id = $1 AND empresa_id = $2 AND status NOT IN ($3, $4)`,
    [comandaId, user.empresaId, ORDER_STATUS.CANCELADO, ORDER_STATUS.FINALIZADO]
  );
  const pedidos = (pedidosData.rows || []) as any[];

  if (pedidos.length === 0) {
    throw new Error('Nenhum pedido ativo nesta comanda para transformar em delivery');
  }

  const taxa = Number(data.taxaEntrega) || 0;

  // Colunas ativas do Kanban de expedicao: 'pendente', 'preparando', 'entrega'.
  // Status de mesa como 'pronto' nao existem la, entao normalizamos para
  // 'preparando' para o pedido nao sumir (nem da mesa nem da expedicao).
  const COLUNAS_EXPEDICAO = ['pendente', 'preparando', 'entrega'];

  for (let i = 0; i < pedidos.length; i++) {
    const pedido = pedidos[i];
    const updatePayload: any = {
      id: pedido.id,
      tipo_entrega: DELIVERY_TYPE.DELIVERY,
      canal: 'Mesa → Delivery',
      endereco_entrega: data.endereco.trim(),
      bairro_entrega: data.bairro?.trim() || '',
      status: COLUNAS_EXPEDICAO.includes(pedido.status)
        ? pedido.status
        : ORDER_STATUS.PREPARANDO,
    };

    if (data.telefone?.trim()) {
      updatePayload.telefone_cliente = data.telefone.trim();
    }

    // A taxa de entrega entra como item extra apenas no primeiro pedido.
    if (i === 0 && taxa > 0) {
      let itens: any[] = [];
      try {
        itens = typeof pedido.itens === 'string' ? JSON.parse(pedido.itens) : (pedido.itens || []);
      } catch {
        itens = [];
      }
      itens.push({
        id: `taxa_${Date.now()}`,
        produto: 'Taxa de entrega',
        nome: 'Taxa de entrega',
        quantidade: 1,
        preco_unitario: taxa,
        subtotal: taxa,
        isExtra: true,
      });
      updatePayload.itens = JSON.stringify(itens);
      updatePayload.valor_total = (Number(pedido.valor_total) || 0) + taxa;
    }

    await pg.update('pedidos', updatePayload);
  }

  // Fecha a comanda sem marcar como paga (pagamento ocorre na entrega).
  await pg.update('comandas', comandaId, {
    status: COMANDA_STATUS.FECHADA,
    closed_at: new Date().toISOString(),
  });

  // Libera a mesa se nao houver mais comandas abertas.
  await verificarELiberarMesa(comanda.mesa_id);

  revalidatePath('/dashboard/mesas');
  revalidatePath('/dashboard/expedition');
  return { pedidos: pedidos.length };
}
