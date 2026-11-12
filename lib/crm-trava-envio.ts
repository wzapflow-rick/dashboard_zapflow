import { pg } from '@/lib/postgres';
import { REMARKETING_FILA_TABLE } from '@/lib/tables';

/**
 * Trava unica de envio, compartilhada por todos os agendadores (categorias e
 * funil): no maximo 1 item em andamento por contato e um intervalo minimo
 * entre mensagens automaticas, independente de quem enfileirou.
 */
export const INTERVALO_MINIMO_HORAS = 24;

const STATUS_EM_ANDAMENTO = `'pendente', 'enviando', 'aguardando_aprovacao'`;

/** Fragmento SQL: true quando o contato (alias) pode receber um novo item. */
export function sqlLivreParaEnvio(alias: string): string {
  return `NOT EXISTS (
    SELECT 1 FROM "${REMARKETING_FILA_TABLE}" f_trava
    WHERE f_trava.contato_id = ${alias}.id
      AND (
        f_trava.status IN (${STATUS_EM_ANDAMENTO})
        OR (
          f_trava.status = 'enviado'
          AND f_trava.enviado_em > NOW() - INTERVAL '${INTERVALO_MINIMO_HORAS} hours'
        )
      )
  )`;
}

/** Ids de contatos que estao travados agora (item em andamento ou envio recente). */
export async function listarContatosTravados(): Promise<Set<number>> {
  const rows = await pg.raw<{ contato_id: number }>(`
    SELECT DISTINCT contato_id FROM "${REMARKETING_FILA_TABLE}"
    WHERE status IN (${STATUS_EM_ANDAMENTO})
       OR (status = 'enviado' AND enviado_em > NOW() - INTERVAL '${INTERVALO_MINIMO_HORAS} hours')
  `);
  return new Set(rows.map((r) => Number(r.contato_id)));
}
