export const SIGNUP_URL = 'https://cardapio.wzapflow.com.br';

export const display = '[font-family:var(--font-bricolage),ui-sans-serif,system-ui]';

export type Plan = {
  name: string;
  price: number;
  mascot: string;
  summary: string;
  popular?: boolean;
  features: string[];
};

export const plans: Plan[] = [
  {
    name: 'Start',
    price: 79.9,
    mascot: '/images/mascot-start.jpg',
    summary: 'Para tirar o cardápio do papel.',
    features: [
      'Cardápio digital (link + QR Code)',
      'Painel Kanban de pedidos',
      'Pix e cartões',
      'Taxa fixa por bairro',
    ],
  },
  {
    name: 'PRO',
    price: 149.9,
    popular: true,
    mascot: '/images/mascot-pro.jpg',
    summary: 'Para quem vende todo dia pelo WhatsApp.',
    features: [
      'Tudo do Start',
      'Notificações do pedido no WhatsApp',
      'Agente de IA no WhatsApp',
      'Taxa de entrega pelo Google Maps',
      'Cupons de desconto',
    ],
  },
  {
    name: 'ELITE',
    price: 297.9,
    mascot: '/images/mascot-elite.jpg',
    summary: 'Para operação com equipe e entregadores.',
    features: [
      'Tudo do PRO',
      'Cardápio com customização total',
      'App para entregadores',
      'Programa de pontos',
      'Relatórios de performance',
    ],
  },
];

export const faqs = [
  {
    q: 'Vocês cobram comissão por pedido?',
    a: 'Não. Você paga apenas a mensalidade do plano. Todo o valor das vendas fica com o seu restaurante.',
  },
  {
    q: 'Meu cliente precisa baixar algum aplicativo?',
    a: 'Não. O cardápio abre direto no navegador, pelo link ou pelo QR Code na mesa, no balcão ou na embalagem.',
  },
  {
    q: 'Como funciona o agente de IA no WhatsApp?',
    a: 'Nos planos PRO e ELITE, o agente responde dúvidas, envia o link do cardápio e avisa o cliente sobre cada etapa do pedido, inclusive fora do horário.',
  },
  {
    q: 'Quais formas de pagamento posso aceitar?',
    a: 'Pix e cartões em todos os planos. O pagamento é confirmado antes de o pedido ir para a cozinha.',
  },
];

export function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
