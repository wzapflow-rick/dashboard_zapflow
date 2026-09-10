'use server';

/**
 * Acoes de "Fechar / Abrir a Loja" manualmente.
 *
 * Permite ao lojista forcar o fechamento do cardapio mesmo dentro do horario
 * de funcionamento (ex.: imprevisto, falta de insumo). O fechamento manual
 * expira automaticamente na PROXIMA abertura programada: a loja volta a abrir
 * sozinha no proximo horario, sem precisar lembrar de reabrir.
 *
 * Persistencia (tabela `configuracoes_loja`, ambos TEXT ISO local de Brasilia):
 *  - `fechado_manual_ate`: preenchido = fechado manualmente ate aquele instante.
 *  - `aberto_manual_ate`: preenchido = ABERTO manualmente (forcado) ate aquele
 *    instante, mesmo que o horario diga fechado (ex.: feriado). NULL nos dois =
 *    sem override, vale so o horario. Os dois nunca ficam ativos juntos: cada
 *    acao limpa a outra coluna.
 */

import { pg } from '@/lib/postgres';
import { CONFIGURACOES_LOJA_TABLE, HORARIOS_TABLE } from '@/lib/tables';
import { getMe } from '@/app/actions/auth';
import {
  getStatusLoja,
  getProximaAbertura,
  isAbertoAgora,
  fimDoDiaBrasiliaIso,
  type Horario,
  type StatusLoja,
} from '@/lib/horarios';

/** Sentinela usada quando nao ha horarios configurados (sem reabertura automatica). */
const SEM_REABERTURA = '2999-12-31T00:00:00';

interface ConfigLoja {
  id: number;
  empresa_id: number;
  fechado_manual_ate?: string | null;
  aberto_manual_ate?: string | null;
}

/** Colunas de override manual exigidas em `configuracoes_loja`. */
const OVERRIDE_COLUMNS = ['fechado_manual_ate', 'aberto_manual_ate'] as const;

/**
 * SQL para o lojista aplicar manualmente no pgAdmin caso as colunas de override
 * ainda nao existam. Exibido no log uma unica vez por processo.
 */
const OVERRIDE_SCHEMA_SQL =
  `ALTER TABLE ${CONFIGURACOES_LOJA_TABLE} ADD COLUMN IF NOT EXISTS fechado_manual_ate TEXT;\n` +
  `ALTER TABLE ${CONFIGURACOES_LOJA_TABLE} ADD COLUMN IF NOT EXISTS aberto_manual_ate TEXT;`;

// Cache por processo: a verificacao roda uma unica vez, nao a cada request.
let overrideSchemaVerificado = false;

/**
 * Verifica (sem alterar o banco) se as colunas de override manual existem em
 * `configuracoes_loja`.
 *
 * O banco roda numa VPS do cliente e o usuario de conexao NAO e dono da tabela,
 * entao qualquer `ALTER TABLE` falha com 42501 ("must be owner of table") —
 * mesmo com `IF NOT EXISTS`, pois o Postgres checa a propriedade antes de ver
 * se a coluna existe. Por isso apenas consultamos `information_schema` (um
 * SELECT, permitido a qualquer usuario) e, se faltar alguma coluna, registramos
 * o SQL para o lojista aplicar manualmente no pgAdmin. O resultado e cacheado
 * por processo para nao repetir a consulta a cada acesso.
 */
