'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createCheckoutSession, createPixCheckoutSession } from '@/app/actions/signup';
import { createTrialAccount } from '@/app/actions/signup-trial';
import { useRouter } from 'next/navigation';
import { Loader2, Mail, User, Phone, CreditCard, QrCode, Check, Lock, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

const planDetails: Record<string, { name: string; price: number; trialDays?: number; features: string[] }> = {
  parceria: {
    name: 'PARCERIA',
    price: 29.90,
    trialDays: 7,
    features: [
      'Cardapio digital (Link + QrCode)',
      'Painel Kanban basico',
      'Pix + Cartoes',
      'Taxa Fixa por bairro',
      'Suporte por email',
      '7 dias gratis para testar',
    ],
  },
  start: {
    name: 'Start',
    price: 79.90,
    features: [
      'Cardapio digital (Link + QrCode)',
      'Painel Kanban basico',
      'Pix + Cartoes',
      'Taxa Fixa por bairro',
      'Suporte por email',
    ],
  },
  pro: {
    name: 'PRO',
    price: 149.90,
    features: [
      'Tudo do Start +',
      'Painel com notificacao WhatsApp',
      'Taxa por Google Maps',
      'Agente de IA no WhatsApp',
      'Cupons de desconto',
      'Suporte prioritario',
    ],
  },
  elite: {
    name: 'ELITE',
    price: 297.90,
    features: [
      'Tudo do PRO +',
      'Customizacao Total',
      'App para entregadores',
      'Programa de pontos',
      'Relatorios avancados',
      'Onboarding VIP',
      'Gerente de conta',
    ],
  },
};

function SignupContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const planoParam = searchParams.get('plano')?.toLowerCase() || 'start';
  
  const [plano, setPlano] = useState(planoParam);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cartao' | 'pix'>('cartao');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isParceria = plano === 'parceria';
  const plan = planDetails[plano] || planDetails.start;
  
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
        setError('Telefone invalido');
        setLoading(false);
        return;
      }
      
      if (isParceria) {
        if (!senha || senha.length < 6) {
          setError('Senha deve ter no minimo 6 caracteres');
          setLoading(false);
          return;
        }
        
        const result = await createTrialAccount({
          email,
          nome,
          telefone: cleanPhone,
          password: senha,
        });
        
        if (!result.success) {
          setError(result.error || 'Erro ao criar conta');
          setLoading(false);
          return;
        }
        
        router.push('/onboarding');
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
    <div className="min-h-screen" style={{ backgroundColor: '#0A0F14' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid rgba(124, 255, 107, 0.1)' }}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Image 
                src="/logo-zapflow.png" 
                alt="ZapFlow" 
                width={140} 
                height={40}
                className="h-9 w-auto"
              />
            </Link>
            
            <Link 
              href="/login" 
              className="text-sm transition-colors"
              style={{ color: '#A1A7B3' }}
            >
              Ja tem conta? <span className="font-semibold" style={{ color: '#7CFF6B' }}>Entrar</span>
            </Link>
          </div>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Formulario */}
          <div className="order-2 lg:order-1">
            <div 
              className="rounded-3xl p-6 md:p-8"
              style={{ 
                backgroundColor: '#081D10',
                border: '1px solid rgba(124, 255, 107, 0.15)'
              }}
            >
              <h1 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: '#F5F7FA' }}>
                Criar sua conta
              </h1>
              <p className="mb-8" style={{ color: '#A1A7B3' }}>
                Preencha seus dados para comecar
              </p>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Nome */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold" style={{ color: '#F5F7FA' }}>
                    Nome completo
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 size-5" style={{ color: '#A1A7B3' }} />
                    <input
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Seu nome"
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl outline-none transition-all text-white placeholder:text-slate-500"
                      style={{ 
                        backgroundColor: '#0A0F14',
                        border: '1px solid rgba(124, 255, 107, 0.2)'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#7CFF6B'}
                      onBlur={(e) => e.target.style.borderColor = 'rgba(124, 255, 107, 0.2)'}
                      required
                    />
                  </div>
                </div>
                
                {/* Email */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold" style={{ color: '#F5F7FA' }}>
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-5" style={{ color: '#A1A7B3' }} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl outline-none transition-all text-white placeholder:text-slate-500"
                      style={{ 
                        backgroundColor: '#0A0F14',
                        border: '1px solid rgba(124, 255, 107, 0.2)'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#7CFF6B'}
                      onBlur={(e) => e.target.style.borderColor = 'rgba(124, 255, 107, 0.2)'}
                      required
                    />
                  </div>
                </div>
                
                {/* Telefone */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold" style={{ color: '#F5F7FA' }}>
                    WhatsApp
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 size-5" style={{ color: '#A1A7B3' }} />
                    <input
                      type="tel"
                      value={telefone}
                      onChange={(e) => setTelefone(formatPhone(e.target.value))}
                      placeholder="(11) 99999-9999"
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl outline-none transition-all text-white placeholder:text-slate-500"
                      style={{ 
                        backgroundColor: '#0A0F14',
                        border: '1px solid rgba(124, 255, 107, 0.2)'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#7CFF6B'}
                      onBlur={(e) => e.target.style.borderColor = 'rgba(124, 255, 107, 0.2)'}
                      required
                    />
                  </div>
                </div>
                
                {/* Senha - apenas para plano Parceria */}
                {isParceria && (
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold" style={{ color: '#F5F7FA' }}>
                      Crie sua senha
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5" style={{ color: '#A1A7B3' }} />
                      <input
                        type="password"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        placeholder="Minimo 6 caracteres"
                        className="w-full pl-12 pr-4 py-3.5 rounded-xl outline-none transition-all text-white placeholder:text-slate-500"
                        style={{ 
                          backgroundColor: '#0A0F14',
                          border: '1px solid rgba(124, 255, 107, 0.2)'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#7CFF6B'}
                        onBlur={(e) => e.target.style.borderColor = 'rgba(124, 255, 107, 0.2)'}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                )}
                
                {/* Metodo de Pagamento - apenas para planos pagos */}
                {!isParceria && (
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold" style={{ color: '#F5F7FA' }}>
                      Forma de pagamento
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cartao')}
                        className="flex items-center justify-center gap-2 p-4 rounded-xl transition-all"
                        style={{
                          backgroundColor: paymentMethod === 'cartao' ? 'rgba(124, 255, 107, 0.1)' : '#0A0F14',
                          border: paymentMethod === 'cartao' ? '1px solid #7CFF6B' : '1px solid rgba(124, 255, 107, 0.2)',
                          color: paymentMethod === 'cartao' ? '#7CFF6B' : '#A1A7B3'
                        }}
                      >
                        <CreditCard className="size-5" />
                        <span className="font-semibold">Cartao</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('pix')}
                        className="flex items-center justify-center gap-2 p-4 rounded-xl transition-all"
                        style={{
                          backgroundColor: paymentMethod === 'pix' ? 'rgba(124, 255, 107, 0.1)' : '#0A0F14',
                          border: paymentMethod === 'pix' ? '1px solid #7CFF6B' : '1px solid rgba(124, 255, 107, 0.2)',
                          color: paymentMethod === 'pix' ? '#7CFF6B' : '#A1A7B3'
                        }}
                      >
                        <QrCode className="size-5" />
                        <span className="font-semibold">Pix</span>
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Erro */}
                {error && (
                  <div 
                    className="rounded-xl p-4 text-sm"
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      color: '#f87171'
                    }}
                  >
                    {error}
                  </div>
                )}
                
                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 group"
                  style={{ 
                    background: 'linear-gradient(135deg, #7CFF6B 0%, #22D15A 100%)',
                    color: '#081D10',
                    boxShadow: '0 8px 32px rgba(124, 255, 107, 0.25)'
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-5 animate-spin" />
                      {isParceria ? 'Criando sua conta...' : 'Processando...'}
                    </>
                  ) : (
                    <>
                      {isParceria ? 'Comecar meu teste gratis' : 'Continuar para pagamento'}
                      <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
                
                <p className="text-xs text-center" style={{ color: '#A1A7B3' }}>
                  Ao continuar, voce concorda com nossos Termos de Uso e Politica de Privacidade.
                </p>
              </form>
            </div>
          </div>
          
          {/* Resumo do Plano */}
          <div className="order-1 lg:order-2">
            <div 
              className="rounded-3xl p-6 md:p-8 sticky top-8"
              style={{ 
                background: 'linear-gradient(135deg, rgba(124, 255, 107, 0.1) 0%, #081D10 100%)',
                border: '1px solid rgba(124, 255, 107, 0.2)'
              }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div 
                  className="size-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(124, 255, 107, 0.2)' }}
                >
                  <Image 
                    src="/logo-zapflow.png" 
                    alt="ZapFlow" 
                    width={32} 
                    height={32}
                    className="h-6 w-auto"
                  />
                </div>
                <div>
                  <p className="text-sm" style={{ color: '#A1A7B3' }}>Plano selecionado</p>
                  <h2 className="text-2xl font-bold" style={{ color: '#F5F7FA' }}>{plan.name}</h2>
                </div>
              </div>
              
              {/* Seletor de plano */}
              <div className="grid grid-cols-2 gap-2 mb-6">
                {Object.entries(planDetails).map(([key, p]) => (
                  <button
                    key={key}
                    onClick={() => setPlano(key)}
                    className="py-2 px-3 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      backgroundColor: plano === key ? '#7CFF6B' : 'rgba(255, 255, 255, 0.05)',
                      color: plano === key ? '#081D10' : '#A1A7B3'
                    }}
                  >
                    {p.name}
                    {p.trialDays && <span className="ml-1 text-xs opacity-75">(Gratis)</span>}
                  </button>
                ))}
              </div>
              
              {/* Preco */}
              <div 
                className="rounded-2xl p-4 mb-6"
                style={{ backgroundColor: '#0A0F14' }}
              >
                {plan.trialDays ? (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl font-bold" style={{ color: '#7CFF6B' }}>GRATIS</span>
                      <span style={{ color: '#A1A7B3' }}>por {plan.trialDays} dias</span>
                    </div>
                    <p className="text-sm" style={{ color: '#A1A7B3' }}>
                      Depois R$ {plan.price.toFixed(2).replace('.', ',')}/mes
                    </p>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span style={{ color: '#A1A7B3' }}>R$</span>
                    <span className="text-4xl font-bold" style={{ color: '#F5F7FA' }}>
                      {plan.price.toFixed(2).replace('.', ',')}
                    </span>
                    <span style={{ color: '#A1A7B3' }}>/mes</span>
                  </div>
                )}
              </div>
              
              {/* Features */}
              <div className="space-y-3">
                <p 
                  className="text-sm font-semibold uppercase tracking-wider"
                  style={{ color: '#A1A7B3' }}
                >
                  Incluso no plano:
                </p>
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Check className="size-5 shrink-0 mt-0.5" style={{ color: '#7CFF6B' }} />
                    <span className="text-sm" style={{ color: '#F5F7FA' }}>{feature}</span>
                  </div>
                ))}
              </div>
              
              {/* Garantia */}
              <div 
                className="mt-8 pt-6"
                style={{ borderTop: '1px solid rgba(124, 255, 107, 0.1)' }}
              >
                <div className="flex items-center gap-3 text-sm">
                  <div 
                    className="size-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(124, 255, 107, 0.1)' }}
                  >
                    <Check className="size-5" style={{ color: '#7CFF6B' }} />
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: '#F5F7FA' }}>Garantia de 7 dias</p>
                    <p style={{ color: '#A1A7B3' }}>Cancele quando quiser, sem burocracia</p>
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

function SignupLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0A0F14' }}>
      <Loader2 className="size-8 animate-spin" style={{ color: '#7CFF6B' }} />
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupLoading />}>
      <SignupContent />
    </Suspense>
  );
}
