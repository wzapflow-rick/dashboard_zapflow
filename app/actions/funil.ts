'use server';

import { pg } from '@/lib/postgres';
import {
  REMARKETING_CONTATOS_TABLE,
  REMARKETING_MENSAGENS_TABLE,
  REMARKETING_FILA_TABLE,
  REMARKETING_HISTORICO_TABLE,
  REMARKETING_CADENCIAS_TABLE,
  REMARKETING_CADENCIA_ENVIOS_TABLE,
} from '@/lib/tables';
import {
  FUNIL_ESTAGIOS,
  STATUS_AGUARDANDO_APROVACAO,
  type FunilEstagio,
  type FunilContato,
  type Cadencia,
  type FilaAprovacaoItem,
} from '@/lib/funil-config';

// ============================================================
// KANBAN / FUNIL
// ============================================================

/**
 * Retorna todos os contatos do funil agrupados por estagio, prontos para o Kanban.
 * Calcula horas no estagio e a proxima acao prevista de cada contato.
 */
export async function getFunilContatos(): Promise<{
  success: boolean;
  estagios?: Record<FunilEstagio, FunilContato[]>;
  error?: string;
}> {
  try {
    const contatos = await pg.raw<FunilContato>(`
      SELECT id, remote_jid, telefone, nome, foto_url, estagio, estagio_desde,
             empresa_id, kanban_ordem, score, ativo, bloqueado
      FROM "${REMARKETING_CONTATOS_TABLE}"
      WHERE ativo = true
      ORDER BY kanban_ordem ASC, estagio_desde DESC NULLS LAST
    `);

    // Cadencias ativas por estagio (para calcular a proxima acao)
    const cadencias = await pg.raw<Cadencia>(`
      SELECT id, estagio, passo_ordem, offset_horas, recorrente, intervalo_horas, modo, ativo
      FROM "${REMARKETING_CADENCIAS_TABLE}"
      WHERE ativo = true
      ORDER BY estagio, passo_ordem ASC
    `);

    // Envios ja registrados (para saber o que ja foi feito)
    const envios = await pg.raw<{ contato_id: number; cadencia_id: number; passo_ordem: number }>(`
      SELECT contato_id, cadencia_id, passo_ordem
      FROM "${REMARKETING_CADENCIA_ENVIOS_TABLE}"
      WHERE status <> 'cancelado'
    `);

    const enviosSet = new Set(
      envios.map((e) => `${e.contato_id}:${e.cadencia_id}:${e.passo_ordem}`),
    );

    const cadenciasPorEstagio = new Map<string, Cadencia[]>();
    for (const c of cadencias) {
      const arr = cadenciasPorEstagio.get(c.estagio) || [];
      arr.push(c);
      cadenciasPorEstagio.set(c.estagio, arr);
    }

    const agora = Date.now();

    const estagios = Object.fromEntries(
      FUNIL_ESTAGIOS.map((e) => [e, [] as FunilContato[]]),
    ) as Record<FunilEstagio, FunilContato[]>;

    for (const contato of contatos) {
      const estagio = (contato.estagio || 'lead_morno') as FunilEstagio;
      if (!FUNIL_ESTAGIOS.includes(estagio)) continue;

      // Horas no estagio
      if (contato.estagio_desde) {
        contato.horas_no_estagio = Math.floor(
          (agora - new Date(contato.estagio_desde).getTime()) / (1000 * 60 * 60),
        );
      }

      // Proxima acao: primeiro passo da cadencia ainda nao realizado
      const cads = cadenciasPorEstagio.get(estagio) || [];
      const marco = contato.estagio_desde ? new Date(contato.estagio_desde).getTime() : agora;
      let proxima: { rotulo: string; em: number } | null = null;
      for (const cad of cads) {
        const key = `${contato.id}:${cad.id}:${cad.passo_ordem}`;
        if (enviosSet.has(key)) continue;
        const em = marco + cad.offset_horas * 60 * 60 * 1000;
        if (!proxima || em < proxima.em) {
          proxima = { rotulo: cad.modo === 'auto' ? 'Envio automatico' : 'Aprovacao', em };
        }
      }
      if (proxima) {
        contato.proxima_acao = proxima.rotulo;
        contato.proxima_acao_em = new Date(proxima.em).toISOString();
      } else {
        contato.proxima_acao = null;
        contato.proxima_acao_em = null;
      }

      estagios[estagio].push(contato);
    }

    return { success: true, estagios };
  } catch (error) {
    console.error('[Funil] Erro ao buscar contatos do funil:', error);
    return { success: false, error: 'Erro ao buscar contatos do funil' };
  }
}

