'use client';

import { useState, useEffect, useRef } from 'react';
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
  Play,
  Sparkles
} from 'lucide-react';

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

// Pizza flutuante animada
function FloatingPizza() {
  return (
    <motion.div 
      className="absolute -right-20 top-20 w-[500px] h-[500px] opacity-90 z-0 hidden lg:block"
      animate={{ 
        y: [0, -20, 0],
        rotate: [0, 5, 0, -5, 0]
      }}
      transition={{ 
        duration: 6, 
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      <div className="relative w-full h-full">
        {/* Pizza base */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-200 via-amber-300 to-amber-400 shadow-2xl" />
        {/* Molho */}
        <div className="absolute inset-8 rounded-full bg-gradient-to-br from-red-500 to-red-700" />
        {/* Queijo */}
        <div className="absolute inset-12 rounded-full bg-gradient-to-br from-yellow-200 via-yellow-300 to-amber-400 opacity-90" />
        {/* Pepperoni */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-red-800 shadow-lg"
            style={{
              left: `${30 + Math.cos(i * 0.8) * 25}%`,
              top: `${30 + Math.sin(i * 0.8) * 25}%`,
            }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, delay: i * 0.2, repeat: Infinity }}
          />
        ))}
        {/* Brilho */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 to-transparent" />
        {/* Vapor */}
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-8 h-24 bg-gradient-to-t from-white/0 via-white/20 to-white/0 rounded-full blur-sm"
            style={{
              left: `${20 + i * 15}%`,
              top: '-10%',
            }}
            animate={{
              y: [-20, -60],
              opacity: [0, 0.6, 0],
              scaleY: [0.5, 1.5],
            }}
            transition={{
              duration: 2 + Math.random(),
              delay: i * 0.4,
              repeat: Infinity,
              ease: "easeOut"
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// Hamburguer flutuante
function FloatingBurger() {
  return (
    <motion.div 
      className="absolute -left-10 bottom-20 w-[400px] h-[300px] z-0 hidden lg:block"
      animate={{ 
        y: [0, 15, 0],
        rotate: [0, -3, 0, 3, 0]
      }}
      transition={{ 
        duration: 5, 
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      <div className="relative w-full h-full flex flex-col items-center justify-center">
        {/* Pao de cima */}
        <motion.div 
          className="w-64 h-20 rounded-t-full bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 shadow-xl z-30"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0 }}
        >
          {/* Gergelim */}
          {[...Array(12)].map((_, i) => (
            <div 
              key={i} 
              className="absolute w-2 h-3 bg-yellow-100 rounded-full"
              style={{
                left: `${15 + (i % 6) * 14}%`,
                top: `${20 + Math.floor(i / 6) * 30}%`,
                transform: 'rotate(15deg)'
              }}
            />
          ))}
        </motion.div>
        
        {/* Alface */}
        <motion.div 
          className="w-72 h-6 -mt-2 bg-gradient-to-r from-green-400 via-green-500 to-green-400 z-20"
          style={{ 
            clipPath: 'polygon(0% 50%, 5% 0%, 10% 50%, 15% 0%, 20% 50%, 25% 0%, 30% 50%, 35% 0%, 40% 50%, 45% 0%, 50% 50%, 55% 0%, 60% 50%, 65% 0%, 70% 50%, 75% 0%, 80% 50%, 85% 0%, 90% 50%, 95% 0%, 100% 50%, 100% 100%, 0% 100%)'
          }}
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.1 }}
        />
        
        {/* Queijo derretendo */}
        <motion.div 
          className="w-68 h-8 -mt-1 bg-gradient-to-b from-yellow-300 to-amber-400 z-10 relative"
          animate={{ y: [0, -2, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.2 }}
        >
          {/* Gotas de queijo */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-4 h-8 bg-gradient-to-b from-yellow-300 to-amber-400 rounded-b-full"
              style={{
                left: `${10 + i * 16}%`,
                top: '100%',
              }}
              animate={{ 
                scaleY: [1, 1.3, 1],
                y: [0, 4, 0]
              }}
              transition={{ 
                duration: 2, 
                delay: i * 0.3, 
                repeat: Infinity 
              }}
            />
          ))}
        </motion.div>
        
        {/* Carne */}
        <motion.div 
          className="w-64 h-10 -mt-1 rounded-sm bg-gradient-to-b from-amber-800 via-amber-900 to-amber-950 shadow-lg"
          animate={{ y: [0, -2, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
        />
        
        {/* Pao de baixo */}
        <motion.div 
          className="w-64 h-12 -mt-1 rounded-b-3xl bg-gradient-to-b from-amber-500 to-amber-600 shadow-xl"
          animate={{ y: [0, -2, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.4 }}
        />
      </div>
    </motion.div>
  );
}

// Planos de preco
const plans = [
  {
    name: 'Start',
    price: 79.90,
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
              <a href="#faq" className="text-sm text-gray-400 hover:text-white transition-colors">FAQ</a>
            </nav>
            
            <div className="flex items-center gap-3">
              <Link 
                href="/login" 
                className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:block"
              >
                Entrar
              </Link>
              <Link 
                href="/login"
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-sm font-semibold transition-colors"
              >
                Comecar Gratis
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <motion.section 
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden"
      >
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/20 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        
        {/* Floating food elements */}
        <FloatingPizza />
        <FloatingBurger />
        
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Badge */}
            <motion.div 
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-8"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-400 font-medium">Novo: Agente de IA para WhatsApp</span>
            </motion.div>
            
            {/* Main headline */}
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black leading-tight mb-6">
              <span className="block">Seu delivery</span>
              <span className="block mt-2">
                com sabor de{' '}
                <MeltingText className="text-amber-400">sucesso</MeltingText>
              </span>
            </h1>
            
            <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Cardapio digital, pedidos pelo WhatsApp, gestao completa e muito mais. 
              Tudo que seu restaurante precisa para <span className="text-white font-semibold">vender mais</span>.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative">
              <CheeseParticles isActive={isExploding} />
              
              <motion.button
                onClick={handleCTAClick}
                className="relative group px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl text-lg font-bold shadow-xl shadow-emerald-500/25 overflow-hidden"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="relative z-10 flex items-center gap-2">
                  Comecar Agora
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-emerald-500"
                  initial={{ x: '-100%' }}
                  whileHover={{ x: 0 }}
                  transition={{ duration: 0.3 }}
                />
              </motion.button>
              
              <button className="flex items-center gap-2 px-6 py-4 text-gray-400 hover:text-white transition-colors">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                  <Play className="w-5 h-5 ml-0.5" />
                </div>
                <span>Ver demonstracao</span>
              </button>
            </div>
          </motion.div>
          
          {/* Stats */}
          <motion.div 
            className="grid grid-cols-3 gap-8 mt-20 max-w-xl mx-auto"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            {[
              { value: '500+', label: 'Restaurantes' },
              { value: '50k+', label: 'Pedidos/mes' },
              { value: '4.9', label: 'Avaliacao' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl sm:text-3xl font-black text-white">{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
        
        {/* Scroll indicator */}
        <motion.div 
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2">
            <motion.div 
              className="w-1.5 h-2.5 bg-white/40 rounded-full"
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        </motion.div>
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
              <span className="text-emerald-400">vender mais</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Ferramentas poderosas para transformar seu delivery em uma maquina de vendas
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Smartphone,
                title: 'Cardapio Digital',
                description: 'Link personalizado e QR Code para seus clientes acessarem seu cardapio de qualquer lugar.',
                color: 'emerald',
              },
              {
                icon: MessageCircle,
                title: 'Pedidos no WhatsApp',
                description: 'Receba pedidos diretamente no WhatsApp com notificacoes em tempo real.',
                color: 'green',
              },
              {
                icon: CreditCard,
                title: 'Pagamentos Integrados',
                description: 'Aceite Pix, cartoes de credito e debito com taxas competitivas.',
                color: 'amber',
              },
              {
                icon: ChefHat,
                title: 'Painel Kanban',
                description: 'Gerencie pedidos em tempo real com visao completa da cozinha.',
                color: 'orange',
              },
              {
                icon: BarChart3,
                title: 'Relatorios Completos',
                description: 'Acompanhe vendas, produtos mais pedidos e desempenho do seu delivery.',
                color: 'red',
              },
              {
                icon: Clock,
                title: 'Horarios Flexiveis',
                description: 'Configure horarios de funcionamento e pausas automaticas.',
                color: 'rose',
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                className="group relative p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all duration-300"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <div className={`w-14 h-14 rounded-2xl bg-${feature.color}-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`w-7 h-7 text-${feature.color}-400`} />
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
              Planos que cabem no seu{' '}
              <span className="text-amber-400">bolso</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Escolha o plano ideal para o tamanho do seu negocio
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <motion.div
                key={i}
                className={`relative p-6 sm:p-8 rounded-3xl border transition-all duration-300 ${
                  plan.popular 
                    ? 'bg-gradient-to-b from-emerald-950/50 to-emerald-950/20 border-emerald-500/50 scale-105' 
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-emerald-500 rounded-full text-sm font-bold">
                    Mais Popular
                  </div>
                )}
                
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-black">R$ {plan.price.toFixed(2).replace('.', ',')}</span>
                  <span className="text-gray-400">/mes</span>
                </div>
                
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Link
                  href="/login"
                  className={`block w-full py-3 rounded-xl text-center font-semibold transition-colors ${
                    plan.popular
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  Comecar Agora
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-5xl font-black mb-4">
              O que nossos clientes{' '}
              <span className="text-emerald-400">dizem</span>
            </h2>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: 'Carlos Silva',
                role: 'Pizzaria do Carlos',
                content: 'Aumentei minhas vendas em 40% no primeiro mes. O sistema e muito facil de usar!',
                rating: 5,
              },
              {
                name: 'Ana Santos',
                role: 'Burguer House',
                content: 'O atendimento automatico no WhatsApp mudou minha vida. Agora consigo atender muito mais clientes.',
                rating: 5,
              },
              {
                name: 'Roberto Lima',
                role: 'Sushi Express',
                content: 'O painel Kanban e perfeito para organizar os pedidos na cozinha. Recomendo demais!',
                rating: 5,
              },
            ].map((testimonial, i) => (
              <motion.div
                key={i}
                className="p-6 bg-white/5 border border-white/10 rounded-3xl"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, j) => (
                    <Star key={j} className="w-5 h-5 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-gray-300 mb-6">{`"${testimonial.content}"`}</p>
                <div>
                  <div className="font-semibold">{testimonial.name}</div>
                  <div className="text-sm text-gray-500">{testimonial.role}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 sm:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/50 via-transparent to-emerald-950/50" />
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-5xl font-black mb-6">
              Pronto para turbinar seu{' '}
              <span className="text-amber-400">delivery</span>?
            </h2>
            <p className="text-gray-400 text-lg mb-10 max-w-2xl mx-auto">
              Junte-se a centenas de restaurantes que ja estao vendendo mais com o ZapFlow
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/login"
                className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl text-lg font-bold shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all"
              >
                Comecar Gratis
              </Link>
              <a 
                href="https://wa.me/5511999999999" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-4 text-gray-400 hover:text-white transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                Falar com um consultor
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-black">
                <span className="text-emerald-400">Zap</span>Flow
              </span>
            </div>
            
            <div className="flex items-center gap-8 text-sm text-gray-500">
              <a href="#" className="hover:text-white transition-colors">Termos de Uso</a>
              <a href="#" className="hover:text-white transition-colors">Privacidade</a>
              <a href="#" className="hover:text-white transition-colors">Contato</a>
            </div>
            
            <div className="text-sm text-gray-500">
              2024 ZapFlow. Todos os direitos reservados.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
