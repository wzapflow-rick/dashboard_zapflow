'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Zap, MessageSquare, LayoutGrid, Users, TrendingUp, Clock, ShieldCheck, Smartphone } from 'lucide-react';

const slides = [
  {
    id: 1,
    type: 'cover',
    title: 'Conheca o',
    highlight: 'ZapFlow',
    subtitle: 'O fluxo que impulsiona seu negocio',
  },
  {
    id: 2,
    type: 'problem',
    title: 'Cansado de perder pedidos no WhatsApp?',
    points: [
      'Mensagens perdidas no meio da conversa',
      'Pedidos anotados errado',
      'Clientes esperando resposta',
      'Confusao na cozinha',
    ],
  },
  {
    id: 3,
    type: 'solution',
    title: 'O ZapFlow resolve tudo isso',
    subtitle: 'Sistema completo para gestao do seu delivery e restaurante',
    icon: 'zap',
  },
  {
    id: 4,
    type: 'features',
    title: 'Recursos Poderosos',
    features: [
      { icon: 'smartphone', text: 'Cardapio Digital' },
      { icon: 'message', text: 'Integracao WhatsApp' },
      { icon: 'layout', text: 'Painel de Expedicao' },
      { icon: 'users', text: 'Gestao de Mesas' },
    ],
  },
  {
    id: 5,
    type: 'benefits',
    title: 'Resultados Reais',
    stats: [
      { value: '+127%', label: 'Aumento nas vendas' },
      { value: '-45%', label: 'Reducao no tempo' },
      { value: '24/7', label: 'Atendimento automatico' },
    ],
  },
  {
    id: 6,
    type: 'social',
    title: 'Mais de 500 restaurantes ja confiam no ZapFlow',
    subtitle: 'Junte-se a eles e transforme seu negocio',
  },
  {
    id: 7,
    type: 'cta',
    title: 'Comece Gratis Agora',
    subtitle: 'Teste por 7 dias sem compromisso',
    cta: 'wzapflow.com.br',
  },
];

function SlideContent({ slide }: { slide: typeof slides[0] }) {
  const iconMap: Record<string, React.ReactNode> = {
    smartphone: <Smartphone className="size-8" />,
    message: <MessageSquare className="size-8" />,
    layout: <LayoutGrid className="size-8" />,
    users: <Users className="size-8" />,
    zap: <Zap className="size-16" />,
  };

  if (slide.type === 'cover') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <img
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Logo%204.0-RwXQ9EjpkWR2Pw5nJkUfKxreW3lq7q.png"
          alt="ZapFlow"
          className="w-64 mb-8 drop-shadow-[0_0_30px_rgba(124,255,107,0.5)]"
        />
        <p className="text-2xl text-slate-300 font-light tracking-wide">
          {slide.subtitle}
        </p>
      </div>
    );
  }

  if (slide.type === 'problem') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-10">
        <h2 className="text-3xl font-bold text-white text-center mb-10 leading-tight">
          {slide.title}
        </h2>
        <div className="space-y-4 w-full">
          {slide.points?.map((point, idx) => (
            <div
              key={idx}
              className="flex items-center gap-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4"
            >
              <div className="size-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                <span className="text-red-400 text-lg">✕</span>
              </div>
              <p className="text-slate-200 text-lg">{point}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (slide.type === 'solution') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-10 text-center">
        <div className="size-24 rounded-full bg-gradient-to-br from-[#7CFF6B] to-[#22D15A] flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(124,255,107,0.4)]">
          <Zap className="size-12 text-[#0A0F14]" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-4">{slide.title}</h2>
        <p className="text-xl text-slate-400">{slide.subtitle}</p>
      </div>
    );
  }

  if (slide.type === 'features') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8">
        <h2 className="text-3xl font-bold text-white text-center mb-10">
          {slide.title}
        </h2>
        <div className="grid grid-cols-2 gap-4 w-full">
          {slide.features?.map((feature, idx) => (
            <div
              key={idx}
              className="flex flex-col items-center justify-center gap-3 bg-slate-800/50 border border-slate-700 rounded-2xl p-6"
            >
              <div className="size-14 rounded-xl bg-gradient-to-br from-[#7CFF6B]/20 to-[#22D15A]/20 flex items-center justify-center text-[#7CFF6B]">
                {iconMap[feature.icon]}
              </div>
              <p className="text-white font-semibold text-center">{feature.text}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (slide.type === 'benefits') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8">
        <h2 className="text-3xl font-bold text-white text-center mb-10">
          {slide.title}
        </h2>
        <div className="space-y-4 w-full">
          {slide.stats?.map((stat, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between bg-gradient-to-r from-[#7CFF6B]/10 to-transparent border border-[#7CFF6B]/30 rounded-xl p-5"
            >
              <span className="text-4xl font-bold text-[#7CFF6B]">{stat.value}</span>
              <span className="text-lg text-slate-300 text-right">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (slide.type === 'social') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-10 text-center">
        <div className="flex items-center gap-2 mb-8">
          <Users className="size-10 text-[#7CFF6B]" />
          <span className="text-5xl font-bold text-white">500+</span>
        </div>
        <h2 className="text-2xl font-bold text-white mb-4">{slide.title}</h2>
        <p className="text-lg text-slate-400">{slide.subtitle}</p>
        <div className="flex gap-2 mt-8">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="size-3 rounded-full bg-[#7CFF6B]" />
          ))}
        </div>
      </div>
    );
  }

  if (slide.type === 'cta') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-10 text-center">
        <img
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Logo%204.0-RwXQ9EjpkWR2Pw5nJkUfKxreW3lq7q.png"
          alt="ZapFlow"
          className="w-48 mb-8"
        />
        <h2 className="text-3xl font-bold text-white mb-3">{slide.title}</h2>
        <p className="text-lg text-slate-400 mb-8">{slide.subtitle}</p>
        <div className="px-8 py-4 bg-gradient-to-r from-[#7CFF6B] to-[#22D15A] rounded-full shadow-[0_0_30px_rgba(124,255,107,0.4)]">
          <span className="text-xl font-bold text-[#0A0F14]">{slide.cta}</span>
        </div>
      </div>
    );
  }

  return null;
}

