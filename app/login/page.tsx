'use client';

import React, { useState } from 'react';
import {
    ArrowRight,
    Loader2,
    Lock,
    Mail,
    Eye,
    EyeOff,
    ClipboardList,
    Workflow,
    Clock,
    ShieldCheck,
} from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import Image from 'next/image';
import { login } from '@/app/actions/auth';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const BG = '#080706';
const CARD = 'rgba(10, 8, 7, 0.72)';
const AMBER = '#F5A524';
const AMBER_SOFT = '#E8912D';
const TEXT = '#F4EFE7';
const MUTED = '#A79B8C';
const BORDER = 'rgba(245, 165, 36, 0.14)';

const benefits = [
    { icon: ClipboardList, label: 'Pedidos organizados' },
    { icon: Workflow, label: 'Operação simplificada' },
    { icon: Clock, label: 'Mais tempo para o que importa' },
];

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
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
        <div className="relative min-h-screen w-full overflow-hidden" style={{ backgroundColor: BG }}>
            {/* Background image — atmosphere only */}
            <Image
                src="/images/login-ambiance.jpg"
                alt=""
                aria-hidden="true"
                fill
                priority
                sizes="100vw"
                className="object-cover object-center"
            />

            {/* Cinematic overlay */}
            <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                    background:
                        'linear-gradient(105deg, rgba(8,7,6,0.96) 0%, rgba(13,11,9,0.86) 42%, rgba(21,16,12,0.6) 72%, rgba(21,16,12,0.4) 100%)',
                }}
            />
            <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                    background:
                        'radial-gradient(120% 90% at 100% 0%, rgba(245,165,36,0.10) 0%, transparent 55%), radial-gradient(80% 60% at 50% 120%, rgba(8,7,6,0.9) 0%, transparent 60%)',
                }}
            />

            {/* Composition */}
            <div className="relative z-10 min-h-screen w-full flex items-center justify-center px-6 py-10 sm:px-10">
              <div className="w-full max-w-[1240px] mx-auto flex flex-col items-center justify-center lg:flex-row lg:items-center lg:justify-between gap-14 xl:gap-24">
                {/* Branding — desktop only */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className="hidden lg:flex flex-col flex-1 max-w-xl"
                >
                    <Image
                        src="/logo-zapflow.png"
                        alt="ZapFlow"
                        width={180}
                        height={50}
                        className="h-12 w-auto"
                    />

                    <p
                        className="mt-14 text-xs font-semibold tracking-[0.28em] uppercase"
                        style={{ color: MUTED }}
                    >
                        Delivery, cardápio e operação
                    </p>

                    <h1
                        className="mt-4 text-6xl xl:text-7xl font-extrabold leading-[0.98] tracking-tight text-balance"
                        style={{ color: TEXT }}
                    >
                        Seu negócio
                        <br />
                        em <span style={{ color: AMBER }}>fluxo.</span>
                    </h1>

                    <p className="mt-6 max-w-[460px] text-lg xl:text-xl leading-relaxed" style={{ color: MUTED }}>
                        Pedidos, cardápio e operação em um só lugar.
                    </p>

                    <ul className="mt-12 space-y-5">
                        {benefits.map((b, i) => (
                            <motion.li
                                key={b.label}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.35 + i * 0.1, duration: 0.5 }}
                                className="flex items-center gap-3.5"
                            >
                                <b.icon className="size-5" style={{ color: AMBER }} strokeWidth={1.75} />
                                <span className="text-base" style={{ color: TEXT }}>
                                    {b.label}
                                </span>
                            </motion.li>
                        ))}
                    </ul>
                </motion.div>

                {/* Login card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="w-full max-w-[460px] lg:flex-none"
                >
                    <div
                        className="rounded-2xl p-7 sm:p-10"
                        style={{
                            backgroundColor: CARD,
                            border: `1px solid ${BORDER}`,
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            boxShadow: '0 30px 80px -24px rgba(0,0,0,0.8)',
                        }}
                    >
                        {/* Mobile logo */}
                        <div className="lg:hidden mb-8 flex justify-center">
                            <Image
                                src="/logo-zapflow.png"
                                alt="ZapFlow"
                                width={150}
                                height={40}
                                className="h-10 w-auto"
                            />
                        </div>

                        <h2 className="text-3xl font-bold tracking-tight" style={{ color: TEXT }}>
                            Bem-vindo de volta!
                        </h2>
                        <p className="mt-2 text-[15px]" style={{ color: MUTED }}>
                            Entre para continuar no ZapFlow.
                        </p>

                        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                            <div className="space-y-2">
                                <label htmlFor="email" className="text-sm font-medium" style={{ color: TEXT }}>
                                    E-mail
                                </label>
                                <div className="relative">
                                    <Mail
                                        className="absolute left-4 top-1/2 -translate-y-1/2 size-[18px] pointer-events-none"
                                        style={{ color: MUTED }}
                                    />
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        placeholder="seu@email.com"
                                        className="login-input w-full pl-11 pr-4 py-3 rounded-xl text-sm outline-none transition-colors placeholder:text-[#6b6255]"
                                        style={{
                                            backgroundColor: 'rgba(0,0,0,0.35)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            color: TEXT,
                                        }}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="password" className="text-sm font-medium" style={{ color: TEXT }}>
                                    Senha
                                </label>
                                <div className="relative">
                                    <Lock
                                        className="absolute left-4 top-1/2 -translate-y-1/2 size-[18px] pointer-events-none"
                                        style={{ color: MUTED }}
                                    />
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="current-password"
                                        placeholder="••••••••"
                                        className="login-input w-full pl-11 pr-11 py-3 rounded-xl text-sm outline-none transition-colors placeholder:text-[#6b6255]"
                                        style={{
                                            backgroundColor: 'rgba(0,0,0,0.35)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            color: TEXT,
                                        }}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((v) => !v)}
                                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors hover:text-white"
                                        style={{ color: MUTED }}
                                    >
                                        {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-sm">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        className="size-4 rounded"
                                        style={{ accentColor: AMBER }}
                                    />
                                    <span style={{ color: MUTED }}>Lembrar de mim</span>
                                </label>
                                <Link
                                    href="/forgot-password"
                                    className="font-medium transition-colors hover:underline"
                                    style={{ color: AMBER }}
                                >
                                    Esqueci minha senha?
                                </Link>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="group w-full font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
                                style={{
                                    background: `linear-gradient(135deg, ${AMBER} 0%, ${AMBER_SOFT} 100%)`,
                                    color: '#1a1206',
                                    boxShadow: '0 10px 30px -8px rgba(245,165,36,0.45)',
                                }}
                            >
                                {loading ? (
                                    <Loader2 className="size-5 animate-spin" />
                                ) : (
                                    <>
                                        Entrar no ZapFlow
                                        <ArrowRight className="size-[18px] transition-transform group-hover:translate-x-1" />
                                    </>
                                )}
                            </button>
                        </form>

                        <p className="mt-7 text-center text-sm" style={{ color: MUTED }}>
                            Ainda não tem uma conta?{' '}
                            <Link
                                href="/signup"
                                className="font-semibold transition-colors hover:underline"
                                style={{ color: AMBER }}
                            >
                                Comece grátis por 7 dias →
                            </Link>
                        </p>

                        <div
                            className="mt-7 pt-5 flex items-center justify-center gap-2"
                            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                        >
                            <ShieldCheck className="size-[14px]" style={{ color: '#4ea36a' }} />
                            <span className="text-xs" style={{ color: MUTED }}>
                                Conexão segura e dados protegidos.
                            </span>
                        </div>
                    </div>
                </motion.div>
              </div>
            </div>

            <style jsx>{`
                .login-input:focus {
                    border-color: ${AMBER} !important;
                    box-shadow: 0 0 0 3px rgba(245, 165, 36, 0.12);
                }
            `}</style>
        </div>
    );
}
