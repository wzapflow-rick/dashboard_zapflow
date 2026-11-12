/**
 * @file lib/crm-consentimento.ts
 * @description Regras centrais de consentimento e descadastro (opt-out) do CRM ZapFlash.
 *
 * Fonte unica para: deteccao das palavras de descadastro, elegibilidade de envio,
 * rodape de descadastro e registro transacional/idempotente do opt-out.
 */

import { pg } from '@/lib/postgres';
import { avaliarRespostaEvolution } from '@/lib/whatsapp-jid';
import {
  REMARKETING_CONTATOS_TABLE,
  REMARKETING_FILA_TABLE,
  REMARKETING_CADENCIA_ENVIOS_TABLE,
  REMARKETING_HISTORICO_TABLE,
  REMARKETING_OPT_OUT_EVENTOS_TABLE,
  REMARKETING_INTERACOES_TABLE,
} from '@/lib/tables';

/** Instancia Evolution da ZapFlash central. Somente ela alimenta o CRM. */
export const CRM_INSTANCE = 'zapflow_ativacao';

export const PALAVRAS_OPT_OUT = ['SAIR', 'PARAR', 'DESCADASTRAR', 'STOP'] as const;
export type PalavraOptOut = (typeof PALAVRAS_OPT_OUT)[number];

export const MENSAGEM_CONFIRMACAO_OPT_OUT =
  'Pronto! Você não receberá mais mensagens comerciais da ZapFlash por aqui. Se mudar de ideia, é só nos chamar.';

export const RODAPE_OPT_OUT = 'Responda SAIR para não receber mais mensagens.';

/** Estagios com relacao contratual ativa: nao recebem o rodape comercial. */
const ESTAGIOS_SEM_RODAPE = new Set(['trial', 'cliente']);

export type ConsentimentoStatus = 'concedido' | 'pendente' | 'revogado';

export type MotivoBloqueioEnvio =
  | 'contato_inexistente'
  | 'opt_out'
  | 'bloqueado'
  | 'inativo'
  | 'pausado_resposta'
  | 'sem_consentimento';

export const DESCRICAO_MOTIVO_BLOQUEIO: Record<MotivoBloqueioEnvio, string> = {
  contato_inexistente: 'Contato nao encontrado',
  opt_out: 'Contato pediu descadastro (opt-out)',
  bloqueado: 'Contato bloqueado',
  inativo: 'Contato inativo',
  pausado_resposta: 'Automacao pausada: o contato respondeu e aguarda atendimento',
  sem_consentimento: 'Contato sem consentimento registrado',
};

export interface ContatoElegibilidade {
  ativo?: boolean | null;
  bloqueado?: boolean | null;
  opt_out_em?: string | Date | null;
  consentimento_status?: string | null;
  automacao_pausada_em?: string | Date | null;
}

// ============================================================
// REGRAS PURAS
// ============================================================

/**
 * Normaliza a mensagem e retorna a palavra de descadastro se a mensagem
 * contiver SOMENTE ela (ignora maiusculas, acentos e pontuacao/emoji nas pontas).
 */
export function detectarOptOut(texto: string | null | undefined): PalavraOptOut | null {
  if (!texto) return null;
  const normalizado = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .toUpperCase();
  return (PALAVRAS_OPT_OUT as readonly string[]).includes(normalizado)
    ? (normalizado as PalavraOptOut)
    : null;
}

export function motivoBloqueioEnvio(
  contato: ContatoElegibilidade | null | undefined
): MotivoBloqueioEnvio | null {
  if (!contato) return 'contato_inexistente';
  if (contato.opt_out_em || contato.consentimento_status === 'revogado') return 'opt_out';
  if (contato.bloqueado) return 'bloqueado';
  if (contato.ativo === false) return 'inativo';
  if (contato.automacao_pausada_em) return 'pausado_resposta';
  if (contato.consentimento_status !== 'concedido') return 'sem_consentimento';
  return null;
}

export function podeReceberAutomacao(contato: ContatoElegibilidade | null | undefined): boolean {
  return motivoBloqueioEnvio(contato) === null;
}

/** Fragmento SQL equivalente a podeReceberAutomacao, para filtros em lote. */
export function sqlFiltroElegivel(alias = 'c'): string {
  return `${alias}.ativo = true AND ${alias}.bloqueado = false AND ${alias}.opt_out_em IS NULL AND ${alias}.automacao_pausada_em IS NULL AND ${alias}.consentimento_status = 'concedido'`;
}

/** Acrescenta o rodape de descadastro em mensagens comerciais para leads. */
export function aplicarRodapeOptOut(texto: string, estagio?: string | null): string {
  if (estagio && ESTAGIOS_SEM_RODAPE.has(estagio)) return texto;
  if (/\bSAIR\b/i.test(texto)) return texto;
  return `${texto.trimEnd()}\n\n${RODAPE_OPT_OUT}`;
}

/**
 * Chave de comparacao de telefone BR: DDD + 8 ultimos digitos.
 * Torna equivalentes numeros com/sem 55 e com/sem o 9o digito.
 */
