// Mensagens do WhatsApp - ZapFlash
// Edite as mensagens abaixo conforme necessário

export const WhatsAppMessages = {
  // =======================================
  // PEDIDO CRIADO
  // =======================================

  orderCreated: (orderId: number, total: number, trackUrl: string, itens: string = '') => {
    const itensFormatados = itens ? `\n🛒 *Itens do pedido:*\n${itens}\n` : '';
    return `
🎉 *Recebemos o seu pedido!*
${itensFormatados}
Olá! O pedido *#${orderId}* chegou certinho aqui pra gente e já está na fila de produção.

💳 *Total:* R$ ${Number(total).toFixed(2).replace('.', ',')}

Fique de olho — você receberá atualizações a cada etapa. Acompanhe tudo em tempo real pelo link abaixo 👇
${trackUrl}

_Obrigado por escolher a gente! 🙏_
`;
  },

  orderScheduled: (orderId: number, total: number, dataAgendamento: string, trackUrl: string, itens: string = '') => {
    const itensFormatados = itens ? `\n🛒 *Itens do pedido:*\n${itens}\n` : '';
    return `
📅 *Tá na agenda!*
${itensFormatados}
Seu pedido *#${orderId}* foi agendado com sucesso!

🕐 *Retire em:* ${dataAgendamento}
💳 *Total:* R$ ${Number(total).toFixed(2).replace('.', ',')}

Vamos deixar tudo fresquinho e pronto no horário combinado. Acompanhe pelo link 👇
${trackUrl}

_Qualquer dúvida, é só chamar! 😊_
`;
  },

  // =======================================
  // STATUS DO PEDIDO
  // =======================================

  status: {
    pagamento_pendente: [
      'Seu pedido foi recebido e registrado, mas o pagamento ainda está pendente. Assim que ele for confirmado, a loja poderá iniciar o preparo. 💳⏳',
      'Pedido anotado! Falta apenas a confirmação do pagamento para liberar o preparo. Você receberá uma nova mensagem assim que estiver tudo certo. ✅',
      'Recebemos seu pedido! O pagamento ainda está aguardando confirmação; assim que aprovado, avisaremos e ele seguirá para a loja. 🚀'
    ],

    aprovado: [
      'Pagamento confirmado! ✅ Seu pedido foi liberado para a loja e em breve seguirá para o preparo.',
      'Deu certo: recebemos a confirmação do pagamento do seu pedido. A loja já pode começar a preparar tudo com carinho! 🎉',
      'Pagamento aprovado! Seu pedido está confirmado e foi encaminhado para a loja. Fique de olho nas próximas atualizações. 🙌'
    ],

    pendente: {
      delivery: [
        'Tudo certo! Seu pedido foi confirmado e já está na nossa fila de produção. Em breve ele estará a caminho da sua casa! 🏠🔥',
        'Pedido confirmado com sucesso! Nossa equipe já recebeu seu pedido e está se organizando para começar o preparo. 🙌✨',
        'Recebemos sua confirmação! Seu pedido já está agendado para preparo. Logo mais avisaremos quando ele sair para entrega! 🛵💨'
      ],
      retirada: [
        'Tudo certo! Seu pedido foi confirmado e já está na nossa fila de produção. Avisaremos assim que estiver pronto para você vir buscar! 🏪✨',
        'Pedido confirmado! Já estamos nos preparando para começar a produção. Fique atento, em breve você poderá vir retirar! 🔔🙌',
        'Confirmado! Seu pedido já está com nossa equipe. Assim que estiver tudo fresquinho no balcão, te avisamos! 👨‍🍳✅'
      ]
    },

    preparando: {
      delivery: [
        'O cheirinho está ótimo! 👨‍🍳 Seu pedido está sendo preparado com todo capricho agora mesmo. Assim que finalizarmos, chamamos o entregador!',
        'Mãos à obra! Nossa equipe está finalizando seu pedido com muito carinho. Em instantes ele estará pronto para a entrega! 📦✨',
        'Cozinha a todo vapor! 🔥 Seu pedido está sendo preparado com ingredientes fresquinhos. Já já ele sai para o seu endereço!'
      ],
      retirada: [
        'Seu pedido está na cozinha! 👨‍🍳 Estamos preparando tudo com muito cuidado para que você receba o melhor sabor. Avisamos quando puder vir buscar!',
        'Mãos na massa! Seu pedido está em produção e logo estará prontinho no balcão esperando por você. 🏪✨',
        'Quase pronto! Estamos finalizando o preparo do seu pedido. Não vai demorar — avisaremos no momento exato da retirada! 🔔🙌'
      ]
    },

    entrega: {
      delivery: [
        'Prepare a mesa! 🛵💨 Seu pedido acabou de sair e o entregador já está a caminho do seu endereço. Fique de olho!',
        'Saiu para entrega! 📍 Nosso entregador já está com seu pedido em mãos e seguindo a rota. Acompanhe pelo link abaixo!',
        'A caminho! 🗺️ Seu pedido já está na rua e chegando até você. Já pode começar a contagem regressiva para saborear! 😄✨'
      ],
      retirada: [
        'Tudo pronto! 🛍️✨ Seu pedido já foi finalizado e está te esperando no balcão. Pode vir buscar quando quiser!',
        'Prontinho para retirada! 🏪 Seu pedido acabou de sair da cozinha e já está disponível para você vir retirar. Te aguardamos!',
        'Vem que está quentinho! 🔥 Seu pedido já está pronto no nosso balcão. Pode passar aqui para retirar agora mesmo!'
      ]
    },

    finalizado: {
      delivery: [
        'Bom apetite! 🍽️🎉 Seu pedido foi entregue. Esperamos que você aproveite cada detalhe. Se puder, conte para nós o que achou!',
        'Entregue com sucesso! ✅ Esperamos que sua experiência tenha sido incrível. Muito obrigado pela preferência e até a próxima! 😊✨',
        'Missão cumprida! 🏆 Seu pedido chegou. Aproveite sua refeição e saiba que adoramos te atender. Volte sempre! ❤️'
      ],
      retirada: [
        'Pedido entregue! ✅ Foi um prazer te atender hoje. Esperamos que aproveite muito seu pedido e volte em breve! 🏪✨',
        'Prontinho e entregue! 🙌 Obrigado por vir retirar seu pedido conosco. Que sua refeição seja excelente!',
        'Tudo certo! Pedido retirado com sucesso. Aproveite cada mordida e conte com a gente para o próximo! 😊❤️'
      ]
    },

    cancelado: [
      'Poxa, seu pedido foi cancelado. 😕 Se houve algum engano ou se precisar de ajuda para entender o motivo, por favor, fale conosco. Esperamos te atender em uma próxima oportunidade! 🙏',
      'Pedido cancelado. Sentimos muito pelo ocorrido. Se precisar de qualquer suporte ou quiser refazer o pedido, estamos à disposição no chat. 💙',
      'Informamos que seu pedido foi cancelado. ❌ Caso queira tirar alguma dúvida ou precise de auxílio, não hesite em nos chamar. Lamentamos o transtorno! 🙏'
    ]
  },

  // =======================================
  // MENSAGEM DE TESTE
  // =======================================

  testMessage: `
🧪 *Mensagem de Teste — ZapFlash*

Tudo certo! Se você recebeu esta mensagem, o sistema está funcionando perfeitamente. 🎉

📱 *Número:* {phone}
⏰ {datetime}

✅ Integração ativa e operacional!
`
};

