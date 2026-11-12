import { pg } from '@/lib/postgres';
import {
  buscarContatosDoRemetente,
  chaveTelefone,
  jidsDoRemetente,
  travarRemetente,
} from '@/lib/crm-consentimento';
import {
  REMARKETING_CADENCIAS_TABLE,
  REMARKETING_CADENCIA_ENVIOS_TABLE,
  REMARKETING_CONTATOS_TABLE,
  REMARKETING_FILA_TABLE,
  REMARKETING_INTERACOES_TABLE,
} from '@/lib/tables';
import { STATUS_AGUARDANDO_APROVACAO } from '@/lib/funil-config';

export type TipoInteracao =
  | 'mensagem_recebida'
  | 'mensagem_enviada'
  | 'estagio_alterado'
  | 'automacao_pausada'
  | 'automacao_retomada'
  | 'atendimento_concluido'
  | 'opt_out';

export type DirecaoInteracao = 'entrada' | 'saida' | 'interna';

export interface Interacao {
  id: number;
  contato_id: number;
  tipo: TipoInteracao;
  direcao: DirecaoInteracao;
  instancia: string | null;
  message_id: string | null;
  conteudo: string | null;
  dados: Record<string, unknown>;
  autor: string | null;
  created_at: string;
}

const LIMITE_CONTEUDO = 2000;

function limitarConteudo(texto: string | null | undefined): string | null {
  const t = (texto || '').trim();
  return t ? t.slice(0, LIMITE_CONTEUDO) : null;
}

export interface NovaInteracao {
  contatoId: number;
  tipo: TipoInteracao;
  direcao?: DirecaoInteracao;
  instancia?: string | null;
  messageId?: string | null;
  conteudo?: string | null;
  dados?: Record<string, unknown>;
  autor?: string | null;
}

/**
 * Grava um evento no historico do lead. Nunca lanca: uma falha no historico
 * nao pode derrubar envio, cron ou webhook que ja concluiram sua acao principal.
 */
export async function registrarInteracao(i: NovaInteracao): Promise<void> {
  try {
    await pg.raw(
      `INSERT INTO "${REMARKETING_INTERACOES_TABLE}"
         (contato_id, tipo, direcao, instancia, message_id, conteudo, dados, autor)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING`,
      [
        i.contatoId,
        i.tipo,
        i.direcao ?? 'interna',
        i.instancia ?? null,
        i.messageId ?? null,
        limitarConteudo(i.conteudo),
        JSON.stringify(i.dados ?? {}),
        i.autor ?? null,
      ]
    );
  } catch (error) {
    console.error('[CRM historico] Falha ao registrar interacao:', i.tipo, i.contatoId, error);
  }
}

export async function listarInteracoes(contatoId: number, limite = 100): Promise<Interacao[]> {
  return pg.raw<Interacao>(
    `SELECT id, contato_id, tipo, direcao, instancia, message_id, conteudo, dados, autor, created_at
       FROM "${REMARKETING_INTERACOES_TABLE}"
      WHERE contato_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2`,
    [contatoId, limite]
  );
}

// ============================================================
// RESPOSTA RECEBIDA NA INSTANCIA CENTRAL
// ============================================================

export interface RespostaRecebidaInput {
  instancia: string;
  messageId: string;
  remoteJid: string;
  telefone: string | null;
  nome: string | null;
  texto: string | null;
  tipoMensagem: string;
}

export interface RespostaRecebidaResultado {
  status: 'registrado' | 'duplicado';
  contatoIds: number[];
  novoContato: boolean;
  pausados: number;
  filaCancelados: number;
}

/**
 * Registra a mensagem no historico, marca o contato para atendimento humano e
 * pausa toda automacao ate alguem retomar manualmente. Numero desconhecido vira
 * lead novo (sem consentimento de marketing, entao nao entra em automacao).
 * Idempotente por (contato, instancia, message_id).
 */
