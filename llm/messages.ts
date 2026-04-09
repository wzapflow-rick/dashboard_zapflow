// Mensagens do WhatsApp - ZapFlow
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
      'Seu pedido está reservado, mas ainda aguardamos a confirmação do pagamento. Assim que confirmado, já mandamos pra produção na hora! 💳',
      'Quase lá! Seu pagamento está sendo processado. Em breve tudo estará confirmado e seu pedido entrará em produção.',
      'Aguardamos apenas a confirmação do pagamento para começar a preparar o seu pedido. Já já estamos em ação! ⏳'
    ],

    pendente: {
      delivery: [
        'Pagamento confirmado, show! ✅ Seu pedido já entrou em produção. A cozinha está de olho e em breve ele estará a caminho da sua casa! 🏠',
        'Tudo certo com o pagamento! Seu pedido foi confirmado e já estamos preparando tudo com muito cuidado. 🙌',
        'Recebemos a confirmação! Seu pedido está em produção agora mesmo. Logo mais a gente avisa quando sair para entrega. 🛵'
      ],
      retirada: [
        'Pagamento confirmado! ✅ Seu pedido entrou em produção. Avisamos quando estiver prontinho para retirada! 🏪',
        'Tudo certo! Pedido confirmado e na fila de produção. Fique perto — logo você será chamado para retirar! 🔔',
        'Confirmado! Mãos à obra. Seu pedido já está sendo preparado e em breve poderá ser retirado. 👨‍🍳'
      ]
    },

    preparando: {
      delivery: [
        'Seu pedido está na cozinha agora mesmo! 👨‍🍳 Estamos caprichando em cada detalhe. Assim que ficar pronto, passa para o entregador e você será o primeiro a saber!',
        'Em preparo! A equipe está trabalhando com todo carinho no seu pedido. Em breve sai para entrega. 📦➡🛵',
        'Cozinha em ação! Seu pedido está sendo preparado fresquinho. Já já o entregador estará a caminho. 🔥'
      ],
      retirada: [
        'Seu pedido está sendo preparado com todo carinho! 👨‍🍳 Assim que ficar pronto, avisamos para você vir buscar.',
        'Mãos na massa! Seu pedido está em produção agora. Em breve estará fresquinho e esperando por você no balcão. 🏪',
        'Em preparo! Caprichando em tudo para você. Não vai demorar — avisamos quando estiver pronto! 🔔'
      ]
    },

    entrega: [
      'Tá vindo aí! 🛵💨 Seu pedido saiu do estabelecimento e está a caminho. Fique de olho na porta — o entregador está chegando!',
      'Saiu para entrega! O motoboy já está com o seu pedido e está a caminho. Acompanhe em tempo real pelo link abaixo. 📍',
      'Em rota! 🗺️ Seu pedido foi entregue ao entregador e está chegando até você. Já pode deixar a fominha apertar! 😄'
    ],

    finalizado: {
      delivery: [
        'Chegou! Bom apetite! 🍽️🎉 Esperamos que você curta cada mordida. Se quiser deixar um comentário, adoraríamos ouvir você!',
        'Entregue com sucesso! 🎉 Que a refeição seja incrível. Fico à disposição para o próximo pedido. 😊',
        'Missão cumprida! 🏆 Seu pedido foi entregue. Aproveite muito e volte sempre — adoramos te atender!'
      ],
      retirada: [
        'Pedido pronto! Pode vir buscar quando quiser. 🏃‍♂️ Está fresquinho te esperando no balcão. 🏪',
        'Prontinho! ✅ Seu pedido está no balcão esperando por você. Venha buscar quando puder!',
        'Tudo certo! Seu pedido está pronto e aguardando retirada. Qualquer dúvida, é só falar com a gente. 😊'
      ]
    },

    cancelado: [
      'Infelizmente o pedido foi cancelado. 😕 Se isso foi um engano ou você quiser entender o motivo, entre em contato — estamos aqui para ajudar. Lamentamos o transtorno! 🙏',
      'Pedido cancelado. Se tiver qualquer dúvida ou precisar de suporte, fale com a gente. Esperamos te atender melhor em breve! 💙',
      'Cancelamento realizado. Se precisar de ajuda ou quiser refazer o pedido, é só chamar. Estamos sempre à disposição! 🙏'
    ]
  },

  // =======================================
  // MENSAGEM DE TESTE
  // =======================================

  testMessage: `
🧪 *Mensagem de Teste — ZapFlow*

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

export function getStatusMessage(
  status: string,
  orderId: number,
  isDelivery: boolean,
  trackUrl: string,
  empresaId?: number
): string {
  const statusConfig: Record<string, { emoji: string; title: string }> = {
    'pagamento_pendente': { emoji: '⏳', title: 'Aguardando Pagamento' },
    'pendente': { emoji: '✅', title: 'Pedido Confirmado!' },
    'preparando': { emoji: '👨‍🍳', title: 'Em Preparo' },
    'entrega': { emoji: '🛵', title: 'Saiu para Entrega!' },
    'finalizado': { emoji: '🎉', title: isDelivery ? 'Pedido Entregue!' : 'Pronto para Retirada!' },
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

  const deliveryNote = isDelivery ? '\n📍 *Entrega em andamento*' : '\n🏪 *Retirada no local*';

  let message = `${config.emoji} *Pedido #${orderId} — ${config.title}*

${description}${deliveryNote}

📱 *Acompanhe seu pedido:*
${trackUrl}`;

  if (status === 'finalizado' && empresaId) {
    const ratingUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/rating/${empresaId}/${orderId}`;
    message += `

⭐ *Sua opinião vale muito!* Avalie o seu pedido em 1 clique:
${ratingUrl}`;
  }

  return message;
}