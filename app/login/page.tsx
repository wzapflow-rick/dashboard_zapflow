'use client';

import React, { useState } from 'react';
import {
    ArrowRight,
    Loader2,
    Lock,
    Mail,
    TrendingUp,
    CheckCircle2,
    Zap,
    BarChart3,
    Users,
    Clock
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
                            Transforme seu atendimento em{' '}
                            <span style={{ color: '#7CFF6B' }}>resultados reais</span>
                        </h2>

                        <p className="text-lg leading-relaxed" style={{ color: '#A1A7B3' }}>
                            Conecte, automatize e impulsione seu negocio com a plataforma mais completa para delivery e gestao de pedidos.
                        </p>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 gap-4 pt-6">
                            {[
                                { icon: BarChart3, value: '+127%', label: 'Aumento em vendas' },
                                { icon: Clock, value: '-45%', label: 'Tempo de atendimento' },
                                { icon: Users, value: '+500', label: 'Empresas ativas' },
                                { icon: Zap, value: '99.9%', label: 'Uptime garantido' }
                            ].map((stat, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 + i * 0.1 }}
                                    className="p-4 rounded-xl border"
                                    style={{ 
                                        backgroundColor: 'rgba(124, 255, 107, 0.05)',
                                        borderColor: 'rgba(124, 255, 107, 0.15)'
                                    }}
                                >
                                    <stat.icon className="size-5 mb-2" style={{ color: '#7CFF6B' }} />
                                    <p className="text-2xl font-bold" style={{ color: '#F5F7FA' }}>{stat.value}</p>
                                    <p className="text-xs" style={{ color: '#A1A7B3' }}>{stat.label}</p>
                                </motion.div>
                            ))}
                        </div>

                        {/* Features */}
                        <div className="space-y-4 pt-6">
                            {[
                                'Integracao completa com WhatsApp',
                                'Painel Kanban para expedicao',
                                'Relatorios e insights em tempo real'
                            ].map((feature, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.5 + i * 0.1 }}
                                    className="flex items-center gap-3"
                                >
                                    <div 
                                        className="size-6 rounded-full flex items-center justify-center"
                                        style={{ backgroundColor: 'rgba(124, 255, 107, 0.2)' }}
                                    >
                                        <CheckCircle2 className="size-4" style={{ color: '#7CFF6B' }} />
                                    </div>
                                    <span className="text-sm font-medium" style={{ color: '#F5F7FA' }}>{feature}</span>
                                </motion.div>
                            ))}
                        </div>
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
                            Bem-vindo de volta!
                        </h1>
                        <p className="mt-2" style={{ color: '#A1A7B3' }}>
                            Entre com suas credenciais para acessar o painel.
                        </p>
                    </div>

                    <form className="space-y-5" onSubmit={handleSubmit}>
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
                                Senha
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5" style={{ color: '#A1A7B3' }} />
                                <input
                                    name="password"
                                    type="password"
                                    placeholder="••••••••"
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

                        <div className="flex items-center justify-between text-sm pt-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="size-4 rounded border-slate-600 accent-emerald-500"
                                    style={{ accentColor: '#22D15A' }}
                                />
                                <span style={{ color: '#A1A7B3' }}>Lembrar de mim</span>
                            </label>
                            <Link 
                                href="/forgot-password" 
                                className="font-medium hover:underline transition-colors"
                                style={{ color: '#7CFF6B' }}
                            >
                                Esqueceu a senha?
                            </Link>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 mt-6 group"
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
                                    Entrar no Painel
                                    <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-8" style={{ borderTop: '1px solid rgba(124, 255, 107, 0.1)' }}>
                        <p className="text-center text-sm" style={{ color: '#A1A7B3' }}>
                            Nao tem uma conta?{' '}
                            <Link 
                                href="/" 
                                className="font-bold hover:underline transition-colors"
                                style={{ color: '#7CFF6B' }}
                            >
                                Criar Conta Gratis
                            </Link>
                        </p>
                    </div>

                    {/* Indicators */}
                    <div className="mt-12 flex items-center justify-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="size-2 rounded-full" style={{ backgroundColor: '#7CFF6B' }} />
                            <span className="text-xs" style={{ color: '#A1A7B3' }}>Sistema Online</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="size-2 rounded-full" style={{ backgroundColor: '#22D15A' }} />
                            <span className="text-xs" style={{ color: '#A1A7B3' }}>SSL Ativo</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