/**
 * Move um contato para outro estagio (acao de arrastar o card no Kanban).
 * - Atualiza estagio + estagio_desde (reinicia o marco das cadencias de lead).
 * - Cancela cadencias pendentes e itens de fila nao enviados do estagio anterior.
 * - Registra no historico.
 */
export async function moverContatoEstagio(
  contatoId: number,
  estagio: FunilEstagio,
  ordem = 0,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!FUNIL_ESTAGIOS.includes(estagio)) {
      return { success: false, error: 'Estagio invalido' };
    }

    const contatoAtual = await pg.findById<{ estagio: string }>(
      REMARKETING_CONTATOS_TABLE,
      contatoId,
    );
    if (!contatoAtual) {
      return { success: false, error: 'Contato nao encontrado' };
    }

    const estagioAnterior = contatoAtual.estagio;

    // Atualiza o contato
    await pg.update(REMARKETING_CONTATOS_TABLE, contatoId, {
      estagio,
      estagio_desde: new Date().toISOString(),
      kanban_ordem: ordem,
      updated_at: new Date().toISOString(),
    });

    // Cancela cadencias agendadas e itens de fila ainda nao enviados
    // (apenas os que ainda nao sairam: agendado / aguardando aprovacao / pendente)
    const enviosPendentes = await pg.raw<{ id: number; fila_id: number | null }>(`
      SELECT id, fila_id
      FROM "${REMARKETING_CADENCIA_ENVIOS_TABLE}"
      WHERE contato_id = $1 AND status = 'agendado'
    `, [contatoId]);

    for (const envio of enviosPendentes) {
      await pg.update(REMARKETING_CADENCIA_ENVIOS_TABLE, envio.id, { status: 'cancelado' });
      if (envio.fila_id) {
        await pg.raw(`
          UPDATE "${REMARKETING_FILA_TABLE}"
          SET status = 'cancelado'
          WHERE id = $1 AND status IN ('pendente', '${STATUS_AGUARDANDO_APROVACAO}')
        `, [envio.fila_id]);
      }
    }

    // Historico
    await pg.create(REMARKETING_HISTORICO_TABLE, {
      contato_id: contatoId,
      tipo: 'funil_mover',
      descricao: `Movido de "${estagioAnterior}" para "${estagio}"`,
      dados: JSON.stringify({ de: estagioAnterior, para: estagio }),
      created_at: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error('[Funil] Erro ao mover contato:', error);
    return { success: false, error: 'Erro ao mover contato de estagio' };
  }
}

// ============================================================
// CADENCIAS (CRUD)
// ============================================================

export async function getCadencias(): Promise<{
  success: boolean;
  cadencias?: Cadencia[];
  error?: string;
}> {
  try {
    const cadencias = await pg.raw<Cadencia>(`
      SELECT c.*,
        m.nome as mensagem_nome,
        m.conteudo as mensagem_conteudo
      FROM "${REMARKETING_CADENCIAS_TABLE}" c
      LEFT JOIN "${REMARKETING_MENSAGENS_TABLE}" m ON m.id = c.mensagem_id
      ORDER BY c.estagio ASC, c.passo_ordem ASC
    `);
    return { success: true, cadencias };
  } catch (error) {
    console.error('[Funil] Erro ao buscar cadencias:', error);
    return { success: false, error: 'Erro ao buscar cadencias' };
  }
}

export async function upsertCadencia(data: {
  id?: number;
  estagio: string;
  passo_ordem: number;
  rotulo?: string | null;
  offset_horas: number;
  recorrente?: boolean;
  intervalo_horas?: number | null;
  mensagem_id?: number | null;
  modo?: 'auto' | 'aprovacao';
  ativo?: boolean;
}): Promise<{ success: boolean; cadencia?: Cadencia; error?: string }> {
  try {
    const payload = {
      estagio: data.estagio,
      passo_ordem: data.passo_ordem,
      rotulo: data.rotulo ?? null,
      offset_horas: data.offset_horas,
      recorrente: data.recorrente ?? false,
      intervalo_horas: data.intervalo_horas ?? null,
      mensagem_id: data.mensagem_id ?? null,
      modo: data.modo ?? 'aprovacao',
      ativo: data.ativo ?? true,
    };

    let cadencia: Cadencia;
    if (data.id) {
      cadencia = await pg.update<Cadencia>(REMARKETING_CADENCIAS_TABLE, data.id, payload);
    } else {
      cadencia = await pg.create<Cadencia>(REMARKETING_CADENCIAS_TABLE, {
        ...payload,
        created_at: new Date().toISOString(),
      });
    }
    return { success: true, cadencia };
  } catch (error) {
    console.error('[Funil] Erro ao salvar cadencia:', error);
    return { success: false, error: 'Erro ao salvar cadencia' };
  }
}

