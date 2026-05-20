'use client';

import { useState, useRef } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { 
  Zap, 
  MessageCircle, 
  CreditCard, 
  BarChart3, 
  Clock, 
  ChefHat,
  Smartphone,
  ArrowRight,
  Check,
  Star,
  Sparkles,
  Flame
} from 'lucide-react';
import { MetaEvents } from '@/components/meta-pixel';

// Componente de texto com efeito de queijo derretendo
function MeltingText({ children, className = '' }: { children: string; className?: string }) {
  return (
    <span className={`relative inline-block ${className}`}>
      <span className="relative z-10">{children}</span>
      <svg className="absolute -bottom-4 left-0 w-full h-8 overflow-visible" viewBox="0 0 100 20" preserveAspectRatio="none">
        <defs>
          <linearGradient id="cheeseGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        {[...Array(8)].map((_, i) => (
          <motion.ellipse
            key={i}
            cx={12 + i * 12}
            cy="5"
            rx="4"
            ry="8"
            fill="url(#cheeseGradient)"
            initial={{ scaleY: 0, y: -10 }}
            animate={{ 
              scaleY: [0, 1.2, 0.8, 1],
              y: [-10, 5, 3, 4 + Math.random() * 4]
            }}
            transition={{ 
              delay: 0.5 + i * 0.1,
              duration: 1.5,
              ease: "easeOut"
            }}
          />
        ))}
      </svg>
    </span>
  );
}

