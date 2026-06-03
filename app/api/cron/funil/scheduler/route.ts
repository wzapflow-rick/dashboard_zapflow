import { NextResponse } from 'next/server';
import { pg } from '@/lib/postgres';
import { listAssinaturasAtivas } from '@/lib/assinaturas';
import {
  REMARKETING_CONFIG_TABLE,
  REMARKETING_CONTATOS_TABLE,
  REMARKETING_MENSAGENS_TABLE,
  REMARKETING_FILA_TABLE,
  REMARKETING_HISTORICO_TABLE,
  REMARKETING_CADENCIAS_TABLE,
  REMARKETING_CADENCIA_ENVIOS_TABLE,
  EMPRESAS_TABLE,
} from '@/lib/tables';

const STATUS_AGUARDANDO_APROVACAO = 'aguardando_aprovacao';

/**
 * POST /api/cron/funil/scheduler   (header x-cron-key)
 * GET  /api/cron/funil/scheduler?key=SUA_CHAVE  (para teste no navegador)
 *
 * Motor do funil de follow-up. A cada execucao:
 *  1. Sincroniza Trial/Cliente a partir da tabela assinaturas.
 *  2. Calcula os passos de cadencia devidos por contato (marco do estagio + offset_horas).
 *  3. Enfileira em remarketing_fila:
 *       - modo=auto       -> status 'pendente' (o cron processar envia)
 *       - modo=aprovacao  -> status 'aguardando_aprovacao' (espera aprovacao na UI)
 *  4. Registra em remarketing_cadencia_envios (anti-duplicidade via UNIQUE).
 */

interface Config {
  api_key_cron: string;
  ativo: boolean;
}

interface Contato {
  id: number;
  remote_jid: string;
  telefone: string;
  nome: string | null;
  estagio: string;
  estagio_desde: string | null;
  empresa_id: number | null;
  ativo: boolean;
  bloqueado: boolean;
}

interface CadenciaComMensagem {
  id: number;
  estagio: string;
  passo_ordem: number;
  offset_horas: number;
  recorrente: boolean;
  intervalo_horas: number | null;
  mensagem_id: number | null;
  modo: string;
  ativo: boolean;
  msg_conteudo: string | null;
  msg_tipo_midia: string | null;
  msg_midia_url: string | null;
}

interface Empresa {
  id: number;
  nome_fantasia: string | null;
  nome_admin: string | null;
  telefone_loja: string | null;
}

/** Remove caracteres nao numericos do telefone. */
function normalizarTelefone(tel: string | null): string {
  return (tel || '').replace(/\D/g, '');
}

/** Substitui variaveis {{nome}} / {{telefone}} no template. */
function aplicarVariaveis(template: string, contato: { nome?: string | null; telefone?: string | null }): string {
  return template
    .replace(/\{\{\s*nome\s*\}\}/gi, contato.nome || 'tudo bem')
    .replace(/\{\{\s*telefone\s*\}\}/gi, contato.telefone || '');
}

