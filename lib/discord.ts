/**
 * Servico de Notificacoes Discord
 * Envia alertas para o canal do Discord via webhook
 */

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

interface DiscordEmbed {
  title: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
  };
  timestamp?: string;
}

interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

// Cores para os embeds
const COLORS = {
  success: 0x22c55e,  // Verde
  warning: 0xf59e0b,  // Amarelo
  error: 0xef4444,    // Vermelho
  info: 0x3b82f6,     // Azul
  primary: 0x7CFF6B,  // Verde ZapFlow
};

/**
 * Envia mensagem para o Discord
 */
async function sendToDiscord(message: DiscordMessage): Promise<boolean> {
  console.log('[Discord] Tentando enviar notificacao...');
  console.log('[Discord] Webhook URL existe:', !!DISCORD_WEBHOOK_URL);
  
  if (!DISCORD_WEBHOOK_URL) {
    console.warn('[Discord] Webhook URL nao configurada');
    return false;
  }

  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'ZapFlow Bot',
        ...message,
      }),
    });

    if (!response.ok) {
      console.error('[Discord] Erro ao enviar:', response.status, await response.text());
      return false;
    }

    console.log('[Discord] Notificacao enviada com sucesso!');
    return true;
  } catch (error) {
    console.error('[Discord] Erro ao enviar notificacao:', error);
    return false;
  }
}

/**
 * Notifica nova empresa cadastrada
 */
export async function notifyNewCompany(data: {
  empresaId: number | string;
  nomeFantasia: string;
  email: string;
  telefone?: string;
  plano: string;
  cidade?: string;
  estado?: string;
}): Promise<boolean> {
  return sendToDiscord({
    embeds: [{
      title: '🏪 Nova Empresa Cadastrada!',
      color: COLORS.success,
      fields: [
        { name: 'Empresa', value: data.nomeFantasia || 'N/A', inline: true },
        { name: 'ID', value: String(data.empresaId), inline: true },
        { name: 'Plano', value: data.plano, inline: true },
        { name: 'Email', value: data.email, inline: true },
        { name: 'Telefone', value: data.telefone || 'N/A', inline: true },
        { name: 'Local', value: data.cidade && data.estado ? `${data.cidade}/${data.estado}` : 'N/A', inline: true },
      ],
      footer: { text: 'ZapFlow - Sistema de Gestao' },
      timestamp: new Date().toISOString(),
    }],
  });
}

/**
 * Notifica instancia WhatsApp conectada
 */
export async function notifyWhatsAppConnected(data: {
  empresaId: number | string;
  nomeFantasia: string;
  instancia: string;
  telefone?: string;
}): Promise<boolean> {
  return sendToDiscord({
    embeds: [{
      title: '✅ WhatsApp Conectado',
      description: `A empresa **${data.nomeFantasia}** conectou o WhatsApp com sucesso!`,
      color: COLORS.success,
      fields: [
        { name: 'Empresa', value: data.nomeFantasia, inline: true },
        { name: 'ID', value: String(data.empresaId), inline: true },
        { name: 'Instancia', value: data.instancia, inline: true },
        { name: 'Telefone', value: data.telefone || 'N/A', inline: true },
      ],
      footer: { text: 'Evolution API' },
      timestamp: new Date().toISOString(),
    }],
  });
}

/**
 * Notifica instancia WhatsApp desconectada
 */
export async function notifyWhatsAppDisconnected(data: {
  empresaId: number | string;
  nomeFantasia: string;
  instancia: string;
  motivo?: string;
}): Promise<boolean> {
  return sendToDiscord({
    embeds: [{
      title: '⚠️ WhatsApp Desconectado',
      description: `A empresa **${data.nomeFantasia}** teve o WhatsApp desconectado!`,
      color: COLORS.warning,
      fields: [
        { name: 'Empresa', value: data.nomeFantasia, inline: true },
        { name: 'ID', value: String(data.empresaId), inline: true },
        { name: 'Instancia', value: data.instancia, inline: true },
        { name: 'Motivo', value: data.motivo || 'Nao especificado', inline: false },
      ],
      footer: { text: 'Evolution API' },
      timestamp: new Date().toISOString(),
    }],
  });
}