// Particulas de queijo que explodem
function CheeseParticles({ isActive }: { isActive: boolean }) {
  const particles = [...Array(20)].map((_, i) => ({
    id: i,
    x: Math.random() * 200 - 100,
    y: Math.random() * -150 - 50,
    rotation: Math.random() * 360,
    scale: 0.5 + Math.random() * 0.5,
    delay: Math.random() * 0.2,
  }));

  return (
    <AnimatePresence>
      {isActive && (
        <div className="absolute inset-0 pointer-events-none overflow-visible z-50">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute left-1/2 top-1/2 w-4 h-4 rounded-full"
              style={{
                background: `linear-gradient(135deg, #fbbf24, #f59e0b)`,
                boxShadow: '0 0 10px rgba(251, 191, 36, 0.5)',
              }}
              initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
              animate={{ 
                x: p.x, 
                y: p.y, 
                scale: p.scale,
                opacity: 0,
                rotate: p.rotation
              }}
              exit={{ opacity: 0 }}
              transition={{ 
                duration: 0.8,
                delay: p.delay,
                ease: "easeOut"
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}

// Planos de preco
const plans = [
  {
    name: 'Start',
    price: 79.90,
    mascot: '/images/mascot-start.jpg',
    mascotPosition: 'sitting',
    features: [
      'Cardapio digital (Link + QrCode)',
      'Painel Kanban basico',
      'Pix + Cartoes',
      'Taxa Fixa por bairro',
    ],
  },
  {
    name: 'PRO',
    price: 149.90,
    popular: true,
    mascot: '/images/mascot-pro.jpg',
    mascotPosition: 'standing',
    features: [
      'Cardapio digital (Link + QrCode)',
      'Painel Kanban com notificacao no WhatsApp',
      'Pix + Cartoes',
      'Taxa de entregas calculada pelo Google Maps',
      'Agente de IA no WhatsApp',
      'Cupons de desconto',
    ],
  },
  {
    name: 'ELITE',
    price: 297.90,
    mascot: '/images/mascot-elite.jpg',
    mascotPosition: 'pointing',
    features: [
      'Cardapio digital com Customizacao Total',
      'Painel Kanban com notificacao no WhatsApp',
      'Pix + Cartoes',
      'App para os entregadores',
      'Agente de IA no WhatsApp',
      'Cupons de desconto e Programa de pontos',
      'Relatorios de Performance',
    ],
  },
];

export default function LandingPage() {
  const [isExploding, setIsExploding] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.3], [1, 0.95]);

  const handleCTAClick = () => {
    setIsExploding(true);
    setTimeout(() => setIsExploding(false), 1000);
    // Track Meta Pixel event
    MetaEvents.startTrial();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-black">
                <span className="text-emerald-400">Zap</span>Flow
              </span>
            </div>
            
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Recursos</a>
              <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition-colors">Precos</a>
              <a href="#depoimentos" className="text-sm text-gray-400 hover:text-white transition-colors">Depoimentos</a>
            </nav>
            
            <div className="flex items-center gap-3">
              <Link 
                href="https://cardapio.wzapflow.com.br"
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/25"
              >
                Comecar Agora
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <motion.section 
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative min-h-screen flex items-center pt-20 overflow-hidden"
      >
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/20 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Texto do Hero */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              {/* Badge com texto derretido */}
              <motion.div 
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-full mb-8"
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Flame className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold">
                  <span className="text-amber-400">Fome</span>
                  <span className="text-orange-300"> de </span>
                  <span className="text-orange-400">crescer?</span>
                </span>
              </motion.div>
              
              {/* Main headline */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-tight mb-6">
                <span className="block text-white">Seu delivery</span>
                <span className="block mt-2">
                  com sabor de{' '}
                  <MeltingText className="text-amber-400">sucesso</MeltingText>
                </span>
              </h1>
              
              <p className="text-lg sm:text-xl text-gray-400 max-w-xl mb-8 leading-relaxed">
                Cardapio digital irresistivel, pedidos que chegam quentinhos e gestao que faz seu caixa transbordar. 
                Tudo que voce precisa para{' '}
                <span className="text-amber-400 font-bold">vender mais</span>.
              </p>
              
              {/* CTA Button */}
              <div className="flex flex-col sm:flex-row items-start gap-4 relative">
                <CheeseParticles isActive={isExploding} />
                
                <Link href="https://cardapio.wzapflow.com.br">
                  <motion.button
                    onClick={handleCTAClick}
                    className="relative group px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl text-lg font-bold shadow-xl shadow-emerald-500/25 overflow-hidden"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      Quero meu cardapio
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <motion.div 
                      className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-emerald-500"
                      initial={{ x: '-100%' }}
                      whileHover={{ x: 0 }}
                      transition={{ duration: 0.3 }}
                    />
                  </motion.button>
                </Link>
                
                <p className="text-sm text-gray-500 mt-2 sm:mt-0 sm:ml-4 sm:self-center">
                  Sem cartao de credito. Comece em 5 minutos.
                </p>
              </div>
              
              {/* Stats */}
              <motion.div 
                className="grid grid-cols-3 gap-6 mt-12 pt-8 border-t border-white/10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.8 }}
              >
                {[
                  { value: '500+', label: 'Restaurantes ativos' },
                  { value: '50k+', label: 'Pedidos por mes' },
                  { value: '4.9', label: 'Nota dos clientes' },
                ].map((stat, i) => (
                  <div key={i}>
                    <div className="text-2xl sm:text-3xl font-black text-white">{stat.value}</div>
                    <div className="text-xs sm:text-sm text-gray-500">{stat.label}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>
            
            {/* Pizza + Screenshot do Cardapio */}
            <motion.div
              className="relative hidden lg:block"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              {/* Pizza flutuante */}
              <motion.div 
                className="absolute -top-10 -right-10 w-80 h-80 z-20"
                animate={{ 
                  y: [0, -15, 0],
                  rotate: [0, 5, 0, -5, 0]
                }}
                transition={{ 
                  duration: 5, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Image
                  src="/images/pizza-logo.png"
                  alt="Pizza ZapFlow"
                  width={320}
                  height={320}
                  className="drop-shadow-2xl"
                />
              </motion.div>
              
              {/* Screenshot do cardapio */}
              <motion.div 
                className="relative z-10 rounded-3xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Image
                  src="/images/menu-screenshot.png"
                  alt="Cardapio ZapFlow"
                  width={380}
                  height={700}
                  className="w-full"
                />
                {/* Brilho overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />
              </motion.div>
              
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-amber-500/20 blur-3xl -z-10" />
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Features Section */}
      <section id="features" className="py-20 sm:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-5xl font-black mb-4">
              Tudo que voce precisa para{' '}
              <span className="text-amber-400">vender mais</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Ferramentas que transformam clientes famintos em pedidos no seu caixa
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Smartphone,
                title: 'Cardapio que da agua na boca',
                description: 'Fotos em alta qualidade, precos claros e botao de pedir. Seu cliente nao resiste.',
                gradient: 'from-emerald-500/20 to-emerald-600/20',
                iconColor: 'text-emerald-400',
              },
              {
                icon: MessageCircle,
                title: 'Pedidos no WhatsApp',
                description: 'Cliente pediu? Voce recebe na hora. Sem app, sem complicacao, so vendas.',
                gradient: 'from-green-500/20 to-green-600/20',
                iconColor: 'text-green-400',
              },
              {
                icon: CreditCard,
                title: 'Pix e Cartao na hora',
                description: 'Receba pagamentos antes do motoboy sair. Adeus calote, ola lucro.',
                gradient: 'from-amber-500/20 to-amber-600/20',
                iconColor: 'text-amber-400',
              },
              {
                icon: ChefHat,
                title: 'Cozinha organizada',
                description: 'Painel Kanban mostra cada pedido. Nada queima, nada atrasa, cliente feliz.',
                gradient: 'from-orange-500/20 to-orange-600/20',
                iconColor: 'text-orange-400',
              },
              {
                icon: BarChart3,
                title: 'Saiba o que vende mais',
                description: 'Relatorios mostram seus campeoes de venda. Invista no que da retorno.',
                gradient: 'from-red-500/20 to-red-600/20',
                iconColor: 'text-red-400',
              },
              {
                icon: Clock,
                title: 'Aberto quando voce quiser',
                description: 'Configure horarios, pausas e feriados. Seu cardapio obedece voce.',
                gradient: 'from-rose-500/20 to-rose-600/20',
                iconColor: 'text-rose-400',
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                className={`group relative p-6 bg-gradient-to-br ${feature.gradient} border border-white/10 rounded-3xl hover:border-white/20 transition-all duration-300`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5, scale: 1.02 }}
              >
                <div className={`w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`w-7 h-7 ${feature.iconColor}`} />
                </div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 sm:py-32 relative bg-gradient-to-b from-transparent via-emerald-950/10 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-5xl font-black mb-4">
              Escolha o tamanho do seu{' '}
              <span className="text-amber-400">apetite</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Planos que cabem no seu bolso e fazem seu negocio crescer
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-8 items-end">
            {plans.map((plan, i) => (
              <motion.div
                key={i}
                className={`relative ${plan.popular ? 'md:-mt-8' : ''}`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
              >
                {/* Mascote */}
                <motion.div 
                  className={`absolute -top-20 left-1/2 -translate-x-1/2 w-28 h-28 z-20 ${
                    plan.mascotPosition === 'sitting' ? 'rotate-[-5deg]' : 
                    plan.mascotPosition === 'pointing' ? 'rotate-[5deg]' : ''
                  }`}
                  animate={{ 
                    y: [0, -8, 0],
                    rotate: plan.mascotPosition === 'sitting' ? [-5, -8, -5] : 
                            plan.mascotPosition === 'pointing' ? [5, 8, 5] : [0, 3, 0]
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Image
                    src={plan.mascot}
                    alt={`Mascote ${plan.name}`}
                    width={112}
                    height={112}
                    className="rounded-full border-4 border-[#1a1a1a] shadow-xl object-cover"
                  />
                </motion.div>
                
                {/* Card do plano */}
                <div className={`relative p-8 pt-16 rounded-3xl border transition-all duration-300 ${
                  plan.popular 
                    ? 'bg-gradient-to-b from-emerald-900/50 to-[#1a1a1a] border-emerald-500/50 shadow-xl shadow-emerald-500/10' 
                    : 'bg-[#1a1a1a] border-white/10 hover:border-white/20'
                }`}>
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full text-xs font-black uppercase tracking-wider">
                      Mais Popular
                    </div>
                  )}
                  
                  <h3 className="text-2xl font-black mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-sm text-gray-400">R$</span>
                    <span className="text-4xl font-black">{plan.price.toFixed(2).replace('.', ',')}</span>
                    <span className="text-gray-400">/mes</span>
                  </div>
                  
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-start gap-3 text-sm text-gray-300">
                        <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  <Link href="https://cardapio.wzapflow.com.br">
                    <motion.button
                      className={`w-full py-4 rounded-xl font-bold transition-all ${
                        plan.popular 
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40' 
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {plan.popular ? 'Comecar com PRO' : `Escolher ${plan.name}`}
                    </motion.button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="depoimentos" className="py-20 sm:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-5xl font-black mb-4">
              Quem provou,{' '}
              <span className="text-amber-400">aprovou</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Veja o que nossos clientes falam sobre o ZapFlow
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: 'Carlos Silva',
                business: 'Pizzaria do Carlos',
                avatar: '🍕',
                text: 'Triplicamos nossos pedidos em 2 meses. O cardapio digital e lindo e os clientes adoram!',
                rating: 5,
              },
              {
                name: 'Maria Santos',
                business: 'Burger House',
                avatar: '🍔',
                text: 'Antes perdia pedidos no papel. Agora ta tudo organizado e minha cozinha nao para.',
                rating: 5,
              },
              {
                name: 'Joao Oliveira',
                business: 'Acai do Joao',
                avatar: '🍇',
                text: 'O suporte e incrivel! Sempre me ajudam rapido. Recomendo de olhos fechados.',
                rating: 5,
              },
            ].map((testimonial, i) => (
              <motion.div
                key={i}
                className="p-6 bg-white/5 border border-white/10 rounded-3xl"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <h4 className="font-bold">{testimonial.name}</h4>
                    <p className="text-sm text-gray-400">{testimonial.business}</p>
                  </div>
                </div>
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-gray-300 leading-relaxed">&ldquo;{testimonial.text}&rdquo;</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 sm:py-32 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-5xl font-black mb-6">
              Pronto pra fazer seu delivery{' '}
              <span className="text-amber-400">bombar</span>?
            </h2>
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
              Junte-se a mais de 500 restaurantes que ja estao vendendo mais com o ZapFlow
            </p>
            
            <div className="relative inline-block">
              <CheeseParticles isActive={isExploding} />
              <Link href="https://cardapio.wzapflow.com.br">
                <motion.button
                  onClick={handleCTAClick}
                  className="relative group px-10 py-5 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl text-xl font-bold shadow-xl shadow-emerald-500/25 overflow-hidden"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="relative z-10 flex items-center gap-3">
                    Criar meu cardapio gratis
                    <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-emerald-500"
                    initial={{ x: '-100%' }}
                    whileHover={{ x: 0 }}
                    transition={{ duration: 0.3 }}
                  />
                </motion.button>
              </Link>
            </div>
            
            <p className="text-sm text-gray-500 mt-6">
              Sem cartao de credito. Configure em 5 minutos. Cancele quando quiser.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-black">
                <span className="text-emerald-400">Zap</span>Flow
              </span>
            </div>
            
            <p className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} ZapFlow. Todos os direitos reservados.
            </p>
            
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">Termos</a>
              <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">Privacidade</a>
              <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">Contato</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