// Funções helper para gerar mensagens
export function getOrderCreatedMessage(
  orderId: number,
  total: number,
  trackUrl: string,
  isScheduled: boolean = false,
  scheduledDate?: string,
  itens: string = ''
): string {
  if (isScheduled && scheduledDate) {
    const dataFormatada = new Date(scheduledDate).toLocaleString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
    return WhatsAppMessages.orderScheduled(orderId, total, dataFormatada, trackUrl, itens);
  }
  return WhatsAppMessages.orderCreated(orderId, total, trackUrl, itens);
}

// Mensagem enviada ao DONO da loja quando um novo pedido entra pelo cardapio online
export function getOwnerNewOrderMessage(params: {
  orderId: number;
  total: number;
  clienteNome: string;
  clienteTelefone?: string;
  isDelivery: boolean;
  endereco?: string;
  itens?: string;
  pagamento?: string;
  observacoes?: string;
}): string {
  const {
    orderId,
    total,
    clienteNome,
    clienteTelefone,
    isDelivery,
    endereco,
    itens,
    pagamento,
    observacoes,
  } = params;

  const totalFmt = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const tipoEntrega = isDelivery ? '🛵 Entrega' : '🏪 Retirada no local';

  let msg = `🔔 *Novo pedido recebido!*\n\n`;
  msg += `📋 *Pedido #${orderId}*\n`;
  msg += `👤 *Cliente:* ${clienteNome || 'Não informado'}\n`;
  if (clienteTelefone) msg += `📱 *Telefone:* ${clienteTelefone}\n`;
  msg += `\n${tipoEntrega}\n`;
  if (isDelivery && endereco) msg += `📍 *Endereço:* ${endereco}\n`;

  if (itens && itens.trim()) {
    msg += `\n🧾 *Itens:*\n${itens}\n`;
  }

  if (pagamento) msg += `\n💳 *Pagamento:* ${pagamento}\n`;
  if (observacoes && observacoes.trim()) msg += `📝 *Obs.:* ${observacoes}\n`;

  msg += `\n💰 *Total: ${totalFmt}*`;

  return msg;
}

