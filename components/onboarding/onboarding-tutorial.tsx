'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft,
  Store,
  Package,
  Users,
  ShoppingCart,
  BarChart3,
  Settings,
  Truck,
  Ticket,
  Award,
  Bell,
  Monitor,
  MapPin,
  Bot,
  Check,
  Sparkles
} from 'lucide-react';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  details: string[];
  tip?: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao ZapFlow!',
    description: 'Seu sistema completo para gerenciar seu restaurante ou delivery.',
    icon: Sparkles,
    color: 'from-purple-500 to-pink-500',
    details: [
      'Cardápio digital com carrinho de compras',
      'Kanban de pedidos em tempo real',
      'Sistema de entregadores',
      'Cupons e programa de fidelidade',
      'Notificações automáticas via WhatsApp'
    ],
    tip: 'Este tutorial explica cada parte do painel. Você pode acessá-lo novamente em Configurações > Ajuda.'
  },
  {
    id: 'dashboard',
    title: 'Dashboard Principal',
    description: 'Sua visão geral do negócio em tempo real.',
    icon: BarChart3,
    color: 'from-blue-500 to-cyan-500',
    details: [
      '📈 Gráfico de vendas por hora - veja os horários de pico',
      '💰 Resumo financeiro do dia/semana/mês',
      '📦 Pedidos recentes e pendentes',
      '👥 Novos clientes cadastrados'
    ],
    tip: 'O gráfico mostra apenas horários de operação configurados em Configurações > Horários.'
  },
  {
    id: 'products',
    title: 'Gerenciamento de Produtos',
    description: 'Cadastre e organize seu cardápio.',
    icon: Package,
    color: 'from-green-500 to-emerald-500',
    details: [
      '✅ Criar produtos com fotos, descrições e preços',
      '📋 Organizar por categorias (ex: Lanches, Bebidas)',
      '🧩 Criar grupos de complementos (ex: Escolha 2 adicionais)',
      '📦 Controlar estoque de insumos',
      '⭐ Definir produtos em destaque'
    ],
    tip: 'Use "Produtos em Slot" para criar combos e montáveis personalizados.'
  },
  {
    id: 'orders',
    title: 'Kanban de Pedidos',
    description: 'Acompanhe todos os pedidos em tempo real.',
    icon: Monitor,
    color: 'from-amber-500 to-orange-500',
    details: [
      '⏳ Pagamento Pendente - aguardando confirmação',
      '🔴 Pendente - pedido confirmado',
      '🟡 Preparando - em produção',
      '🔵 Em Entrega - a caminho do cliente',
      '✅ Finalizado - entregue com sucesso'
    ],
    tip: 'Clique no olho (👁️) para ver detalhes completos do pedido.'
  },
  {
    id: 'delivery',
    title: 'Sistema de Entregadores',
    description: 'Gerencie sua equipe de delivery.',
    icon: Truck,
    color: 'from-purple-500 to-violet-500',
    details: [
      '🛵 Cadastrar entregadores com nome, veículo e comissão',
      '📌 Atribuir entregador aos pedidos no Kanban',
      '📊 Acompanhar histórico e desempenho',
      '💰 Comissão automática por entrega'
    ],
    tip: 'Os entregadores acessam /driver no celular para ver seus pedidos.'
  },
  {
    id: 'menu',
    title: 'Cardápio Público',
    description: 'Seu cardápio online para clientes fazerem pedidos.',
    icon: ShoppingCart,
    color: 'from-pink-500 to-rose-500',
    details: [
      '🌐 Acessível via link único (seudominio.com/menu/seu-slug)',
      '🛒 Carrinho de compras integrado',
      '💳 Checkout direto sem WhatsApp',
      '🎫 Aplicação de cupons e pontos',
      '🛵 Opção de delivery ou retirada'
    ],
    tip: 'Seu link do cardápio aparece na tela inicial do Dashboard.'
  },
  {
    id: 'coupons',
    title: 'Cupons de Desconto',
    description: 'Crie promoções para atrair clientes.',
    icon: Ticket,
    color: 'from-red-500 to-pink-500',
    details: [
      '🏷️ Tipos: Percentual (%) ou Valor Fixo (R$)',
      '📊 Limite de uso por cliente ou total',
      '📅 Data de validade',
      '💰 Valor mínimo do pedido',
      '✅ Desativação automática ao atingir limite'
    ],
    tip: 'Cupons podem ser aplicados tanto pelo cliente no cardápio quanto pelo atendente.'
  },
  {
    id: 'loyalty',
    title: 'Programa de Fidelidade',
    description: 'Premie clientes recorrentes com pontos.',
    icon: Award,
    color: 'from-yellow-500 to-amber-500',
    details: [
      '⭐ Clientes ganham pontos a cada compra',
      '🎯 Resgate por desconto em dinheiro',
      '📱 Consulta de saldo pelo cardápio',
      '🏆 Ranking dos melhores clientes'
    ],
    tip: 'Configure quantos pontos por real gasto em Configurações > Fidelidade.'
  },
  {
    id: 'customers',
    title: 'Base de Clientes',
    description: 'Todas as informações dos seus clientes.',
    icon: Users,
    color: 'from-teal-500 to-cyan-500',
    details: [
      '📋 Lista completa de clientes',
      '📱 Telefone, endereço e histórico',
      '⭐ Pontos de fidelidade acumulados',
      '🏷️ Identificação de clientes recorrentes',
      '🔔 Notificações de aniversário'
    ],
    tip: 'Use os filtros para separar novos vs recorrentes.'
  },
  {
    id: 'settings',
    title: 'Configurações',
    description: 'Personalize o sistema para seu negócio.',
    icon: Settings,
    color: 'from-slate-500 to-gray-500',
    details: [
      '🏪 Dados da loja e horário de funcionamento',
      '🛵 Configurações de entrega e taxa',
      '👨‍🍳 Entregadores e comissões',
      '🎫 Cupons e fidelidade',
      '🔔 Notificações WhatsApp',
      '🔒 Segurança e senha'
    ],
    tip: 'Configure sua API do Google Maps para calcular entrega automaticamente.'
  }
];