export function chaveTelefone(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  let d = String(telefone).split('@')[0].replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  if (d.length < 10 || d.length > 11) return null;
  return d.slice(0, 2) + d.slice(-8);
}

// ============================================================
// REGISTRO DO OPT-OUT (transacional e idempotente)
// ============================================================

export interface RegistrarOptOutInput {
  instancia: string;
  messageId: string;
  remoteJid: string;
  telefone: string | null;
  palavra: PalavraOptOut;
}

export interface RegistrarOptOutResultado {
  status: 'registrado' | 'duplicado';
  primeiroOptOut: boolean;
  contatoIds: number[];
  itensFilaCancelados: number;
  enviosCadenciaCancelados: number;
  confirmacaoEnviada: boolean;
}

export type EnviarConfirmacaoFn = (remoteJid: string, instancia: string) => Promise<boolean>;

export interface ContatoCandidato {
  id: number;
  telefone: string | null;
  remote_jid: string | null;
  opt_out_em: string | null;
  automacao_pausada_em: string | null;
}

type ClienteTransacao = Awaited<ReturnType<typeof pg.getClient>>;

export function jidDoTelefone(telefone: string): string {
  const d = telefone.replace(/\D/g, '');
  return `${d.length <= 11 ? `55${d}` : d}@s.whatsapp.net`;
}

/** JIDs possiveis do remetente (o recebido e o derivado do telefone). */
export function jidsDoRemetente(remoteJid: string, telefone: string | null): string[] {
  return Array.from(
    new Set([remoteJid, telefone ? jidDoTelefone(telefone) : null].filter(Boolean))
  ) as string[];
}

/** Trava por numero: serializa opt-out e respostas simultaneas do mesmo contato. */
export async function travarRemetente(client: ClienteTransacao, chave: string | null, remoteJid: string) {
  await client.query('/* crm:lock */ SELECT pg_advisory_xact_lock(hashtext($1))', [
    `crm_contato:${chave || remoteJid}`,
  ]);
}

/** Contatos do remetente (por JID ou DDD + 8 ultimos digitos), travados para atualizacao. */
export async function buscarContatosDoRemetente(
  client: ClienteTransacao,
  jids: string[],
  chave: string | null
): Promise<ContatoCandidato[]> {
  const candidatos = await client.query<ContatoCandidato>(
    `/* crm:buscar_contatos */
     SELECT id, telefone, remote_jid, opt_out_em, automacao_pausada_em
       FROM "${REMARKETING_CONTATOS_TABLE}"
      WHERE remote_jid = ANY($1::text[])
         OR ($2::text IS NOT NULL AND right(regexp_replace(telefone, '\\D', '', 'g'), 8) = right($2::text, 8))
      FOR UPDATE`,
    [jids, chave]
  );
  return candidatos.rows.filter(
    (c) => (c.remote_jid && jids.includes(c.remote_jid)) || (chave && chaveTelefone(c.telefone) === chave)
  );
}