async function handleRequest(cronKey: string | null, authHeader: string | null) {
  const config = await pg.findOne<Config>(REMARKETING_CONFIG_TABLE);

  if (!config) {
    return NextResponse.json({ error: 'Sistema nao configurado' }, { status: 400 });
  }

  // Autoriza por: (a) CRON_SECRET via Authorization Bearer (cron nativo da Vercel)
  //               (b) api_key_cron via ?key= ou header x-cron-key (teste manual)
  const cronSecret = process.env.CRON_SECRET;
  const autorizadoVercel = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
  const autorizadoChave = cronKey === config.api_key_cron;
  if (!autorizadoVercel && !autorizadoChave) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
  }

  if (!config.ativo) {
    return NextResponse.json({ success: true, message: 'Sistema desativado', enfileirados: 0 });
  }

  const agora = Date.now();

  // ----------------------------------------------------------------
  // 1. SINCRONIZAR TRIAL / CLIENTE a partir das assinaturas
  // ----------------------------------------------------------------
  // marco das cadencias de trial/cliente = data_inicio da assinatura
  const marcoPorEmpresa = new Map<number, { dataInicio: number; estagio: 'trial' | 'cliente' }>();
  let contatosSincronizados = 0;

  const assinaturas = await listAssinaturasAtivas();

  for (const ass of assinaturas) {
    const estagio: 'trial' | 'cliente' = ass.cartao_bandeira === 'TRIA' ? 'trial' : 'cliente';
    const dataInicio = ass.data_inicio ? new Date(ass.data_inicio).getTime() : agora;
    marcoPorEmpresa.set(ass.empresa_id, { dataInicio, estagio });

    // Dados da empresa (telefone do dono)
    const empresa = await pg.findById<Empresa>(EMPRESAS_TABLE, ass.empresa_id);
    if (!empresa) continue;

    const telefone = normalizarTelefone(empresa.telefone_loja);
    if (!telefone) continue;

    const nome = empresa.nome_fantasia || empresa.nome_admin || null;
    const remoteJid = `${telefone}@s.whatsapp.net`;

    // Procura contato ja vinculado a empresa, ou pelo telefone
    const existente = await pg.raw<Contato>(`
      SELECT id, estagio, empresa_id FROM "${REMARKETING_CONTATOS_TABLE}"
      WHERE empresa_id = $1 OR telefone = $2
      ORDER BY (empresa_id = $1) DESC
      LIMIT 1
    `, [ass.empresa_id, telefone]);

    if (existente.length === 0) {
      // Cria novo contato de trial/cliente
      await pg.create(REMARKETING_CONTATOS_TABLE, {
        remote_jid: remoteJid,
        telefone,
        nome,
        origem: 'assinatura',
        estagio,
        estagio_desde: new Date(dataInicio).toISOString(),
        empresa_id: ass.empresa_id,
        kanban_ordem: 0,
        score: 0,
        ativo: true,
        bloqueado: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      contatosSincronizados++;
    } else {
      const contato = existente[0];
      // Atualiza vinculo + estagio quando muda (ex: trial -> cliente)
      const precisaAtualizar =
        contato.empresa_id !== ass.empresa_id || contato.estagio !== estagio;
      if (precisaAtualizar) {
        const patch: Record<string, unknown> = {
          empresa_id: ass.empresa_id,
          updated_at: new Date().toISOString(),
        };
        // So reinicia estagio_desde quando o estagio realmente muda
        if (contato.estagio !== estagio) {
          patch.estagio = estagio;
          patch.estagio_desde = new Date(dataInicio).toISOString();
        }
        await pg.update(REMARKETING_CONTATOS_TABLE, contato.id, patch);
        contatosSincronizados++;
      }
    }
  }

  // ----------------------------------------------------------------
  // 2. CARREGAR cadencias ativas (com mensagem) e contatos do funil
  // ----------------------------------------------------------------
  const cadencias = await pg.raw<CadenciaComMensagem>(`
    SELECT c.id, c.estagio, c.passo_ordem, c.offset_horas, c.recorrente,
           c.intervalo_horas, c.mensagem_id, c.modo, c.ativo,
           m.conteudo as msg_conteudo,
           m.tipo_midia as msg_tipo_midia,
           m.midia_url as msg_midia_url
    FROM "${REMARKETING_CADENCIAS_TABLE}" c
    LEFT JOIN "${REMARKETING_MENSAGENS_TABLE}" m ON m.id = c.mensagem_id
    WHERE c.ativo = true
    ORDER BY c.estagio, c.passo_ordem ASC
  `);

  const cadenciasPorEstagio = new Map<string, CadenciaComMensagem[]>();
  for (const c of cadencias) {
    const arr = cadenciasPorEstagio.get(c.estagio) || [];
    arr.push(c);
    cadenciasPorEstagio.set(c.estagio, arr);
  }

  const contatos = await pg.raw<Contato>(`
    SELECT id, remote_jid, telefone, nome, estagio, estagio_desde, empresa_id, ativo, bloqueado
    FROM "${REMARKETING_CONTATOS_TABLE}"
    WHERE ativo = true AND bloqueado = false
      AND estagio IN ('lead_quente','lead_morno','lead_frio','trial','cliente')
  `);

  // Envios ja registrados (anti-duplicidade)
  const enviosExistentes = await pg.raw<{ contato_id: number; cadencia_id: number; passo_ordem: number }>(`
    SELECT contato_id, cadencia_id, passo_ordem
    FROM "${REMARKETING_CADENCIA_ENVIOS_TABLE}"
    WHERE status <> 'cancelado'
  `);
  const enviosSet = new Set(
    enviosExistentes.map((e) => `${e.contato_id}:${e.cadencia_id}:${e.passo_ordem}`),
  );

  // ----------------------------------------------------------------
  // 3 + 4. CALCULAR passos devidos, enfileirar e registrar
  // ----------------------------------------------------------------
  let enfileiradosAuto = 0;
  let enfileiradosAprovacao = 0;

  for (const contato of contatos) {
    const cads = cadenciasPorEstagio.get(contato.estagio);
    if (!cads || cads.length === 0) continue;

    // Determina o marco do estagio
    let marco: number;
    if (contato.estagio === 'trial' || contato.estagio === 'cliente') {
      const info = contato.empresa_id ? marcoPorEmpresa.get(contato.empresa_id) : undefined;
      if (!info) continue; // sem assinatura ativa -> nao agenda
      marco = info.dataInicio;
    } else {
      marco = contato.estagio_desde ? new Date(contato.estagio_desde).getTime() : agora;
    }

    for (const cad of cads) {
      const key = `${contato.id}:${cad.id}:${cad.passo_ordem}`;
      if (enviosSet.has(key)) continue;

      const dispararEm = marco + cad.offset_horas * 60 * 60 * 1000;
      if (agora < dispararEm) continue; // ainda nao chegou a hora

      if (!cad.msg_conteudo) continue; // cadencia sem mensagem associada

      const conteudoFinal = aplicarVariaveis(cad.msg_conteudo, contato);
      const statusFila = cad.modo === 'auto' ? 'pendente' : STATUS_AGUARDANDO_APROVACAO;

      // Cria item na fila
      const filaItem = await pg.create<{ id: number }>(REMARKETING_FILA_TABLE, {
        contato_id: contato.id,
        mensagem_id: cad.mensagem_id,
        categoria_id: null,
        tipo_dor_id: null,
        prioridade: 3,
        conteudo_final: conteudoFinal,
        tipo_midia: cad.msg_tipo_midia || 'texto',
        midia_url: cad.msg_midia_url || null,
        agendado_para: new Date().toISOString(),
        status: statusFila,
        tentativas: 0,
        max_tentativas: 3,
        created_at: new Date().toISOString(),
      });

      // Registra o envio da cadencia (anti-duplicidade)
      try {
        await pg.create(REMARKETING_CADENCIA_ENVIOS_TABLE, {
          contato_id: contato.id,
          cadencia_id: cad.id,
          passo_ordem: cad.passo_ordem,
          status: 'agendado',
          fila_id: filaItem.id,
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        // Em caso de corrida (UNIQUE), desfaz o item da fila
        await pg.update(REMARKETING_FILA_TABLE, filaItem.id, { status: 'cancelado' });
        continue;
      }

      enviosSet.add(key);
      if (cad.modo === 'auto') enfileiradosAuto++;
      else enfileiradosAprovacao++;
    }
  }

  const totalEnfileirados = enfileiradosAuto + enfileiradosAprovacao;

  // Log de execucao
  await pg.create(REMARKETING_HISTORICO_TABLE, {
    tipo: 'funil_scheduler',
    descricao: `Scheduler: ${contatosSincronizados} sincronizados, ${enfileiradosAuto} auto, ${enfileiradosAprovacao} aprovacao`,
    dados: JSON.stringify({ contatosSincronizados, enfileiradosAuto, enfileiradosAprovacao }),
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({
    success: true,
    message: 'Scheduler do funil executado',
    contatosSincronizados,
    enfileirados: totalEnfileirados,
    enfileiradosAuto,
    enfileiradosAprovacao,
  });
}

export async function POST(request: Request) {
  try {
    const cronKey = request.headers.get('x-cron-key');
    const authHeader = request.headers.get('authorization');
    return await handleRequest(cronKey, authHeader);
  } catch (error) {
    console.error('[Cron Funil Scheduler] Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cronKey = searchParams.get('key');
    const authHeader = request.headers.get('authorization');
    return await handleRequest(cronKey, authHeader);
  } catch (error) {
    console.error('[Cron Funil Scheduler] Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
