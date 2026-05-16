'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createCheckoutSession, createPixCheckoutSession } from '@/app/actions/signup';
import { Loader2, Zap, Mail, User, Phone, CreditCard, QrCode, Check, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { SUBSCRIPTION_PLANS } from '@/lib/constants';

const planDetails: Record<string, { name: string; price: number; features: string[] }> = {
  start: {
    name: 'Start',
    price: 79.90,
    features: [
      'Cardápio digital (Link + QrCode)',
      'Painel Kanban básico',
      'Pix + Cartões',
      'Taxa Fixa por bairro',
      'Suporte por email',
    ],
  },
  pro: {
    name: 'PRO',
    price: 149.90,
    features: [
      'Tudo do Start +',
      'Painel com notificação WhatsApp',
      'Taxa por Google Maps',
      'Agente de IA no WhatsApp',
      'Cupons de desconto',
      'Suporte prioritário',
    ],
  },
  elite: {
    name: 'ELITE',
    price: 297.90,
    features: [
      'Tudo do PRO +',
      'Customização Total',
      'App para entregadores',
      'Programa de pontos',
      'Relatórios avançados',
      'Onboarding VIP',
      'Gerente de conta',
    ],
  },
};

export default function SignupPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const planoParam = searchParams.get('plano')?.toLowerCase() || 'start';
  
  const [plano, setPlano] = useState(planoParam);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cartao' | 'pix'>('cartao');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const plan = planDetails[plano] || planDetails.start;
  
  // Formatar telefone
  function formatPhone(value: string) {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  }
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      const cleanPhone = telefone.replace(/\D/g, '');
      
      if (cleanPhone.length < 10) {
        setError('Telefone inválido');
        setLoading(false);
        return;
      }
      
      const data = {
        email,
        nome,
        telefone: cleanPhone,
        plano: plano as any,
      };
      
      const result = paymentMethod === 'pix' 
        ? await createPixCheckoutSession(data)
        : await createCheckoutSession(data);
      
      if (!result.success) {
        setError(result.error || 'Erro ao criar checkout');
        setLoading(false);
        return;
      }
      
      // Redirecionar para o checkout do Mercado Pago
      if (result.initPoint) {
        window.location.href = result.initPoint;
      } else {
        setError('Erro ao gerar link de pagamento');
        setLoading(false);
      }
    } catch (err) {
      console.error('Erro no signup:', err);
      setError('Erro ao processar. Tente novamente.');
      setLoading(false);
    }
  }
  
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-black">
                <span className="text-emerald-400">Zap</span>Flow
              </span>
            </Link>
            
            <Link 
              href="/login" 
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Já tem conta? <span className="text-emerald-400 font-semibold">Entrar</span>
            </Link>
          </div>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Formulário */}
          <div className="order-2 lg:order-1">
            <div className="bg-[#1a1a1a] rounded-3xl p-6 md:p-8 border border-white/10">
              <h1 className="text-2xl md:text-3xl font-black mb-2">Criar sua conta</h1>
              <p className="text-gray-400 mb-8">Preencha seus dados para começar</p>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Nome */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Nome completo</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
                    <input
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Seu nome"
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-12 py-3.5 text-white placeholder:text-gray-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                      required
                    />
                  </div>
                </div>
                
                {/* Email */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-12 py-3.5 text-white placeholder:text-gray-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                      required
                    />
                  </div>
                </div>
                
                {/* Telefone */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">WhatsApp</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
                    <input
                      type="tel"
                      value={telefone}
                      onChange={(e) => setTelefone(formatPhone(e.target.value))}
                      placeholder="(11) 99999-9999"
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-12 py-3.5 text-white placeholder:text-gray-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                      required
                    />
                  </div>
                </div>
                
                {/* Método de Pagamento */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Forma de pagamento</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cartao')}
                      className={`flex items-center justify-center gap-2 p-4 rounded-xl border transition-all ${
                        paymentMethod === 'cartao'
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                          : 'bg-[#0a0a0a] border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      <CreditCard className="size-5" />
                      <span className="font-semibold">Cartão</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('pix')}
                      className={`flex items-center justify-center gap-2 p-4 rounded-xl border transition-all ${
                        paymentMethod === 'pix'
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                          : 'bg-[#0a0a0a] border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      <QrCode className="size-5" />
                      <span className="font-semibold">Pix</span>
                    </button>
                  </div>
                </div>
                
                {/* Erro */}
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
                    {error}
                  </div>
                )}
                
                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-5 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      Continuar para pagamento
                    </>
                  )}
                </button>
                
                <p className="text-xs text-gray-500 text-center">
                  Ao continuar, você concorda com nossos Termos de Uso e Política de Privacidade.
                </p>
              </form>
            </div>
          </div>
          
          {/* Resumo do Plano */}
          <div className="order-1 lg:order-2">
            <div className="bg-gradient-to-br from-emerald-900/30 to-[#1a1a1a] rounded-3xl p-6 md:p-8 border border-emerald-500/30 sticky top-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="size-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Zap className="size-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Plano selecionado</p>
                  <h2 className="text-2xl font-black">{plan.name}</h2>
                </div>
              </div>
              
              {/* Seletor de plano */}
              <div className="flex gap-2 mb-6">
                {Object.entries(planDetails).map(([key, p]) => (
                  <button
                    key={key}
                    onClick={() => setPlano(key)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                      plano === key
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              
              {/* Preço */}
              <div className="bg-[#0a0a0a] rounded-2xl p-4 mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-gray-400">R$</span>
                  <span className="text-4xl font-black">{plan.price.toFixed(2).replace('.', ',')}</span>
                  <span className="text-gray-400">/mês</span>
                </div>
              </div>
              
              {/* Features */}
              <div className="space-y-3">
                <p className="text-sm text-gray-400 font-semibold uppercase tracking-wider">Incluso no plano:</p>
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Check className="size-5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-gray-300 text-sm">{feature}</span>
                  </div>
                ))}
              </div>
              
              {/* Garantia */}
              <div className="mt-8 pt-6 border-t border-white/10">
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <div className="size-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Check className="size-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Garantia de 7 dias</p>
                    <p>Cancele quando quiser, sem burocracia</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
