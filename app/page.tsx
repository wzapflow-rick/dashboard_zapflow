'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  Zap,
  ShieldCheck,
  Globe,
  MessageSquare,
  Loader2
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
      toast.success('Conta criada com sucesso! 🚀');
      // Passa os dados do formulário via URL para o onboarding poder pré-preencher
      const nome = formData.get('nome') as string;
      const whatsapp = formData.get('whatsapp') as string;
      router.push(`/onboarding?nome=${encodeURIComponent(nome)}&whatsapp=${encodeURIComponent(whatsapp || '')}`);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white dark:bg-slate-900 transition-colors">
      {/* Left Side: Form */}
      <div className="flex-1 flex flex-col justify-center px-8 lg:px-24 py-12">
        <div className="max-w-md w-full mx-auto">
          <div className="flex items-center gap-2 mb-12">
            <div className="size-10 bg-primary rounded-lg flex items-center justify-center text-white">
              <Zap className="size-6 fill-current" />
            </div>
            <span className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white">ZapFlow</span>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Comece sua automação agora</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Crie sua conta e conecte seu WhatsApp em menos de 5 minutos.</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Nome Completo</label>
              <input
                name="nome"
                type="text"
                placeholder="Ex: Ricardo Oliveira"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">E-mail</label>
              <input
                name="email"
                type="email"
                placeholder="nome@empresa.com"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">WhatsApp (Celular)</label>
              <input
                name="whatsapp"
                type="tel"
                placeholder="(00) 00000-0000"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Senha</label>
              <input
                name="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-4"
            >
              {loading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <>
                  Criar Minha Conta Grátis
                  <ArrowRight className="size-5" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8">
            Já possui uma conta? <Link href="/login" className="text-primary font-bold hover:text-primary/80 transition-colors hover:underline">Fazer Login</Link>
          </p>

          <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-6 opacity-50 grayscale dark:invert">
            <div className="relative h-6 w-24">
              <Image src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" fill className="object-contain" referrerPolicy="no-referrer" />
            </div>
            <div className="relative h-6 w-24">
              <Image src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" alt="Stripe" fill className="object-contain" referrerPolicy="no-referrer" />
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Decorative */}
      <div className="hidden lg:flex flex-1 bg-primary relative overflow-hidden items-center justify-center p-24">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 size-96 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -left-24 size-96 bg-black/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 text-white max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/10 text-xs font-bold uppercase tracking-widest">
              <Zap className="size-3 fill-current" />
              IA Power Delivery
            </div>

            <h2 className="text-5xl font-black leading-[1.1] tracking-tight">
              Transforme seu WhatsApp em uma máquina de vendas.
            </h2>

            <p className="text-xl text-white/80 font-medium leading-relaxed">
              O ZapFlow automatiza o atendimento, gerencia pedidos e recupera carrinhos abandonados de forma inteligente.
            </p>

            <div className="space-y-6 pt-8">
              {[
                { icon: MessageSquare, title: 'Atendimento 24/7', desc: 'Respostas instantâneas mesmo fora do horário.' },
                { icon: ShieldCheck, title: 'Gestão Segura', desc: 'Seus dados e de seus clientes protegidos.' },
                { icon: Globe, title: 'Cardápio Digital', desc: 'Link personalizado para sua loja no WhatsApp.' }
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="size-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
                    <item.icon className="size-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{item.title}</h4>
                    <p className="text-white/60 text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-12 flex items-center gap-4">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="relative size-10 rounded-full border-2 border-primary bg-slate-200 overflow-hidden">
                    <Image src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="User" fill className="object-cover" referrerPolicy="no-referrer" />
                  </div>
                ))}
              </div>
              <p className="text-sm font-medium text-white/80">
                <span className="font-bold text-white">+500 empresas</span> já estão escalando com ZapFlow.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
