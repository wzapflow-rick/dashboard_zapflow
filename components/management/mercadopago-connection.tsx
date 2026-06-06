'use client';

import React, { useState, useEffect } from 'react';
import { getMPAuthorizationUrl, getMPConnectionStatus, disconnectMP, checkPixAvailability } from '@/app/actions/mercadopago';
import { CreditCard, CheckCircle, XCircle, Loader2, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';

export default function MercadoPagoConnection() {
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<{ connected: boolean; userId: string | null; publicKey: string | null } | null>(null);
    const [pixCheck, setPixCheck] = useState<{ checking: boolean; available: boolean | null; reason?: string }>({ checking: false, available: null });
    const searchParams = useSearchParams();

    const verifyPix = async () => {
        setPixCheck({ checking: true, available: null });
        try {
            const res = await checkPixAvailability();
            setPixCheck({ checking: false, available: res.available, reason: res.reason });
        } catch (error) {
            console.error('Erro ao verificar PIX:', error);
            setPixCheck({ checking: false, available: null, reason: 'Erro ao verificar o PIX.' });
        }
    };

    const loadStatus = async () => {
        setLoading(true);
        try {
            const res = await getMPConnectionStatus();
            setStatus(res);
            // Se a conta esta conectada, verifica se o PIX esta habilitado.
            if (res?.connected) {
                verifyPix();
            }
        } catch (error) {
            console.error('Erro ao carregar status MP:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStatus();

        // Verificar se há mensagens de sucesso/erro na URL
        const success = searchParams.get('success');
        const error = searchParams.get('error');

        if (success === 'mp_connected') {
            toast.success('Mercado Pago conectado com sucesso!');
        } else if (error === 'mp_auth_failed') {
            toast.error('Falha na autorização com Mercado Pago.');
        } else if (error === 'mp_token_failed') {
            toast.error('Erro ao obter acesso do Mercado Pago.');
        }
    }, [searchParams]);

    const handleConnect = async () => {
        try {
            const url = await getMPAuthorizationUrl();
            window.location.href = url;
        } catch (error: any) {
            toast.error(error.message || 'Erro ao iniciar conexão');
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('Tem certeza que deseja desconectar sua conta do Mercado Pago? Você deixará de receber pagamentos online.')) {
            return;
        }

        try {
            await disconnectMP();
            toast.success('Mercado Pago desconectado.');
            loadStatus();
        } catch (error: any) {
            toast.error(error.message || 'Erro ao desconectar');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="size-6 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="size-12 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <CreditCard className="size-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Pagamentos Online</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Receba via PIX e Cartão direto na sua conta.</p>
                    </div>
                </div>
                {status?.connected && (
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-full flex items-center gap-1">
                        <CheckCircle className="size-3" />
                        Conectado
                    </span>
                )}
            </div>

            <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
                {status?.connected ? (
                    <div className="space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="size-10 bg-green-500 rounded-full flex items-center justify-center shrink-0">
                                <CheckCircle className="size-6 text-white" />
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 dark:text-white">Sua conta está ativa!</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    Os pagamentos dos seus clientes cairão diretamente na sua conta do Mercado Pago (ID: {status.userId}).
                                </p>
                            </div>
                        </div>

                        {/* Aviso quando a conta nao tem chave PIX habilitada no Mercado Pago */}
                        {pixCheck.available === false && (
                            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                                <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="font-bold text-amber-800 dark:text-amber-300 text-sm">PIX indisponível para seus clientes</p>
                                    <p className="text-sm text-amber-700 dark:text-amber-400">
                                        Sua conta do Mercado Pago não tem uma chave PIX habilitada, então o QR Code não é gerado no cardápio.
                                        Cadastre uma chave PIX no app do Mercado Pago (Seu negócio → PIX → Minhas chaves) e verifique novamente.
                                    </p>
                                    <button
                                        onClick={verifyPix}
                                        disabled={pixCheck.checking}
                                        className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-lg text-xs font-bold transition-all"
                                    >
                                        {pixCheck.checking ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                                        Verificar novamente
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Confirmacao quando o PIX esta funcionando */}
                        {pixCheck.available === true && (
                            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
                                <CheckCircle className="size-4" />
                                PIX habilitado e funcionando.
                            </div>
                        )}

                        {pixCheck.checking && pixCheck.available === null && (
                            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                <Loader2 className="size-4 animate-spin" />
                                Verificando disponibilidade do PIX...
                            </div>
                        )}

                        <div className="pt-4 flex flex-wrap gap-3">
                            <button
                                onClick={handleConnect}
                                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-all"
                            >
                                <RefreshCw className="size-4" />
                                Alterar Conta
                            </button>
                            <button
                                onClick={handleDisconnect}
                                className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-sm font-bold transition-all"
                            >
                                <XCircle className="size-4" />
                                Desconectar
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 text-center py-4">
                        <div className="max-w-md mx-auto space-y-2">
                            <p className="font-bold text-slate-900 dark:text-white text-xl">Conecte seu Mercado Pago</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Para começar a vender e receber na hora, você precisa autorizar o ZapFlow a gerar cobranças em seu nome.
                            </p>
                        </div>

                        <button
                            onClick={handleConnect}
                            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-500/20 transition-all group"
                        >
                            Conectar com Mercado Pago
                            <ExternalLink className="size-5 group-hover:translate-x-1 transition-transform" />
                        </button>

                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                            Seguro • Rápido • Sem taxas extras do ZapFlow
                        </p>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-slate-100 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800">
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-2">Vantagens</p>
                    <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                        <li className="flex items-center gap-2">
                            <CheckCircle className="size-4 text-green-500" /> Receba na hora via PIX
                        </li>
                        <li className="flex items-center gap-2">
                            <CheckCircle className="size-4 text-green-500" /> Checkout transparente
                        </li>
                    </ul>
                </div>
                <div className="p-4 border border-slate-100 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800">
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-2">Taxas do MP</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        As taxas aplicadas são as mesmas que você já possui negociadas no seu painel do Mercado Pago.
                    </p>
                </div>
            </div>
        </div>
    );
}
