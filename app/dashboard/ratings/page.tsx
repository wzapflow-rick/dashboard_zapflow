'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';
import { Star, TrendingUp, TrendingDown, ThumbsUp, ThumbsDown, MessageCircle, Calendar, Search, User } from 'lucide-react';
import { getRatingsByEmpresa, getAverageRatings, getClientByPhone } from '@/app/actions/ratings';
import { getMe } from '@/app/actions/auth';

interface Rating {
    id?: number;
    pedido_id: number;
    telefone_cliente: string;
    nota_comida: number;
    nota_entrega: number;
    comentario?: string;
    created_at: string;
}

interface AverageData {
    media_comida: string;
    media_entrega: string;
    total_avaliacoes: number;
    notas_comida: Record<string, number>;
    notas_entrega: Record<string, number>;
}

export default function RatingsPage() {
    const [ratings, setRatings] = useState<any[]>([]);
    const [average, setAverage] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [empresaId, setEmpresaId] = useState<number | null>(null);
    const [clienteNomes, setClienteNomes] = useState<Record<string, string>>({});

    useEffect(() => {
        getMe().then((user) => {
            if (user?.empresaId) {
                setEmpresaId(user.empresaId);
                loadRatings(user.empresaId);
            }
        });
    }, []);

    const loadRatings = async (empId: number) => {
        try {
            const [ratingsData, avgData] = await Promise.all([
                getRatingsByEmpresa(),
                getAverageRatings(empId)
            ]);
            
            // Buscar nome dos clientes para cada avaliação
            const nomes: Record<string, string> = {};
            for (const rating of ratingsData) {
                if (rating.telefone_cliente) {
                    const client = await getClientByPhone(rating.telefone_cliente);
                    if (client?.nome) {
                        nomes[rating.telefone_cliente] = client.nome;
                    }
                }
            }
            setClienteNomes(nomes);
            setRatings(ratingsData);
            setAverage(avgData);
        } catch (error) {
            console.error('Erro ao carregar avaliações:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredRatings = ratings.filter(r => 
        r.comentario?.toLowerCase().includes(filter.toLowerCase()) ||
        r.telefone_cliente?.includes(filter)
    );

    const getStarDisplay = (nota: number) => {
        return '⭐'.repeat(nota) + '☆'.repeat(5 - nota);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <SidebarProvider>
                <DashboardLayout>
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500"></div>
                    </div>
                </DashboardLayout>
            </SidebarProvider>
        );
    }

    return (
        <SidebarProvider>
            <DashboardLayout>
                <div className="space-y-6">
                    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Avaliações dos Clientes</h1>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Veja o que seus clientes estão dizendo</p>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white"
                            />
                        </div>
                    </header>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="size-10 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center">
                                    <Star className="size-5 text-violet-600" />
                                </div>
                                <span className="text-sm text-slate-500 dark:text-slate-400">Total de Avaliações</span>
                            </div>
                            <p className="text-3xl font-black text-slate-900 dark:text-white">{average?.total_avaliacoes || 0}</p>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="size-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                                    <span className="text-xl">🍕</span>
                                </div>
                                <span className="text-sm text-slate-500 dark:text-slate-400">Média Comida</span>
                            </div>
                            <p className="text-3xl font-black text-amber-600">{average?.media_comida || '0.0'}</p>
                            <p className="text-xs text-slate-400 mt-1">{getStarDisplay(Math.round(Number(average?.media_comida || 0)))}</p>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="size-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                                    <span className="text-xl">🛵</span>
                                </div>
                                <span className="text-sm text-slate-500 dark:text-slate-400">Média Entrega</span>
                            </div>
                            <p className="text-3xl font-black text-blue-600">{average?.media_entrega || '0.0'}</p>
                            <p className="text-xs text-slate-400 mt-1">{getStarDisplay(Math.round(Number(average?.media_entrega || 0)))}</p>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="size-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                                    <MessageCircle className="size-5 text-green-600" />
                                </div>
                                <span className="text-sm text-slate-500 dark:text-slate-400">Com Comentários</span>
                            </div>
                            <p className="text-3xl font-black text-green-600">{ratings.filter(r => r.comentario).length}</p>
                        </div>
                    </div>

                    {/* Ratings List */}
                    {filteredRatings.length === 0 ? (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center">
                            <Star className="size-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Nenhuma avaliação ainda</h3>
                            <p className="text-slate-500 dark:text-slate-400">As avaliações aparecerão aqui quando os clientes avaliarem seus pedidos.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredRatings.map((rating) => (
                                <div
                                    key={rating.id}
                                    className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700"
                                >
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="flex items-center gap-2">
                                                    <User className="size-4 text-violet-500" />
                                                    <span className="text-sm font-bold text-violet-600 dark:text-violet-400">
                                                        {clienteNomes[rating.telefone_cliente] || 'Cliente'}
                                                    </span>
                                                </div>
                                                <span className="text-slate-300">|</span>
                                                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
                                                    Pedido #{rating.pedido_id}
                                                </span>
                                                <span className="text-xs text-slate-400">
                                                    {formatDate(rating.created_at)}
                                                </span>
                                            </div>
                                            
                                            <div className="flex gap-6 mb-3">
                                                <div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Comida</p>
                                                    <div className="text-lg">{getStarDisplay(rating.nota_comida)}</div>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Entrega</p>
                                                    <div className="text-lg">{getStarDisplay(rating.nota_entrega)}</div>
                                                </div>
                                            </div>

                                            {rating.comentario && (
                                                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 mt-2">
                                                    <p className="text-sm text-slate-700 dark:text-slate-300">"{rating.comentario}"</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="text-right">
                                            <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                {clienteNomes[rating.telefone_cliente] ? rating.telefone_cliente : ''}
                                            </div>
                                            {!clienteNomes[rating.telefone_cliente] && (
                                                <span className="text-xs text-slate-400">{rating.telefone_cliente}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DashboardLayout>
        </SidebarProvider>
    );
}