export async function deleteCadencia(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    await pg.delete(REMARKETING_CADENCIAS_TABLE, id);
    return { success: true };
  } catch (error) {
    console.error('[Funil] Erro ao deletar cadencia:', error);
    return { success: false, error: 'Erro ao deletar cadencia' };
  }
}

// ============================================================
// CAIXA DE APROVACAO
// ============================================================

export async function getFilaAprovacao(): Promise<{
  success: boolean;
  itens?: FilaAprovacaoItem[];
  error?: string;
}> {
  try {
    const itens = await pg.raw<FilaAprovacaoItem>(`
      SELECT f.id, f.contato_id, f.mensagem_id, f.conteudo_final, f.tipo_midia,
             f.midia_url, f.agendado_para, f.status, f.created_at,
             c.nome as contato_nome,
             c.telefone as contato_telefone,
             c.estagio as contato_estagio
      FROM "${REMARKETING_FILA_TABLE}" f
      LEFT JOIN "${REMARKETING_CONTATOS_TABLE}" c ON c.id = f.contato_id
      WHERE f.status = $1
      ORDER BY f.agendado_para ASC
    `, [STATUS_AGUARDANDO_APROVACAO]);
    return { success: true, itens };
  } catch (error) {
    console.error('[Funil] Erro ao buscar fila de aprovacao:', error);
    return { success: false, error: 'Erro ao buscar fila de aprovacao' };
  }
}

/**
 * Aprova um envio: libera o item para o cron processar (status -> pendente).
 */
export async function aprovarEnvio(filaId: number): Promise<{ success: boolean; error?: string }> {
  try {
    await pg.raw(`
      UPDATE "${REMARKETING_FILA_TABLE}"
      SET status = 'pendente', agendado_para = NOW()
      WHERE id = $1 AND status = $2
    `, [filaId, STATUS_AGUARDANDO_APROVACAO]);

    await pg.create(REMARKETING_HISTORICO_TABLE, {
      tipo: 'funil_aprovado',
      descricao: `Envio #${filaId} aprovado manualmente`,
      dados: JSON.stringify({ fila_id: filaId }),
      created_at: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    console.error('[Funil] Erro ao aprovar envio:', error);
    return { success: false, error: 'Erro ao aprovar envio' };
  }
}

/**
 * Rejeita um envio: cancela o item da fila e o registro de cadencia.
 */
export async function rejeitarEnvio(filaId: number): Promise<{ success: boolean; error?: string }> {
  try {
    await pg.update(REMARKETING_FILA_TABLE, filaId, { status: 'cancelado' });

    await pg.raw(`
      UPDATE "${REMARKETING_CADENCIA_ENVIOS_TABLE}"
      SET status = 'cancelado'
      WHERE fila_id = $1
    `, [filaId]);

    await pg.create(REMARKETING_HISTORICO_TABLE, {
      tipo: 'funil_rejeitado',
      descricao: `Envio #${filaId} descartado`,
      dados: JSON.stringify({ fila_id: filaId }),
      created_at: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    console.error('[Funil] Erro ao rejeitar envio:', error);
    return { success: false, error: 'Erro ao rejeitar envio' };
  }
}

// ============================================================
// MENSAGENS (helper para a aba de cadencias)
// ============================================================

export async function getMensagensFunil(): Promise<{
  success: boolean;
  mensagens?: { id: number; nome: string; conteudo: string }[];
  error?: string;
}> {
  try {
    const mensagens = await pg.raw<{ id: number; nome: string; conteudo: string }>(`
      SELECT id, nome, conteudo
      FROM "${REMARKETING_MENSAGENS_TABLE}"
      WHERE ativo = true
      ORDER BY ordem ASC, nome ASC
    `);
    return { success: true, mensagens };
  } catch (error) {
    console.error('[Funil] Erro ao buscar mensagens:', error);
    return { success: false, error: 'Erro ao buscar mensagens' };
  }
}
