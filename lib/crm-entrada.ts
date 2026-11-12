import {
  detectarOptOut,
  registrarOptOut,
  type EnviarConfirmacaoFn,
} from '@/lib/crm-consentimento';
import { registrarRespostaRecebida } from '@/lib/crm-interacoes';

export interface MensagemEvolution {
  key?: { id?: string; remoteJid?: string; remoteJidAlt?: string; senderPn?: string; fromMe?: boolean };
  message?: Record<string, unknown> & {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string };
    videoMessage?: { caption?: string };
    documentMessage?: { caption?: string };
  };
  messageTimestamp?: number | string;
  senderPn?: string;
  pushName?: string;
}

const CHAVES_SEM_CONTEUDO = new Set(['messageContextInfo', 'senderKeyDistributionMessage']);

function extrairTelefone(data: MensagemEvolution): string | null {
  const candidatos = [data.key?.senderPn, data.senderPn, data.key?.remoteJidAlt, data.key?.remoteJid];
  for (const c of candidatos) {
    if (c && !String(c).endsWith('@lid')) {
      const d = String(c).split('@')[0].replace(/\D/g, '');
      if (d.length >= 10 && d.length <= 13) return d;
    }
  }
  return null;
}

function extrairTexto(data: MensagemEvolution): string {
  const m = data.message;
  return (
    m?.conversation ||
    m?.extendedTextMessage?.text ||
    m?.imageMessage?.caption ||
    m?.videoMessage?.caption ||
    m?.documentMessage?.caption ||
    ''
  );
}

function tipoDaMensagem(data: MensagemEvolution): string {
  const chave = Object.keys(data.message || {}).find((k) => !CHAVES_SEM_CONTEUDO.has(k));
  return chave || 'desconhecido';
}

export interface TratarMensagemCrmResultado {
  httpStatus: number;
  body: Record<string, unknown>;
}

/**
 * Trata mensagens recebidas pela instancia central: opt-out tem prioridade;
 * qualquer outra mensagem entra no historico e pausa a automacao do lead.
 * Nunca aciona o bot dos restaurantes.
 */
export async function tratarMensagemCrm(
  data: MensagemEvolution,
  instancia: string,
  enviarConfirmacao?: EnviarConfirmacaoFn
): Promise<TratarMensagemCrmResultado> {
  const remoteJid = data.key?.remoteJid || '';
  if (!remoteJid) {
    return { httpStatus: 200, body: { received: true, crm: 'sem_remetente' } };
  }
  const messageId = data.key?.id || `${remoteJid}:${data.messageTimestamp ?? ''}`;
  const telefone = extrairTelefone(data);
  const texto = extrairTexto(data);

  const palavra = detectarOptOut(texto);
  if (palavra) {
    try {
      const resultado = await registrarOptOut(
        { instancia, messageId, remoteJid, telefone, palavra },
        enviarConfirmacao
      );
      return { httpStatus: 200, body: { received: true, crm: 'opt_out', resultado: resultado.status } };
    } catch (error) {
      console.error('[CRM opt-out] Erro ao registrar descadastro:', error);
      // 500 faz a Evolution reenviar; o UNIQUE (instancia, message_id) evita duplicidade.
      return { httpStatus: 500, body: { received: false, crm: 'erro_opt_out' } };
    }
  }

  try {
    const resultado = await registrarRespostaRecebida({
      instancia,
      messageId,
      remoteJid,
      telefone,
      nome: data.pushName?.trim() || null,
      texto,
      tipoMensagem: tipoDaMensagem(data),
    });
    return {
      httpStatus: 200,
      body: { received: true, crm: 'resposta', resultado: resultado.status, novo: resultado.novoContato },
    };
  } catch (error) {
    console.error('[CRM resposta] Erro ao registrar resposta:', error);
    return { httpStatus: 500, body: { received: false, crm: 'erro_resposta' } };
  }
}