export async function registrarOptOut(
  input: RegistrarOptOutInput,
  enviarConfirmacao: EnviarConfirmacaoFn = enviarConfirmacaoOptOut
): Promise<RegistrarOptOutResultado> {
  const chave = chaveTelefone(input.telefone);
  const jids = jidsDoRemetente(input.remoteJid, input.telefone);

  const client = await pg.getClient();
  let resultado: RegistrarOptOutResultado;
  let eventoId: number;

  try {
    await client.query('BEGIN');
    await travarRemetente(client, chave, input.remoteJid);

    const evento = await client.query<{ id: number }>(
      `/* crm:inserir_evento */
       INSERT INTO "${REMARKETING_OPT_OUT_EVENTOS_TABLE}"
         (telefone, remote_jid, instancia, message_id, mensagem_recebida)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (instancia, message_id) DO NOTHING
       RETURNING id`,
      [
        input.telefone,
        input.remoteJid.endsWith('@lid') ? input.remoteJid : null,
        input.instancia,
        input.messageId,
        input.palavra,
      ]
    );

    if (evento.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        status: 'duplicado',
        primeiroOptOut: false,
        contatoIds: [],
        itensFilaCancelados: 0,
        enviosCadenciaCancelados: 0,
        confirmacaoEnviada: false,
      };
    }
    eventoId = evento.rows[0].id;

    const contatos = await buscarContatosDoRemetente(client, jids, chave);

    let contatoIds = contatos.map((c) => c.id);
    let primeiroOptOut = contatos.every((c) => !c.opt_out_em);

    if (contatoIds.length === 0) {
      // Numero desconhecido: cria registro de supressao para bloquear futuras importacoes.
      const novo = await client.query<{ id: number }>(
        `/* crm:criar_supressao */
         INSERT INTO "${REMARKETING_CONTATOS_TABLE}"
           (remote_jid, telefone, nome, origem, estagio, estagio_desde, kanban_ordem, score,
            ativo, bloqueado, consentimento_status, opt_out_em, opt_out_motivo, created_at, updated_at)
         VALUES ($1, $2, NULL, 'opt_out', 'perdido', NOW(), 0, 0,
                 true, true, 'revogado', NOW(), $3, NOW(), NOW())
         RETURNING id`,
        [jids[jids.length - 1], input.telefone || '', input.palavra]
      );
      contatoIds = [novo.rows[0].id];
      primeiroOptOut = true;
    } else {
      await client.query(
        `/* crm:bloquear_contatos */
         UPDATE "${REMARKETING_CONTATOS_TABLE}"
            SET bloqueado = true,
                consentimento_status = 'revogado',
                opt_out_em = COALESCE(opt_out_em, NOW()),
                opt_out_motivo = COALESCE(opt_out_motivo, $2),
                updated_at = NOW()
          WHERE id = ANY($1::int[])`,
        [contatoIds, input.palavra]
      );
    }

    const fila = await client.query<{ id: number }>(
      `/* crm:cancelar_fila */
       UPDATE "${REMARKETING_FILA_TABLE}"
          SET status = 'cancelado', erro = 'opt_out'
        WHERE contato_id = ANY($1::int[])
          AND status IN ('pendente', 'aguardando_aprovacao')
        RETURNING id`,
      [contatoIds]
    );
    const envios = await client.query<{ id: number }>(
      `/* crm:cancelar_cadencias */
       UPDATE "${REMARKETING_CADENCIA_ENVIOS_TABLE}"
          SET status = 'cancelado'
        WHERE contato_id = ANY($1::int[])
          AND status = 'agendado'
        RETURNING id`,
      [contatoIds]
    );

    await client.query(
      `/* crm:atualizar_evento */
       UPDATE "${REMARKETING_OPT_OUT_EVENTOS_TABLE}"
          SET contato_id = $2, primeiro_opt_out = $3, itens_fila_cancelados = $4
        WHERE id = $1`,
      [eventoId, contatoIds[0], primeiroOptOut, fila.rows.length]
    );

    for (const contatoId of contatoIds) {
      await client.query(
        `/* crm:historico */
         INSERT INTO "${REMARKETING_HISTORICO_TABLE}" (contato_id, tipo, descricao, dados, created_at)
         VALUES ($1, 'opt_out', $2, $3, NOW())`,
        [
          contatoId,
          `Descadastro solicitado (${input.palavra})`,
          JSON.stringify({
            evento_id: eventoId,
            primeiro_opt_out: primeiroOptOut,
            fila_cancelados: fila.rows.length,
            cadencias_canceladas: envios.rows.length,
          }),
        ]
      );
      await client.query(
        `/* crm:interacao_opt_out */
         INSERT INTO "${REMARKETING_INTERACOES_TABLE}"
           (contato_id, tipo, direcao, instancia, message_id, conteudo, dados)
         VALUES ($1, 'opt_out', 'entrada', $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [
          contatoId,
          input.instancia,
          input.messageId,
          input.palavra,
          JSON.stringify({ fila_cancelados: fila.rows.length, cadencias_canceladas: envios.rows.length }),
        ]
      );
    }

    await client.query('COMMIT');

    resultado = {
      status: 'registrado',
      primeiroOptOut,
      contatoIds,
      itensFilaCancelados: fila.rows.length,
      enviosCadenciaCancelados: envios.rows.length,
      confirmacaoEnviada: false,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  // Fora da transacao: falha na confirmacao nunca desfaz o descadastro.
  if (resultado.primeiroOptOut) {
    try {
      const enviada = await enviarConfirmacao(input.remoteJid, input.instancia);
      if (enviada) {
        await pg.raw(
          `UPDATE "${REMARKETING_OPT_OUT_EVENTOS_TABLE}" SET confirmacao_enviada_em = NOW() WHERE id = $1`,
          [eventoId]
        );
        resultado.confirmacaoEnviada = true;
      }
    } catch (error) {
      console.error('[CRM opt-out] Falha ao enviar confirmacao (descadastro mantido):', error);
    }
  }

  return resultado;
}

/** Envia a confirmacao de descadastro pela instancia central. */
export async function enviarConfirmacaoOptOut(remoteJid: string, instancia: string): Promise<boolean> {
  const baseUrl = process.env.EVOLUTION_API_URL || process.env.EVOLUTION_URL || 'https://evo.wzapflow.com.br';
  const apiKey = process.env.EVOLUTION_API_KEY || '';
  if (!apiKey) return false;

  const response = await fetch(`${baseUrl}/message/sendText/${instancia}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    body: JSON.stringify({ number: remoteJid, text: MENSAGEM_CONFIRMACAO_OPT_OUT }),
    signal: AbortSignal.timeout(10_000),
  });
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  const avaliacao = avaliarRespostaEvolution(response.ok, response.status, data);
  if (!avaliacao.success) {
    console.error('[CRM opt-out] Evolution recusou a confirmacao:', avaliacao.error);
  }
  return avaliacao.success;
}

