'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Zap, Mail, User, Phone, Lock, Eye, EyeOff, CreditCard, QrCode, CheckCircle } from 'lucide-react';
import Image from 'next/image';
import { createCheckoutSession, createPixCheckoutSession } from '@/app/actions/signup';
import { createTrialAccount } from '@/app/actions/signup-trial';
import { SUBSCRIPTION_PLANS } from '@/lib/constants';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planoParam = searchParams.get('plano') || 'start';
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'cartao'>('pix');
  
  // Form fields
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Verificar se e plano parceria (trial gratis)
  const isParceria = planoParam === 'parceria';
  
  // Buscar dados do plano
  const planKey = planoParam.toUpperCase() as keyof typeof SUBSCRIPTION_PLANS;
  const planData = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS.START;
  
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
      // Validacoes basicas
      if (!nome || !email || !telefone) {
        setError('Preencha todos os campos');
        setLoading(false);
        return;
      }
      
      if (isParceria && (!password || password.length < 6)) {
        setError('Senha deve ter no minimo 6 caracteres');
        setLoading(false);
        return;
      }
      
      const phoneNumbers = telefone.replace(/\D/g, '');
      if (phoneNumbers.length < 10) {
        setError('Telefone invalido');
        setLoading(false);
        return;
      }
      
      // Se for plano parceria, criar conta direto (trial gratis)
      if (isParceria) {
        const result = await createTrialAccount({
          email,
          nome,
          telefone: phoneNumbers,
          password,
        });
        
        if (!result.success) {
          setError(result.error || 'Erro ao criar conta');
          setLoading(false);
          return;
        }
        
        // Redireciona para onboarding
        router.push('/onboarding');
        return;
      }
      
      // Planos pagos - criar checkout no MP
      const checkoutFn = paymentMethod === 'pix' ? createPixCheckoutSession : createCheckoutSession;
      
      const result = await checkoutFn({
        email,
        nome,
        telefone: phoneNumbers,
        plano: planoParam as any,
      });
      
      if (!result.success) {
        setError(result.error || 'Erro ao criar checkout');
        setLoading(false);
        return;
      }
      
      // Redireciona para o Mercado Pago
      if (result.initPoint) {
        window.location.href = result.initPoint;
      }
      
    } catch (err: any) {
      console.error('Erro no signup:', err);
      setError('Erro ao processar. Tente novamente.');
      setLoading(false);
    }
  }
  
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      {/* Lado esquerdo - Formulario */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <div className="size-10 bg-primary rounded-xl flex items-center justify-center">
              <Zap className="size-6 text-white fill-current" />
            </div>
            <span className="text-2xl font-black text-white">ZapFlow</span>
          </div>
          
          {/* Titulo */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              {isParceria ? 'Comece sua automacao agora' : 'Assine o ZapFlow'}
            </h1>
            <p className="text-gray-400">
              {isParceria 
                ? 'Crie sua conta e conecte seu WhatsApp em menos de 5 minutos.'
                : 'Crie sua conta e comece a vender mais hoje mesmo.'}
            </p>
          </div>
          
          {/* Info do plano */}
          <div className="bg-[#1a1a1a] rounded-2xl p-4 mb-6 border border-[#2a2a2a]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-500 uppercase tracking-wider">Plano selecionado</span>
                <p className="text-white font-bold text-lg">{planData.name}</p>
              </div>
              <div className="text-right">
                {isParceria ? (
                  <div>
                    <span className="text-2xl font-black text-primary">GRATIS</span>
                    <p className="text-xs text-gray-500">por 7 dias</p>
                  </div>
                ) : (
                  <div>
                    <span className="text-2xl font-black text-white">R$ {planData.price.toFixed(2).replace('.', ',')}</span>
                    <p className="text-xs text-gray-500">/mes</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nome */}
            <div>
              <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
                Nome Completo
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Ricardo Oliveira"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-12 py-3 text-white placeholder:text-gray-600 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                  required
                />
              </div>
            </div>
            
            {/* Email */}
            <div>
              <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-12 py-3 text-white placeholder:text-gray-600 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                  required
                />
              </div>
            </div>
            
            {/* Telefone */}
            <div>
              <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
                WhatsApp (Celular)
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
                <input
                  type="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-12 py-3 text-white placeholder:text-gray-600 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                  required
                />
              </div>
            </div>
            
            {/* Senha - apenas para plano parceria */}
            {isParceria && (
              <div>
                <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimo 6 caracteres"
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-12 py-3 text-white placeholder:text-gray-600 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-400"
                  >
                    {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>
            )}
            
            {/* Metodo de pagamento - apenas para planos pagos */}
            {!isParceria && (
              <div>
                <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
                  Forma de Pagamento
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('pix')}
                    className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      paymentMethod === 'pix'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-[#2a2a2a] bg-[#1a1a1a] text-gray-400 hover:border-[#3a3a3a]'
                    }`}
                  >
                    <QrCode className="size-5" />
                    <span className="font-bold">PIX</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cartao')}
                    className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      paymentMethod === 'cartao'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-[#2a2a2a] bg-[#1a1a1a] text-gray-400 hover:border-[#3a3a3a]'
                    }`}
                  >
                    <CreditCard className="size-5" />
                    <span className="font-bold">Cartao</span>
                  </button>
                </div>
              </div>
            )}
            
            {/* Erro */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm text-center">
                {error}
              </div>
            )}
            
            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  {isParceria ? 'Criando conta...' : 'Processando...'}
                </>
              ) : isParceria ? (
                <>
                  Criar Minha Conta Gratis
                  <Zap className="size-5 fill-current" />
                </>
              ) : (
                <>
                  {paymentMethod === 'pix' ? 'Pagar com PIX' : 'Pagar com Cartao'}
                  <Zap className="size-5 fill-current" />
                </>
              )}
            </button>
          </form>
          
          {/* Link para login */}
          <p className="text-center text-gray-500 text-sm mt-6">
            Ja possui uma conta?{' '}
            <a href="/login" className="text-primary hover:underline font-medium">
              Fazer Login
            </a>
          </p>
          
          {/* Footer */}
          <p className="text-center text-gray-600 text-xs mt-6">
            Ao criar sua conta, voce concorda com nossos Termos de Uso e Politica de Privacidade.
          </p>
        </div>
      </div>
      
      {/* Lado direito - Ilustracao */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary/20 to-emerald-500/20 items-center justify-center p-12">
        <div className="max-w-lg text-center">
          <div className="bg-[#1a1a1a] rounded-3xl p-8 border border-[#2a2a2a] shadow-2xl mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="size-3 rounded-full bg-red-500" />
              <div className="size-3 rounded-full bg-yellow-500" />
              <div className="size-3 rounded-full bg-green-500" />
              <span className="ml-auto text-gray-500 text-xs">ZapFlow Dashboard</span>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-[#0a0a0a] rounded-xl p-4">
                <p className="text-2xl font-black text-white">2,847</p>
                <p className="text-gray-500 text-xs">Mensagens Hoje</p>
              </div>
              <div className="bg-[#0a0a0a] rounded-xl p-4">
                <p className="text-2xl font-black text-primary">+34%</p>
                <p className="text-gray-500 text-xs">Conversoes</p>
              </div>
              <div className="bg-[#0a0a0a] rounded-xl p-4">
                <p className="text-2xl font-black text-white">12.5k</p>
                <p className="text-gray-500 text-xs">Contatos Ativos</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-primary/10 rounded-xl p-4">
              <div className="size-10 bg-primary rounded-full flex items-center justify-center">
                <CheckCircle className="size-5 text-white" />
              </div>
              <div className="text-left">
                <p className="text-white font-bold">Nova conversao!</p>
                <p className="text-gray-400 text-sm">Via funil automatico</p>
              </div>
            </div>
          </div>
          
          <h2 className="text-3xl font-black text-white mb-4">
            Transforme seu WhatsApp em uma maquina de vendas
          </h2>
          <p className="text-gray-400">
            O ZapFlow automatiza o atendimento, gerencia pedidos e recupera carrinhos abandonados com inteligencia artificial.
          </p>
          
          <div className="flex items-center justify-center gap-6 mt-8">
            <div className="flex items-center gap-2">
              <CheckCircle className="size-5 text-primary" />
              <span className="text-gray-300 text-sm">Atendimento 24/7</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="size-5 text-primary" />
              <span className="text-gray-300 text-sm">Gestao Segura</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="size-5 text-primary" />
              <span className="text-gray-300 text-sm">Cardapio Digital</span>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-2 mt-8">
            <div className="flex -space-x-2">
              <div className="size-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 border-2 border-[#0a0a0a]" />
              <div className="size-8 rounded-full bg-gradient-to-br from-green-500 to-teal-500 border-2 border-[#0a0a0a]" />
              <div className="size-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 border-2 border-[#0a0a0a]" />
            </div>
            <span className="text-gray-400 text-sm">
              <strong className="text-white">+500 empresas</strong> ja estao escalando
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