export default function OnboardingTutorial() {
  const [show, setShow] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenTutorial, setHasSeenTutorial] = useState(true);

  useEffect(() => {
    // Verificar se o usuário já viu o tutorial
    const seen = localStorage.getItem('zapflow_onboarding_seen');
    if (!seen) {
      setHasSeenTutorial(false);
      // Esperar um pouco antes de mostrar
      setTimeout(() => setShow(true), 1500);
    }
  }, []);

  const handleFinish = () => {
    localStorage.setItem('zapflow_onboarding_seen', 'true');
    setHasSeenTutorial(true);
    setShow(false);
  };

  const handleSkip = () => {
    localStorage.setItem('zapflow_onboarding_seen', 'true');
    setHasSeenTutorial(true);
    setShow(false);
  };

  const handleReplay = () => {
    localStorage.removeItem('zapflow_onboarding_seen');
    setCurrentStep(0);
    setShow(true);
  };

  // Expor função para mostrar tutorial novamente (pode ser chamada de Settings)
  useEffect(() => {
    (window as any).showOnboardingTutorial = handleReplay;
    return () => {
      delete (window as any).showOnboardingTutorial;
    };
  }, []);

  if (hasSeenTutorial && !show) {
    // Botão para replay do tutorial
    return (
      <button
        onClick={handleReplay}
        className="fixed bottom-4 right-4 p-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full shadow-lg hover:scale-110 transition-transform z-50"
        title="Ver tutorial novamente"
      >
        <Sparkles className="size-5" />
      </button>
    );
  }

  const step = tutorialSteps[currentStep];
  const Icon = step.icon;
  const isLastStep = currentStep === tutorialSteps.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header with gradient */}
            <div className={`bg-gradient-to-r ${step.color} p-8 text-white text-center`}>
              <motion.div
                key={step.id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.1 }}
                className="size-20 bg-white/20 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              >
                <Icon className="size-10" />
              </motion.div>
              
              <motion.h2
                key={`title-${step.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-bold"
              >
                {step.title}
              </motion.h2>
              
              <motion.p
                key={`desc-${step.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-white/80 mt-2"
              >
                {step.description}
              </motion.p>
            </div>

            {/* Content */}
            <div className="p-6">
              <motion.div
                key={`content-${step.id}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-3"
              >
                {step.details.map((detail, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + index * 0.05 }}
                    className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl"
                  >
                    <span className="text-slate-700">{detail}</span>
                  </motion.div>
                ))}
              </motion.div>

              {step.tip && (
                <motion.div
                  key={`tip-${step.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl"
                >
                  <p className="text-sm text-amber-800">
                    <strong>💡 Dica:</strong> {step.tip}
                  </p>
                </motion.div>
              )}

              {/* Progress indicator */}
              <div className="flex items-center justify-center gap-1 mt-6">
                {tutorialSteps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 rounded-full transition-all ${
                      index === currentStep 
                        ? 'w-8 bg-purple-500' 
                        : index < currentStep 
                          ? 'w-2 bg-purple-300' 
                          : 'w-2 bg-slate-200'
                    }`}
                  />
                ))}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-6">
                {isFirstStep ? (
                  <button
                    onClick={handleSkip}
                    className="text-slate-400 hover:text-slate-600 text-sm"
                  >
                    Pular tutorial
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentStep(prev => prev - 1)}
                    className="flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium"
                  >
                    <ChevronLeft className="size-4" />
                    Anterior
                  </button>
                )}

                {isLastStep ? (
                  <button
                    onClick={handleFinish}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold hover:opacity-90 transition-opacity"
                  >
                    <Check className="size-4" />
                    Começar a usar!
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentStep(prev => prev + 1)}
                    className="flex items-center gap-1 px-4 py-2 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors"
                  >
                    Próximo
                    <ChevronRight className="size-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={handleSkip}
              className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors"
            >
              <X className="size-5" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
