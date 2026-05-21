'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  Loader2,
  User,
  Mail,
  Lock,
  Phone,
  CheckCircle2,
  Zap,
  BarChart3,
  MessageSquare,
  ShieldCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import Image from 'next/image';
import { register } from '@/app/actions/auth';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function RegistrationPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const result = await register(formData);

    if (result?.error) {
      toast.error(result.error);
      setLoading(false);
    } else {
      toast.success('Conta criada com sucesso!');
      const nome = formData.get('nome') as string;
      const whatsapp = formData.get('whatsapp') as string;
      router.push(`/onboarding?nome=${encodeURIComponent(nome)}&whatsapp=${encodeURIComponent(whatsapp || '')}`);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ backgroundColor: '#0A0F14' }}>
      {/* Left Side: Decorative */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center p-16" style={{ backgroundColor: '#081D10' }}>
        {/* Background Pattern - Flow Lines */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Gradient orbs */}
          <div 
            className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-30"
            style={{ background: 'radial-gradient(circle, #7CFF6B 0%, transparent 70%)' }}
          />
          <div 
            className="absolute top-1/2 -right-32 w-80 h-80 rounded-full blur-3xl opacity-20"
            style={{ background: 'radial-gradient(circle, #22D15A 0%, transparent 70%)' }}
          />
          <div 
            className="absolute -bottom-32 left-1/4 w-64 h-64 rounded-full blur-3xl opacity-25"
            style={{ background: 'radial-gradient(circle, #7CFF6B 0%, transparent 70%)' }}
          />
          
          {/* Flow lines SVG */}
          <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7CFF6B" />
                <stop offset="100%" stopColor="#22D15A" />
              </linearGradient>
            </defs>
            <path d="M0,400 Q200,300 400,400 T800,400" stroke="url(#flowGradient)" strokeWidth="2" fill="none" />
            <path d="M0,500 Q200,400 400,500 T800,500" stroke="url(#flowGradient)" strokeWidth="1.5" fill="none" />
            <path d="M0,300 Q200,200 400,300 T800,300" stroke="url(#flowGradient)" strokeWidth="1" fill="none" />
          </svg>
        </div>

        <div className="relative z-10 max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            {/* Logo */}
            <div className="mb-8">
              <Image 
                src="/logo-zapflow.png" 
                alt="ZapFlow" 
                width={180} 
                height={50}
                className="h-12 w-auto"
              />
              <p className="mt-3 text-sm font-medium tracking-widest uppercase" style={{ color: '#A1A7B3' }}>
                O fluxo que <span style={{ color: '#7CFF6B' }}>impulsiona</span> seu negocio
              </p>
            </div>

            <h2 className="text-4xl font-bold leading-tight" style={{ color: '#F5F7FA' }}>
              Comece a transformar seu{' '}
              <span style={{ color: '#7CFF6B' }}>delivery hoje</span>
            </h2>

            <p className="text-lg leading-relaxed" style={{ color: '#A1A7B3' }}>
              Crie sua conta em menos de 2 minutos e tenha acesso a todas as ferramentas que seu negocio precisa.
            </p>

            {/* Features */}
            <div className="space-y-5 pt-6">
              {[
                { icon: MessageSquare, title: 'Integracao com WhatsApp', desc: 'Receba e gerencie pedidos direto no app' },
                { icon: BarChart3, title: 'Painel de Controle', desc: 'Acompanhe vendas e metricas em tempo real' },
                { icon: ShieldCheck, title: 'Seguro e Confiavel', desc: 'Seus dados protegidos com criptografia' }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex items-start gap-4"
                >
                  <div 
                    className="size-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'rgba(124, 255, 107, 0.15)' }}
                  >
                    <item.icon className="size-5" style={{ color: '#7CFF6B' }} />
                  </div>
                  <div>
                    <h4 className="font-semibold" style={{ color: '#F5F7FA' }}>{item.title}</h4>
                    <p className="text-sm" style={{ color: '#A1A7B3' }}>{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Social Proof */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="pt-8 flex items-center gap-4"
            >
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map(i => (
                  <div 
                    key={i} 
                    className="size-10 rounded-full border-2 overflow-hidden"
                    style={{ borderColor: '#081D10', backgroundColor: '#22D15A' }}
                  >
                    <Image 
                      src={`https://i.pravatar.cc/100?img=${i + 10}`} 
                      alt="User" 
                      width={40}
                      height={40}
                      className="object-cover" 
                      referrerPolicy="no-referrer" 
                    />
                  </div>
                ))}
              </div>
              <p className="text-sm" style={{ color: '#A1A7B3' }}>
                <span className="font-bold" style={{ color: '#7CFF6B' }}>+500 empresas</span> ja usam o ZapFlow
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Right Side: Form */}
      <div className="flex-1 flex flex-col justify-center px-8 lg:px-16 py-12" style={{ backgroundColor: '#0A0F14' }}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full mx-auto"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center mb-12">
            <Image 
              src="/logo-zapflow.png" 
              alt="ZapFlow" 
              width={150} 
              height={40}
              className="h-10 w-auto"
            />
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#F5F7FA' }}>
              Crie sua conta gratis
            </h1>
            <p className="mt-2" style={{ color: '#A1A7B3' }}>
              Preencha os dados abaixo para comecar.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-semibold" style={{ color: '#F5F7FA' }}>
                Nome Completo
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 size-5" style={{ color: '#A1A7B3' }} />
                <input
                  name="nome"
                  type="text"
                  placeholder="Ex: Ricardo Oliveira"
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl outline-none transition-all text-white placeholder:text-slate-500"
                  style={{ 
                    backgroundColor: '#081D10',
                    border: '1px solid rgba(124, 255, 107, 0.2)'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#7CFF6B'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(124, 255, 107, 0.2)'}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold" style={{ color: '#F5F7FA' }}>
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-5" style={{ color: '#A1A7B3' }} />
                <input
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl outline-none transition-all text-white placeholder:text-slate-500"
                  style={{ 
                    backgroundColor: '#081D10',
                    border: '1px solid rgba(124, 255, 107, 0.2)'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#7CFF6B'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(124, 255, 107, 0.2)'}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold" style={{ color: '#F5F7FA' }}>
                WhatsApp
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 size-5" style={{ color: '#A1A7B3' }} />
                <input
                  name="whatsapp"
                  type="tel"
                  placeholder="(00) 00000-0000"
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl outline-none transition-all text-white placeholder:text-slate-500"
                  style={{ 
                    backgroundColor: '#081D10',
                    border: '1px solid rgba(124, 255, 107, 0.2)'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#7CFF6B'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(124, 255, 107, 0.2)'}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold" style={{ color: '#F5F7FA' }}>
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5" style={{ color: '#A1A7B3' }} />
                <input
                  name="password"
                  type="password"
                  placeholder="Minimo 6 caracteres"
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl outline-none transition-all text-white placeholder:text-slate-500"
                  style={{ 
                    backgroundColor: '#081D10',
                    border: '1px solid rgba(124, 255, 107, 0.2)'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#7CFF6B'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(124, 255, 107, 0.2)'}
                  required
                  minLength={6}
                />
              </div>
            </div>

            {/* Benefits checklist */}
            <div className="py-4 space-y-2">
              {['14 dias gratis para testar', 'Sem necessidade de cartao', 'Suporte via WhatsApp'].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4" style={{ color: '#7CFF6B' }} />
                  <span className="text-sm" style={{ color: '#A1A7B3' }}>{item}</span>
                </div>
              ))}
            </div>

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
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <>
                  Criar Minha Conta Gratis
                  <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8" style={{ borderTop: '1px solid rgba(124, 255, 107, 0.1)' }}>
            <p className="text-center text-sm" style={{ color: '#A1A7B3' }}>
              Ja possui uma conta?{' '}
              <Link 
                href="/login" 
                className="font-bold hover:underline transition-colors"
                style={{ color: '#7CFF6B' }}
              >
                Fazer Login
              </Link>
            </p>
          </div>

          {/* Indicators */}
          <div className="mt-12 flex items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full" style={{ backgroundColor: '#7CFF6B' }} />
              <span className="text-xs" style={{ color: '#A1A7B3' }}>Criptografia SSL</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full" style={{ backgroundColor: '#22D15A' }} />
              <span className="text-xs" style={{ color: '#A1A7B3' }}>Dados Protegidos</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
