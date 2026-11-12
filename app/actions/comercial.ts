'use server';

import { pg } from '@/lib/postgres';
import { requireAdminSession } from '@/lib/admin-session';
import {
  REMARKETING_CONTATOS_TABLE,
  REMARKETING_FILA_TABLE,
  REMARKETING_INTERACOES_TABLE,
} from '@/lib/tables';
import { FUNIL_ESTAGIOS, STATUS_AGUARDANDO_APROVACAO, type FunilEstagio } from '@/lib/funil-config';

export interface TrialVencendo {
  empresa_id: number;
  nome: string;
  trial_end_date: string;
}

export interface ComercialStats {
  leadsPorEstagio: Record<FunilEstagio, number>;
  totalLeads: number;
  novosLeads7d: number;
  contatados7d: number;
  responderam7d: number;
  mensagensEnviadas7d: number;
  atendimentoPendente: number;
  aguardandoAprovacao: number;
  conversoes30d: number;
  consentimento: { concedido: number; pendente: number; optOut: number };
  trialsAtivos: number;
  trialsVencendo: TrialVencendo[];
  mrr: number;
}

async function contar(sql: string): Promise<number> {
  const rows = await pg.raw<{ total: number }>(sql);
  return Number(rows[0]?.total ?? 0);
}

export async function getComercialStats(): Promise<
  { success: true; stats: ComercialStats } | { success: false; error: string }
> {
  await requireAdminSession();

  try {
    const [
      estagios,
      novosLeads7d,
      contatados7d,
      responderam7d,
      mensagensEnviadas7d,
      atendimentoPendente,
      aguardandoAprovacao,
      conversoes30d,
      consentimentoRows,
      trialsAtivos,
      trialsVencendo,
      mrrRows,
    ] = await Promise.all([
      pg.raw<{ estagio: string; total: number }>(
        `SELECT estagio, COUNT(*)::int AS total
           FROM "${REMARKETING_CONTATOS_TABLE}"
          WHERE ativo = true
          GROUP BY estagio`
      ),
      contar(
        `SELECT COUNT(*)::int AS total FROM "${REMARKETING_CONTATOS_TABLE}"
          WHERE created_at >= NOW() - INTERVAL '7 days'`
      ),
      contar(
        `SELECT COUNT(DISTINCT contato_id)::int AS total FROM "${REMARKETING_FILA_TABLE}"
          WHERE status = 'enviado' AND enviado_em >= NOW() - INTERVAL '7 days'`
      ),
      contar(
        `SELECT COUNT(DISTINCT contato_id)::int AS total FROM "${REMARKETING_INTERACOES_TABLE}"
          WHERE tipo = 'mensagem_recebida' AND created_at >= NOW() - INTERVAL '7 days'`
      ),
      contar(
        `SELECT COUNT(*)::int AS total FROM "${REMARKETING_FILA_TABLE}"
          WHERE status = 'enviado' AND enviado_em >= NOW() - INTERVAL '7 days'`
      ),
      contar(
        `SELECT COUNT(*)::int AS total FROM "${REMARKETING_CONTATOS_TABLE}"
          WHERE atendimento_pendente_em IS NOT NULL`
      ),
      contar(
        `SELECT COUNT(*)::int AS total FROM "${REMARKETING_FILA_TABLE}"
          WHERE status = '${STATUS_AGUARDANDO_APROVACAO}'`
      ),
      contar(
        `SELECT COUNT(*)::int AS total FROM "${REMARKETING_CONTATOS_TABLE}"
          WHERE estagio = 'cliente' AND estagio_desde >= NOW() - INTERVAL '30 days'`
      ),
      pg.raw<{ status: string; total: number }>(
        `SELECT CASE WHEN opt_out_em IS NOT NULL THEN 'opt_out' ELSE consentimento_status END AS status,
                COUNT(*)::int AS total
           FROM "${REMARKETING_CONTATOS_TABLE}"
          GROUP BY 1`
      ),
      contar(
        `SELECT COUNT(*)::int AS total FROM assinaturas a
           JOIN empresas e ON e.id = a.empresa_id
          WHERE a.status = 'trialing' AND a.trial_end_date > NOW()
            AND NOT COALESCE(e.conta_teste, false)`
      ),
      pg.raw<TrialVencendo>(
        `SELECT a.empresa_id, e.nome, a.trial_end_date
           FROM assinaturas a
           JOIN empresas e ON e.id = a.empresa_id
          WHERE a.status = 'trialing'
            AND a.trial_end_date > NOW()
            AND a.trial_end_date <= NOW() + INTERVAL '3 days'
            AND NOT COALESCE(e.conta_teste, false)
          ORDER BY a.trial_end_date ASC
          LIMIT 10`
      ),
      pg.raw<{ total: string | null }>(
        `SELECT COALESCE(SUM(a.valor), 0) AS total FROM assinaturas a
           JOIN empresas e ON e.id = a.empresa_id
          WHERE a.status = 'authorized' AND NOT COALESCE(e.conta_teste, false)`
      ),
    ]);

    const leadsPorEstagio = Object.fromEntries(FUNIL_ESTAGIOS.map((e) => [e, 0])) as Record<
      FunilEstagio,
      number
    >;
    for (const row of estagios) {
      if ((FUNIL_ESTAGIOS as readonly string[]).includes(row.estagio)) {
        leadsPorEstagio[row.estagio as FunilEstagio] = Number(row.total);
      }
    }

    const consentimento = { concedido: 0, pendente: 0, optOut: 0 };
    for (const row of consentimentoRows) {
      if (row.status === 'opt_out') consentimento.optOut += Number(row.total);
      else if (row.status === 'concedido') consentimento.concedido += Number(row.total);
      else consentimento.pendente += Number(row.total);
    }

    return {
      success: true,
      stats: {
        leadsPorEstagio,
        totalLeads: Object.values(leadsPorEstagio).reduce((a, b) => a + b, 0),
        novosLeads7d,
        contatados7d,
        responderam7d,
        mensagensEnviadas7d,
        atendimentoPendente,
        aguardandoAprovacao,
        conversoes30d,
        consentimento,
        trialsAtivos,
        trialsVencendo,
        mrr: Number(mrrRows[0]?.total ?? 0),
      },
    };
  } catch (error) {
    console.error('[Comercial] Falha ao carregar metricas:', error);
    return { success: false, error: 'Nao foi possivel carregar as metricas comerciais.' };
  }
}
