'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getPendingSignup, completeSignup } from '@/app/actions/signup';
import { Loader2, CheckCircle, XCircle, Lock, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';

interface SignupData {
  email: string;
  nome: string;
  plano: string;
}

export default function AtivarContaPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [signupData, setSignupData] = useState<SignupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Carregar dados do pending signup
  useEffect(() => {
    async function loadSignup() {
      try {
        const data = await getPendingSignup(token);
        
        if (!data) {
          setError('Link invalido ou expirado. Solicite um novo cadastro.');
          setLoading(false);
          return;
        }
        
        setSignupData({
          email: data.email,
          nome: data.nome,
          plano: data.plano,
        });
      } catch (err) {
        setError('Erro ao carregar dados. Tente novamente.');
      } finally {
        setLoading(false);
      }
    }
    
    if (token) {
      loadSignup();
    }
  }, [token]);
  
  // Submeter formulario
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (password.length < 6) {
      setError('Senha deve ter no minimo 6 caracteres');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('As senhas nao conferem');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      const result = await completeSignup(token, password);
      
      if (result.success) {
        setSuccess(true);
        
        // Redireciona para o onboarding apos 2 segundos (usuario novo precisa configurar)
        setTimeout(() => {
          window.location.href = '/onboarding';
        }, 2000);
      } else {
        setError(result.error || 'Erro ao criar conta');
      }
    } catch (err) {
      setError('Erro ao criar conta. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }
  
  // Traduzir nome do plano
  function getPlanName(plano: string) {
    const names: Record<string, string> = {
      start: 'Start',
      pro: 'PRO',
      elite: 'ELITE',
    };
    return names[plano] || plano;
  }
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="size-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Verificando seu cadastro...</p>
        </div>
      </div>
    );
  }
  
  // Erro - link invalido
  if (!signupData && error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="bg-[#1a1a1a] rounded-3xl p-8 max-w-md w-full text-center border border-[#2a2a2a]">
          <div className="size-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <XCircle className="size-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Link Invalido</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <a 
            href="https://wzapflow.com.br" 
            className="inline-block bg-primary text-white font-semibold px-8 py-3 rounded-xl hover:bg-primary/90 transition-colors"
          >
            Voltar ao Site
          </a>
        </div>
      </div>
    );
  }
  
  // Sucesso
  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="bg-[#1a1a1a] rounded-3xl p-8 max-w-md w-full text-center border border-[#2a2a2a]">
          <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="size-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Conta Criada!</h1>
          <p className="text-gray-400 mb-6">
            Bem-vindo ao ZapFlow, {signupData?.nome}!<br />
            Redirecionando para configuracao inicial...
          </p>
          <Loader2 className="size-6 text-primary animate-spin mx-auto" />
        </div>
      </div>
    );
  }
  
  // Formulario de ativacao
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] rounded-3xl p-8 max-w-md w-full border border-[#2a2a2a]">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image
            src="/images/pizza-logo.png"
            alt="ZapFlow"
            width={80}
            height={80}
            className="mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-white mb-2">
            Bem-vindo ao ZapFlow!
          </h1>
          <p className="text-gray-400 text-sm">
            Falta pouco! Defina sua senha para acessar o painel.
          </p>
        </div>
        
        {/* Info do cadastro */}
        <div className="bg-[#0a0a0a] rounded-2xl p-4 mb-6 border border-[#2a2a2a]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-xs uppercase tracking-wider">Email</span>
            <span className="text-white text-sm">{signupData?.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-xs uppercase tracking-wider">Plano</span>
            <span className="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full">
              {getPlanName(signupData?.plano || '')}
            </span>
          </div>
        </div>
        
        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Senha */}
          <div>
            <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
              Crie sua senha
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimo 6 caracteres"
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-12 py-3 text-white placeholder:text-gray-600 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
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
          
          {/* Confirmar senha */}
          <div>
            <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
              Confirme sua senha
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-12 py-3 text-white placeholder:text-gray-600 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-400"
              >
                {showConfirmPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          </div>
          
          {/* Erro */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm text-center">
              {error}
            </div>
          )}
          
          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                Criando conta...
              </>
            ) : (
              'Ativar Minha Conta'
            )}
          </button>
        </form>
        
        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-6">
          Ao ativar, voce concorda com nossos Termos de Uso e Politica de Privacidade.
        </p>
      </div>
    </div>
  );
}
