'use server';

/**
 * Acoes de "Fechar / Abrir a Loja" manualmente.
 *
 * Permite ao lojista forcar o fechamento do cardapio mesmo dentro do horario
 * de funcionamento (ex.: imprevisto, falta de insumo). O fechamento manual
 * expira automaticamente na PROXIMA abertura programada: a loja volta a abrir
 * sozinha no proximo horario, sem precisar lembrar de reabrir.
 *
 * Persistencia: coluna `fechado_manual_ate` (TEXT, ISO local de Brasilia) na
 * tabela `configuracoes_loja`. Valor preenchido = fechado manualmente ate
 * aquele instante. NULL = sem fechamento manual.
 */

import { pg } from '@/lib/postgres';
import { CONFIGURACOES_LOJA_TABLE, HORARIOS_TABLE } from '@/lib/tables';
import { getMe } from '@/app/actions/auth';
import {
  getStatusLoja,
  getProximaAbertura,
  type Horario,
  type StatusLoja,
} from '@/lib/horarios';

/** Sentinela usada quando nao ha horarios configurados (sem reabertura automatica). */
const SEM_REABERTURA = '2999-12-31T00:00:00';

interface ConfigLoja {
  id: number;
  empresa_id: number;
  fechado_manual_ate?: string | null;
}

async function getContexto(empresaId: number) {
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
    const status = getStatusLoja(horarios, config?.fechado_manual_ate);
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

    await pg.update(CONFIGURACOES_LOJA_TABLE, config.id, {
      fechado_manual_ate: fechadoAte,
    });

    const status = getStatusLoja(horarios, fechadoAte);
    return { ok: true, ...status };
  } catch (error) {
    console.error('[LOJA_STATUS] Erro ao fechar loja:', error);
    return { ok: false, error: 'Erro ao fechar a loja' };
  }
}

/**
 * Reabre a loja manualmente, removendo o fechamento manual. A partir daqui a
 * loja volta a respeitar somente os horarios configurados.
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

    await pg.update(CONFIGURACOES_LOJA_TABLE, config.id, {
      fechado_manual_ate: null,
    });

    const status = getStatusLoja(horarios, null);
    return { ok: true, ...status };
  } catch (error) {
    console.error('[LOJA_STATUS] Erro ao abrir loja:', error);
    return { ok: false, error: 'Erro ao abrir a loja' };
  }
}
