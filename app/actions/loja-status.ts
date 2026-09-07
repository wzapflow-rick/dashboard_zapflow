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