/**
 * Notifica erro critico no sistema
 */
export async function notifyError(data: {
  titulo: string;
  erro: string;
  local?: string;
  empresaId?: number | string;
  detalhes?: string;
}): Promise<boolean> {
  return sendToDiscord({
    embeds: [{
      title: `🚨 ${data.titulo}`,
      description: `\`\`\`${data.erro}\`\`\``,
      color: COLORS.error,
      fields: [
        ...(data.local ? [{ name: 'Local', value: data.local, inline: true }] : []),
        ...(data.empresaId ? [{ name: 'Empresa ID', value: String(data.empresaId), inline: true }] : []),
        ...(data.detalhes ? [{ name: 'Detalhes', value: data.detalhes, inline: false }] : []),
      ],
      footer: { text: 'ZapFlow - Alerta de Erro' },
      timestamp: new Date().toISOString(),
    }],
  });
}

/**
 * Notifica novo pedido recebido (opcional)
 */
export async function notifyNewOrder(data: {
  empresaId: number | string;
  nomeFantasia: string;
  pedidoId: number | string;
  cliente: string;
  valor: number;
}): Promise<boolean> {
  return sendToDiscord({
    embeds: [{
      title: '🛒 Novo Pedido Recebido',
      color: COLORS.primary,
      fields: [
        { name: 'Empresa', value: data.nomeFantasia, inline: true },
        { name: 'Pedido #', value: String(data.pedidoId), inline: true },
        { name: 'Cliente', value: data.cliente, inline: true },
        { name: 'Valor', value: `R$ ${data.valor.toFixed(2)}`, inline: true },
      ],
      footer: { text: 'ZapFlow - Pedidos' },
      timestamp: new Date().toISOString(),
    }],
  });
}

/**
 * Notifica pagamento de assinatura
 */
export async function notifyPayment(data: {
  empresaId: number | string;
  nomeFantasia: string;
  plano: string;
  valor: number;
  status?: 'approved' | 'pending' | 'rejected';
  metodoPagamento?: string;
}): Promise<boolean> {
  const status = data.status || 'approved';
  const statusText = {
    approved: '✅ Aprovado',
    pending: '⏳ Pendente',
    rejected: '❌ Rejeitado',
  };

  const statusColor = {
    approved: COLORS.success,
    pending: COLORS.warning,
    rejected: COLORS.error,
  };

  const fields = [
    { name: 'Empresa', value: data.nomeFantasia, inline: true },
    { name: 'ID', value: String(data.empresaId), inline: true },
    { name: 'Plano', value: data.plano, inline: true },
    { name: 'Valor', value: `R$ ${data.valor.toFixed(2)}`, inline: true },
    { name: 'Status', value: statusText[status], inline: true },
  ];
  
  if (data.metodoPagamento) {
    fields.push({ name: 'Metodo', value: data.metodoPagamento.toUpperCase(), inline: true });
  }

  return sendToDiscord({
    embeds: [{
      title: '💳 Pagamento de Assinatura',
      color: statusColor[status],
      fields,
      footer: { text: 'Mercado Pago' },
      timestamp: new Date().toISOString(),
    }],
  });
}

/**
 * Envia mensagem personalizada
 */
export async function notifyCustom(
  title: string,
  description: string,
  color: 'success' | 'warning' | 'error' | 'info' = 'info'
): Promise<boolean> {
  return sendToDiscord({
    embeds: [{
      title,
      description,
      color: COLORS[color],
      footer: { text: 'ZapFlow' },
      timestamp: new Date().toISOString(),
    }],
  });
}