export default function CarrosselPage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  return (
    <div className="min-h-screen bg-[#0A0F14] flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold text-white mb-2">Gerador de Carrossel ZapFlow</h1>
      <p className="text-slate-400 mb-8">Navegue pelos slides e tire screenshot de cada um (1080x1080)</p>

      <div className="flex items-center gap-6">
        <button
          onClick={prevSlide}
          className="size-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white hover:bg-slate-700 transition-colors"
        >
          <ChevronLeft className="size-6" />
        </button>

        {/* Slide Container - 1080x1080 scaled down */}
        <div
          id="slide-container"
          className="relative w-[540px] h-[540px] bg-[#0A0F14] rounded-2xl overflow-hidden border border-slate-800"
          style={{
            background: 'linear-gradient(135deg, #0A0F14 0%, #081D10 50%, #0A0F14 100%)',
          }}
        >
          {/* Background Effects */}
          <div className="absolute inset-0 overflow-hidden">
            {/* Glow effects */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#7CFF6B]/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-[#22D15A]/10 rounded-full blur-3xl" />
            
            {/* Flow lines */}
            <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 540 540">
              <path
                d="M0 400 Q 150 350, 300 380 T 540 340"
                stroke="url(#gradient1)"
                strokeWidth="2"
                fill="none"
              />
              <path
                d="M0 450 Q 180 400, 350 420 T 540 390"
                stroke="url(#gradient1)"
                strokeWidth="1.5"
                fill="none"
              />
              <path
                d="M0 480 Q 200 450, 400 460 T 540 430"
                stroke="url(#gradient1)"
                strokeWidth="1"
                fill="none"
              />
              <defs>
                <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#7CFF6B" stopOpacity="0" />
                  <stop offset="50%" stopColor="#7CFF6B" stopOpacity="1" />
                  <stop offset="100%" stopColor="#22D15A" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Slide Content */}
          <div className="relative z-10 w-full h-full">
            <SlideContent slide={slides[currentSlide]} />
          </div>

          {/* Slide Number */}
          <div className="absolute bottom-4 right-4 px-3 py-1 bg-slate-800/80 rounded-full text-xs text-slate-400">
            {currentSlide + 1} / {slides.length}
          </div>
        </div>

        <button
          onClick={nextSlide}
          className="size-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white hover:bg-slate-700 transition-colors"
        >
          <ChevronRight className="size-6" />
        </button>
      </div>

      {/* Slide Navigation Dots */}
      <div className="flex gap-2 mt-6">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentSlide(idx)}
            className={`size-3 rounded-full transition-colors ${
              idx === currentSlide ? 'bg-[#7CFF6B]' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          />
        ))}
      </div>

      {/* Instructions */}
      <div className="mt-8 p-4 bg-slate-800/50 rounded-xl border border-slate-700 max-w-xl">
        <h3 className="font-semibold text-white mb-2">Como exportar:</h3>
        <ol className="text-sm text-slate-400 space-y-1">
          <li>1. Navegue ate o slide desejado</li>
          <li>2. Tire screenshot apenas do quadrado do slide</li>
          <li>3. Ou clique com botao direito {">"} Inspecionar {">"} selecione o elemento {">"} Screenshot</li>
          <li>4. Repita para todos os 7 slides</li>
        </ol>
      </div>
    </div>
  );
}
