'use client';

import { ZapflowInsightsClient } from '@/components/insights/zapflow-insights-client';
import type { ZapflowInsightsResult } from '@/app/actions/zapflow-insights';

// ROTA TEMPORARIA DE PREVIEW (nao vai para producao)
const MOCK: ZapflowInsightsResult = {
  success: true,
  nome: 'Ricardo Oliveira',
  doCache: true,
  geradoEm: new Date().toISOString(),
  score: {
    valor: 72,
    nivel: 'saudavel',
    resumo: 'Tudo sob controle, da pra crescer mais.',
    fatores: [
      { label: 'Faturamento da semana subiu 18%', impacto: 6 },
      { label: 'Boa base de clientes recorrentes', impacto: 12 },
      { label: 'Alguns cancelamentos hoje', impacto: -7 },
      { label: 'Mais pedidos que ontem', impacto: 4 },
    ],
  },
  metrics: {
    faturamentoHoje: 1240.5,
    faturamentoOntem: 980.0,
    variacaoFaturamento: 27,
    pedidosHoje: 38,
    pedidosOntem: 31,
    ticketHoje: 32.64,
    ticketOntem: 31.6,
    variacaoTicket: 3,
    faturamentoSemana: 7820.0,
    faturamentoSemanaAnterior: 6630.0,
    variacaoSemana: 18,
    pedidosPendentes: 3,
    minutosPedidoMaisAntigo: 12,
    canceladosHoje: 2,
    valorPerdidoHoje: 64.8,
    taxaCancelamento: 5,
    topProdutos: [
      { nome: 'Combo Especial da Casa', qtd: 42 },
      { nome: 'X-Bacon Duplo', qtd: 31 },
      { nome: 'Batata Frita G', qtd: 27 },
      { nome: 'Coca-Cola 2L', qtd: 25 },
      { nome: 'Milkshake Ovomaltine', qtd: 14 },
    ],
    horarioPico: 20,
    pedidosNoPico: 19,
    clientesUnicosSemana: 96,
    clientesRecorrentes: 34,
    diaForte: 'Sexta',
    diaFraco: 'Terca',
    temDados: true,
  },
  ai: {
    saudacao: 'Bom dia, Ricardo!',
    resumoDia:
      'Seu delivery esta indo bem: 38 pedidos hoje e faturamento 27% acima de ontem. O combo da casa segue campeao e a base de clientes fieis cresceu.',
    destaquePositivo: 'O Combo Especial da Casa vendeu 42 unidades na semana e puxou seu faturamento pra cima.',
    alertas: [
      {
        titulo: 'Terca esta fraca',
        descricao: 'Terca e o seu dia de menor faturamento. Vale uma promocao pra girar o movimento.',
        gravidade: 'media',
      },
      {
        titulo: '2 pedidos cancelados hoje',
        descricao: 'R$ 64,80 perdidos. Fique de olho no motivo dos cancelamentos.',
        gravidade: 'baixa',
      },
    ],
    oportunidades: [
      {
        titulo: 'Reative clientes sumidos',
        descricao: 'Voce tem clientes que compraram e nao voltaram nas ultimas semanas.',
        acaoSugerida: 'Criar campanha de recuperacao com cupom',
        tipoAcao: 'campanha',
      },
      {
        titulo: 'Combo no horario de pico',
        descricao: 'As 20h e seu pico. Um combo destacado nesse horario aumenta o ticket.',
        acaoSugerida: 'Destacar combo no cardapio',
        tipoAcao: 'cardapio',
      },
      {
        titulo: 'Cupom para terca',
        descricao: 'Estimule o dia mais fraco com um cupom de valor minimo.',
        acaoSugerida: 'Criar cupom de terca',
        tipoAcao: 'cupom',
      },
      {
        titulo: 'Fidelize os recorrentes',
        descricao: '34 clientes ja voltaram. Um programa de pontos aumenta a frequencia.',
        acaoSugerida: 'Enviar novidade no WhatsApp',
        tipoAcao: 'whatsapp',
      },
    ],
    sugestaoPrincipal: {
      titulo: 'Ataque a terca-feira',
      descricao: 'Seu dia mais fraco tem o maior potencial de crescimento. Um cupom de terca traz retorno rapido.',
      acaoSugerida: 'Criar cupom de 15% para terca',
      tipoAcao: 'cupom',
    },
    analiseClientes: 'Voce atendeu 96 clientes na semana e 34 voltaram a comprar. Boa fidelizacao, da pra aumentar com pontos.',
    fraseMotivacional: 'Cada pedido conta. Bora fazer hoje melhor que ontem!',
  },
};

export default function PreviewInsightsPage() {
  return <ZapflowInsightsClient initialData={MOCK} />;
}