export async function registrarRespostaRecebida(
  input: RespostaRecebidaInput
): Promise<RespostaRecebidaResultado> {
  const chave = chaveTelefone(input.telefone);
  const jids = jidsDoRemetente(input.remoteJid, input.telefone);
  const client = await pg.getClient();

  try {
    await client.query('BEGIN');
    await travarRemetente(client, chave, input.remoteJid);

    let contatos = await buscarContatosDoRemetente(client, jids, chave);
    let novoContato = false;

    if (contatos.length === 0) {
      const criado = await client.query<{ id: number }>(
        `/* crm:lead_entrada */
         INSERT INTO "${REMARKETING_CONTATOS_TABLE}"
           (remote_jid, telefone, nome, origem, estagio, estagio_desde, kanban_ordem, score,
            ativo, bloqueado, consentimento_status, created_at, updated_at)
         VALUES ($1, $2, $3, 'whatsapp_entrada', 'lead_quente', NOW(), 0, 70,
                 true, false, 'pendente', NOW(), NOW())
         RETURNING id`,
        [input.remoteJid, input.telefone || '', input.nome]
      );
      contatos = [
        {
          id: criado.rows[0].id,
          telefone: input.telefone,
          remote_jid: input.remoteJid,
          opt_out_em: null,
          automacao_pausada_em: null,
        },
      ];
      novoContato = true;
    }

    const registrados: number[] = [];
    for (const contato of contatos) {
      const ins = await client.query<{ id: number }>(
        `/* crm:interacao_entrada */
         INSERT INTO "${REMARKETING_INTERACOES_TABLE}"
           (contato_id, tipo, direcao, instancia, message_id, conteudo, dados)
         VALUES ($1, 'mensagem_recebida', 'entrada', $2, $3, $4, $5)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          contato.id,
          input.instancia,
          input.messageId,
          limitarConteudo(input.texto),
          JSON.stringify({ tipo_mensagem: input.tipoMensagem }),
        ]
      );
      if (ins.rows.length > 0) registrados.push(contato.id);
    }

    if (registrados.length === 0) {
      await client.query('ROLLBACK');
      return {
        status: 'duplicado',
        contatoIds: contatos.map((c) => c.id),
        novoContato: false,
        pausados: 0,
        filaCancelados: 0,
      };
    }

    await client.query(
      `/* crm:marcar_resposta */
       UPDATE "${REMARKETING_CONTATOS_TABLE}"
          SET ultima_resposta_em = NOW(),
              ultima_interacao = NOW(),
              primeira_interacao = COALESCE(primeira_interacao, NOW()),
              total_msgs_recebidas = COALESCE(total_msgs_recebidas, 0) + 1,
              automacao_pausada_motivo = CASE WHEN automacao_pausada_em IS NULL
                                              THEN 'respondeu' ELSE automacao_pausada_motivo END,
              automacao_pausada_em = COALESCE(automacao_pausada_em, NOW()),
              atendimento_pendente_em = COALESCE(atendimento_pendente_em, NOW()),
              consentimento_status = CASE WHEN consentimento_status = 'pendente'
                                          THEN 'concedido' ELSE consentimento_status END,
              consentimento_base_legal = CASE WHEN consentimento_status = 'pendente'
                                              THEN 'consentimento' ELSE consentimento_base_legal END,
              consentimento_origem = CASE WHEN consentimento_status = 'pendente'
                                          THEN 'resposta_whatsapp' ELSE consentimento_origem END,
              consentimento_em = CASE WHEN consentimento_status = 'pendente'
                                      THEN NOW() ELSE consentimento_em END,
              updated_at = NOW()
        WHERE id = ANY($1::int[])`,
      [registrados]
    );

    const fila = await client.query<{ id: number }>(
      `/* crm:cancelar_fila_resposta */
       UPDATE "${REMARKETING_FILA_TABLE}"
          SET status = 'cancelado', erro = 'respondeu'
        WHERE contato_id = ANY($1::int[])
          AND status IN ('pendente', $2)
        RETURNING id`,
      [registrados, STATUS_AGUARDANDO_APROVACAO]
    );

    if (fila.rows.length > 0) {
      // 'pulado' (e nao 'cancelado') para o scheduler nao reagendar esses passos.
      await client.query(
        `/* crm:pular_cadencias_resposta */
         UPDATE "${REMARKETING_CADENCIA_ENVIOS_TABLE}"
            SET status = 'pulado'
          WHERE fila_id = ANY($1::int[]) AND status = 'agendado'`,
        [fila.rows.map((f) => f.id)]
      );
    }

    const recemPausados = contatos.filter(
      (c) => registrados.includes(c.id) && !c.automacao_pausada_em
    );
    for (const contato of recemPausados) {
      await client.query(
        `/* crm:interacao_pausa */
         INSERT INTO "${REMARKETING_INTERACOES_TABLE}" (contato_id, tipo, direcao, dados)
         VALUES ($1, 'automacao_pausada', 'interna', $2)`,
        [contato.id, JSON.stringify({ motivo: 'respondeu', fila_cancelados: fila.rows.length })]
      );
    }

    await client.query('COMMIT');
    return {
      status: 'registrado',
      contatoIds: registrados,
      novoContato,
      pausados: recemPausados.length,
      filaCancelados: fila.rows.length,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================
// ACOES HUMANAS
// ============================================================

/**
 * Retoma a automacao. Passos de cadencia que venceram durante a pausa sao
 * marcados como 'pulado' para o lead nao receber varias mensagens de uma vez.
 */
export async function retomarAutomacaoContato(
  contatoId: number,
  autor: string
): Promise<{ retomado: boolean; passosPulados: number }> {
  const client = await pg.getClient();
  try {
    await client.query('BEGIN');
    const atual = await client.query<{ estagio: string; estagio_desde: string | null; automacao_pausada_em: string | null }>(
      `SELECT estagio, estagio_desde, automacao_pausada_em
         FROM "${REMARKETING_CONTATOS_TABLE}" WHERE id = $1 FOR UPDATE`,
      [contatoId]
    );
    const contato = atual.rows[0];
    if (!contato || !contato.automacao_pausada_em) {
      await client.query('ROLLBACK');
      return { retomado: false, passosPulados: 0 };
    }

    await client.query(
      `UPDATE "${REMARKETING_CONTATOS_TABLE}"
          SET automacao_pausada_em = NULL, automacao_pausada_motivo = NULL,
              atendimento_pendente_em = NULL, updated_at = NOW()
        WHERE id = $1`,
      [contatoId]
    );

    const pulados = await client.query<{ id: number }>(
      `INSERT INTO "${REMARKETING_CADENCIA_ENVIOS_TABLE}"
         (contato_id, cadencia_id, passo_ordem, status, created_at)
       SELECT $1, cad.id, cad.passo_ordem, 'pulado', NOW()
         FROM "${REMARKETING_CADENCIAS_TABLE}" cad
        WHERE cad.ativo = true
          AND cad.estagio = $2
          AND COALESCE($3::timestamptz, NOW()) + cad.offset_horas * INTERVAL '1 hour' <= NOW()
       ON CONFLICT (contato_id, cadencia_id, passo_ordem)
         DO UPDATE SET status = 'pulado'
         WHERE "${REMARKETING_CADENCIA_ENVIOS_TABLE}".status = 'cancelado'
       RETURNING id`,
      [contatoId, contato.estagio, contato.estagio_desde]
    );

    await client.query(
      `INSERT INTO "${REMARKETING_INTERACOES_TABLE}" (contato_id, tipo, direcao, autor, dados)
       VALUES ($1, 'automacao_retomada', 'interna', $2, $3)`,
      [contatoId, autor, JSON.stringify({ passos_pulados: pulados.rows.length })]
    );

    await client.query('COMMIT');
    return { retomado: true, passosPulados: pulados.rows.length };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Marca a resposta como atendida. A automacao continua pausada. */
export async function concluirAtendimentoContato(contatoId: number, autor: string): Promise<boolean> {
  const rows = await pg.raw<{ id: number }>(
    `UPDATE "${REMARKETING_CONTATOS_TABLE}"
        SET atendimento_pendente_em = NULL, updated_at = NOW()
      WHERE id = $1 AND atendimento_pendente_em IS NOT NULL
      RETURNING id`,
    [contatoId]
  );
  if (rows.length === 0) return false;
  await registrarInteracao({ contatoId, tipo: 'atendimento_concluido', autor });
  return true;
}