export function getStatusMessage(
  status: string,
  orderId: number,
  isDelivery: boolean,
  trackUrl: string,
  empresaId?: number
): string {
  const statusConfig: Record<string, { emoji: string; title: string }> = {
    'pagamento_pendente': { emoji: '⏳', title: 'Pagamento Pendente' },
    'aprovado': { emoji: '✅', title: 'Pagamento Confirmado!' },
    'pendente': { emoji: '✅', title: 'Pedido Confirmado!' },
    'preparando': { emoji: '👨‍🍳', title: 'Em Preparo' },
    'entrega': { 
      emoji: isDelivery ? '🛵' : '🛍️', 
      title: isDelivery ? 'Saiu para Entrega!' : 'Pronto para Retirada!' 
    },
    'finalizado': { emoji: '🎉', title: isDelivery ? 'Pedido Entregue!' : 'Pedido Finalizado!' },
    'cancelado': { emoji: '❌', title: 'Pedido Cancelado' }
  };

  const statusKey = status as keyof typeof WhatsAppMessages.status;
  const config = statusConfig[statusKey] || { emoji: '📢', title: 'Atualização do Pedido' };

  const variations = WhatsAppMessages.status[statusKey];
  if (!variations) return '';

  const typeKey = isDelivery ? 'delivery' : 'retirada';
  const statusVariations = (variations as any)[typeKey] || variations;
  const variationIndex = orderId % (statusVariations as string[]).length;
  const description = (statusVariations as string[])[variationIndex];

  const deliveryNote = status === 'pagamento_pendente'
    ? '\n⏳ *Pedido aguardando pagamento*'
    : status === 'aprovado'
      ? (isDelivery ? '\n🛵 *Modalidade: entrega*' : '\n🏪 *Modalidade: retirada*')
      : isDelivery ? '\n📍 *Entrega em andamento*' : '\n🏪 *Retirada no local*';

  let message = `${config.emoji} *Pedido #${orderId} — ${config.title}*

${description}${deliveryNote}

📱 *Acompanhe seu pedido:*
${trackUrl}`;

  if (status === 'finalizado' && empresaId) {
    const ratingUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://cardapio.wzapflow.com.br'}/rating/${empresaId}/${orderId}`;
    message += `

⭐ *Sua opinião vale muito!* Avalie o seu pedido em 1 clique:
${ratingUrl}`;
  }

  return message;
}