async function ensureLojaStatusSchema() {
  if (overrideSchemaVerificado) return;

  try {
    const rows = await pg.raw<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = $1 AND column_name = ANY($2)`,
      [CONFIGURACOES_LOJA_TABLE, OVERRIDE_COLUMNS as unknown as string[]],
    );

    const existentes = new Set(rows.map((r) => r.column_name));
    const faltando = OVERRIDE_COLUMNS.filter((c) => !existentes.has(c));

    if (faltando.length > 0) {
      console.warn(
        `[LOJA_STATUS] Colunas de override manual ausentes em ${CONFIGURACOES_LOJA_TABLE}: ${faltando.join(', ')}. ` +
          `Aplique no pgAdmin:\n${OVERRIDE_SCHEMA_SQL}`,
      );
    }

    // Marca como verificado mesmo se faltarem colunas: nao adianta repetir a
    // consulta a cada request; o aviso acima ja instrui a correcao manual.
    overrideSchemaVerificado = true;
  } catch (error) {
    // Nao marca como verificado para permitir nova tentativa em caso de falha
    // transitoria de conexao.
    console.error('[LOJA_STATUS] Erro ao verificar schema de override manual:', error);
  }
}

async function getContexto(empresaId: number) {
  await ensureLojaStatusSchema();
  const [config, horariosData] = await Promise.all([
    pg.findOne<ConfigLoja>(CONFIGURACOES_LOJA_TABLE, { where: { empresa_id: empresaId } }),
    pg.listAll<Horario>(HORARIOS_TABLE, { where: { empresa_id: empresaId } }),
  ]);
  return { config, horarios: (horariosData || []) as Horario[] };
}

/**
 * Retorna o status atual da loja para o lojista logado.
 */
export async function getLojaStatus(): Promise<
  (StatusLoja & { ok: true }) | { ok: false; error: string }
> {
  try {
    const user = await getMe();
    if (!user?.empresaId) return { ok: false, error: 'Nao autenticado' };

    const { config, horarios } = await getContexto(user.empresaId);
    const status = getStatusLoja(
      horarios,
      config?.fechado_manual_ate,
      config?.aberto_manual_ate,
    );
    return { ok: true, ...status };
  } catch (error) {
    console.error('[LOJA_STATUS] Erro ao obter status:', error);
    return { ok: false, error: 'Erro ao obter status da loja' };
  }
}

/**
 * Fecha a loja manualmente. A reabertura acontece automaticamente na proxima
 * abertura programada (ou exige reabertura manual se nao houver horarios).
 */
export async function fecharLojaManual(): Promise<
  (StatusLoja & { ok: true }) | { ok: false; error: string }
> {
  try {
    const user = await getMe();
    if (!user?.empresaId) return { ok: false, error: 'Nao autenticado' };

    const { config, horarios } = await getContexto(user.empresaId);
    if (!config) {
      return { ok: false, error: 'Configuracao da loja nao encontrada' };
    }

    const proxima = getProximaAbertura(horarios);
    const fechadoAte = proxima?.iso ?? SEM_REABERTURA;

    // Fechar sempre cancela uma eventual abertura manual (overrides exclusivos).
    await pg.update(CONFIGURACOES_LOJA_TABLE, config.id, {
      fechado_manual_ate: fechadoAte,
      aberto_manual_ate: null,
    });

    const status = getStatusLoja(horarios, fechadoAte, null);
    return { ok: true, ...status };
  } catch (error) {
    console.error('[LOJA_STATUS] Erro ao fechar loja:', error);
    return { ok: false, error: 'Erro ao fechar a loja' };
  }
}

/**
 * Abre a loja manualmente.
 *
 * Dois cenarios:
 *  - Estava fechada apenas por um fechamento manual (horario diz aberto):
 *    basta limpar o fechamento; a loja volta a seguir o horario (fica aberta).
 *  - Esta fechada pelo HORARIO (ex.: feriado, fora do expediente): ativa a
 *    abertura manual forcada ate o fim do dia, para o lojista vender hoje mesmo
 *    fora do horario padrao. Volta a seguir o horario automaticamente amanha.
 */
export async function abrirLojaManual(): Promise<
  (StatusLoja & { ok: true }) | { ok: false; error: string }
> {
  try {
    const user = await getMe();
    if (!user?.empresaId) return { ok: false, error: 'Nao autenticado' };

    const { config, horarios } = await getContexto(user.empresaId);
    if (!config) {
      return { ok: false, error: 'Configuracao da loja nao encontrada' };
    }

    // Se o horario ja abriria a loja, nao precisa de override: apenas cancela o
    // fechamento manual. Se o horario esta fechado, forca aberto ate o fim do dia.
    const abertoPeloHorario = isAbertoAgora(horarios);
    const abertoAte = abertoPeloHorario ? null : fimDoDiaBrasiliaIso();

    await pg.update(CONFIGURACOES_LOJA_TABLE, config.id, {
      fechado_manual_ate: null,
      aberto_manual_ate: abertoAte,
    });

    const status = getStatusLoja(horarios, null, abertoAte);
    return { ok: true, ...status };
  } catch (error) {
    console.error('[LOJA_STATUS] Erro ao abrir loja:', error);
    return { ok: false, error: 'Erro ao abrir a loja' };
  }
}
