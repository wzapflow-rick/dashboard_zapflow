'use client';

import React, { useState } from 'react';
import {
    ArrowRight,
    Zap,
    ShieldCheck,
    Globe,
    MessageSquare,
    Loader2,
    Lock,
    Mail,
    TrendingUp,
    CheckCircle2,
    Zap as ZapIcon
} from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import Image from 'next/image';
import { login } from '@/app/actions/auth';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const result = await login(formData);

        if (result?.error) {
            toast.error(result.error);
            setLoading(false);
        } else {
            toast.success('Login realizado com sucesso!');
            // Redireciona baseado no role do usuario
            const role = result?.role || 'admin';
            if (role === 'atendente' || role === 'cozinheiro') {
                router.push('/dashboard/expedition');
            } else {
                router.push('/dashboard');
            }
            router.refresh();
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
                        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Bem-vindo de volta!</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2">Entre com seu e-mail e senha para acessar o painel.</p>
                    </div>

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">E-mail</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                                <input
                                    name="email"
                                    type="email"
                                    placeholder="seu@email.com"
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                                <input
                                    name="password"
                                    type="password"
                                    placeholder="••••••••"
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-4"
                        >
                            {loading ? (
                                <Loader2 className="size-5 animate-spin" />
                            ) : (
                                <>
                                    Entrar no Painel
                                    <ArrowRight className="size-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8">
                        Não tem uma conta? <Link href="/" className="text-emerald-500 font-bold hover:text-emerald-600 transition-colors hover:underline">Criar Conta Grátis</Link>
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
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 text-xs font-bold uppercase tracking-widest text-emerald-300">
                            <TrendingUp className="size-3" />
                            Controle + Lucro
                        </div>

                        <h2 className="text-5xl font-black leading-[1.1] tracking-tight">
                            Organize seus pedidos no WhatsApp e pare de perder dinheiro com erros
                        </h2>

                        <p className="text-xl text-white/80 font-medium leading-relaxed">
                            O ZapFlow transforma mensagens em pedidos organizados, automatiza seu atendimento e mantém sua operação rodando sem caos.
                        </p>

                        <div className="space-y-6 pt-8">
                            {[
                                { icon: CheckCircle2, title: 'Controle Total', desc: 'Cada pedido rastreado, nenhum erro de digitação.' },
                                { icon: TrendingUp, title: 'Mais Lucro', desc: 'Reduza erros, aumente vendas, maximize seu faturamento.' },
                                { icon: ZapIcon, title: 'Menos Caos', desc: 'Automação inteligente que libera seu tempo para crescer.' }
                            ].map((item, i) => (
                                <div key={i} className="flex gap-4">
                                    <div className="size-12 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-center shrink-0">
                                        <item.icon className="size-6 text-emerald-300" />
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
                                    <div key={i} className="relative size-10 rounded-full border-2 border-emerald-400 bg-slate-200 overflow-hidden">
                                        <Image src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="User" fill className="object-cover" referrerPolicy="no-referrer" />
                                    </div>
                                ))}
                            </div>
                            <p className="text-sm font-medium text-white/80">
                                <span className="font-bold text-emerald-300">+500 empresas</span> já estão escalando com ZapFlow.
                            </p>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
