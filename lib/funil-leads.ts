import { pg } from '@/lib/postgres';
import { REMARKETING_CONTATOS_TABLE } from '@/lib/tables';

function normalizarTelefoneBR(tel: string | null | undefined): string {
  const digitos = (tel || '').replace(/\D/g, '');
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  return digitos.slice(0, 20);
}

/**
 * Garante que quem iniciou o cadastro (e pode abandonar) entre no funil
 * como lead quente. Nao altera contatos que ja existem, para nao
 * rebaixar um trial/cliente nem reiniciar cadencias em andamento.
 */
export async function registrarLeadDoCadastro(data: {
  telefone: string | null | undefined;
  nome: string | null | undefined;
  origem?: string;
}): Promise<void> {
  try {
    const telefone = normalizarTelefoneBR(data.telefone);
    if (telefone.length < 12) return;

    const existente = await pg.raw<{ id: number }>(
      `SELECT id FROM "${REMARKETING_CONTATOS_TABLE}"
        WHERE right(regexp_replace(telefone, '\\D', '', 'g'), 11) = right($1, 11)
        LIMIT 1`,
      [telefone],
    );
    if (existente.length > 0) return;

    const agora = new Date().toISOString();
    await pg.create(REMARKETING_CONTATOS_TABLE, {
      remote_jid: `${telefone}@s.whatsapp.net`,
      telefone,
      nome: data.nome || null,
      origem: data.origem || 'signup_pendente',
      estagio: 'lead_quente',
      estagio_desde: agora,
      kanban_ordem: 0,
      score: 70,
      ativo: true,
      bloqueado: false,
      consentimento_status: 'concedido',
      consentimento_base_legal: 'relacao_contratual',
      consentimento_origem: data.origem || 'signup_pendente',
      consentimento_em: agora,
      created_at: agora,
      updated_at: agora,
    });
  } catch (error) {
    console.error('[Funil] Erro ao registrar lead do cadastro:', error);
  }
}
