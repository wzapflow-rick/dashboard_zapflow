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
      'Estamos aguardando a confirmação do seu pagamento para liberar o pedido para a cozinha. Assim que for aprovado, começamos o preparo imediatamente! 💳⏳',
      'Quase lá! Seu pagamento está em processamento. Assim que recebermos o sinal verde, seu pedido entra direto na produção. ✅',
      'Falta pouco! Só precisamos da confirmação do pagamento para dar início ao seu pedido. Já estamos com tudo pronto para começar! 🚀'
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

    entrega: [
      'Prepare a mesa! 🛵💨 Seu pedido acabou de sair e o entregador já está a caminho do seu endereço. Fique de olho!',
      'Saiu para entrega! 📍 Nosso entregador já está com seu pedido em mãos e seguindo a rota. Acompanhe pelo link abaixo!',
      'A caminho! 🗺️ Seu pedido já está na rua e chegando até você. Já pode começar a contagem regressiva para saborear! 😄✨'
    ],

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