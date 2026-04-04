'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';
import { Truck, DollarSign, Calendar, Check, X, Clock, Filter } from 'lucide-react';
import { getMe } from '@/app/actions/auth';
import { toast } from 'sonner';

interface EntregadorAcerto {
    entregador_id: number;
    entregador_nome: string;
    telefone: string;
    veiculo: string;
    quantidade_entregas: number;
    valor_por_entrega: number;
    valor_total: number;
    periodo: string;
    pago: boolean;
    pago_em?: string;
    pago_valor?: number;
}

export default function AcertosPage() {
    const [entregadores, setEntregadores] = useState<EntregadorAcerto[]>([]);
    const [totais, setTotais] = useState({ entregas: 0, valor: 0 });
    const [loading, setLoading] = useState(true);
    const [periodo, setPeriodo] = useState('hoje');
    const [empresaId, setEmpresaId] = useState<number | null>(null);

    useEffect(() => {
        getMe().then((user) => {
            if (user?.empresaId) {
                setEmpresaId(user.empresaId);
                loadData(user.empresaId);
            }
        });
    }, []);

    const loadData = async (empId: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/acertos?empresaId=${empId}&periodo=${periodo}`);

            if (!res.ok) {
                console.error('Error fetching data:', res.status);
            } else {
                const data = await res.json();
                setEntregadores(data.drivers || []);
                setTotais(data.totais || { entregas: 0, valor: 0 });
            }
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePeriodoChange = (novoPeriodo: string) => {
        setPeriodo(novoPeriodo);
        if (empresaId) {
            loadData(empresaId);
        }
    };

    const marcardPago = async (entregadorId: number, valor: number) => {
        console.log('marcardPago called:', entregadorId, valor);
        toast.success('Processando pagamento...');

        try {
            console.log('Making PATCH request...');
            const res = await fetch('/api/acertos', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entregador_id: entregadorId,
                    valor_pago: valor,
                    pago: true
                })
            });

            console.log('Response status:', res.status);

            if (res.ok) {
                const data = await res.json();
                console.log('Response data:', data);
                toast.success('Pagamento registrado com sucesso!');

                // Refresh data directly
                if (empresaId) {
                    await loadData(empresaId);
                }
            } else {
                const errorData = await res.json();
                console.log('Error:', errorData);
                toast.error('Erro: ' + (errorData.error || 'desconhecido'));
            }
        } catch (error) {
            console.error('Exception:', error);
            toast.error('Erro de conexão');
        }
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
                    <header>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Controle de Entregadores</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Acompanhe as entregas ecalculate o que precisa pagar</p>
                    </header>

                    {/* Filtro de período */}
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-4">
                            <Filter className="size-5 text-slate-400" />
                            <div className="flex gap-2">
                                {[
                                    { value: 'hoje', label: 'Hoje' },
                                    { value: 'semana', label: 'Últimos 7 dias' },
                                    { value: 'mes', label: 'Últimos 30 dias' }
                                ].map((p) => (
                                    <button
                                        key={p.value}
                                        onClick={() => handlePeriodoChange(p.value)}
                                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${periodo === p.value
                                                ? 'bg-violet-500 text-white'
                                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                            }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Cards de resumo */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="size-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                                    <Truck className="size-5 text-blue-600" />
                                </div>
                                <span className="text-sm text-slate-500 dark:text-slate-400">Total de Entregas</span>
                            </div>
                            <p className="text-3xl font-black text-slate-900 dark:text-white">{totais.entregas}</p>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="size-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                                    <Clock className="size-5 text-amber-600" />
                                </div>
                                <span className="text-sm text-slate-500 dark:text-slate-400">Pendente</span>
                            </div>
                            <p className="text-3xl font-black text-amber-600">R$ {totais.valor.toFixed(2)}</p>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="size-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                                    <Check className="size-5 text-green-600" />
                                </div>
                                <span className="text-sm text-slate-500 dark:text-slate-400">Já Pago</span>
                            </div>
                            <p className="text-3xl font-black text-green-600">
                                R$ {entregadores.reduce((sum, e) => sum + (e.pago_valor || 0), 0).toFixed(2)}
                            </p>
                        </div>
                    </div>

                    {/* Lista de entregadores */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 dark:bg-slate-700/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Entregador</th>
                                        <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Veículo</th>
                                        <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Entregas</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Valor/Entrega</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Total</th>
                                        <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {entregadores.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                                Nenhum entregador encontrado
                                            </td>
                                        </tr>
                                    ) : (
                                        entregadores.map((e) => (
                                            <tr key={e.entregador_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-10 bg-violet-100 dark:bg-violet-900/30 rounded-full flex items-center justify-center">
                                                            <Truck className="size-5 text-violet-600" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{e.entregador_nome}</p>
                                                            <p className="text-xs text-slate-500">{e.telefone}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center text-sm text-slate-600 dark:text-slate-300">
                                                    {e.veiculo || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                        {e.quantidade_entregas}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm text-slate-600 dark:text-slate-300">
                                                    R$ {e.valor_por_entrega.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-lg font-bold text-green-600">
                                                        R$ {e.valor_total.toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {e.pago ? (
                                                        <div className="flex flex-col items-center">
                                                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                                <Check className="size-3" />
                                                                Pago
                                                            </span>
                                                            <span className="text-xs text-slate-400 mt-1">
                                                                {e.pago_em ? new Date(e.pago_em).toLocaleDateString('pt-BR') : ''}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => {
                                                                console.log('BOTAO CLICADO', e.entregador_id, e.valor_total);
                                                                marcardPago(e.entregador_id, e.valor_total);
                                                            }}
                                                            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-sm transition-colors"
                                                        >
                                                            ✓ Pagar
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {entregadores.length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <Clock className="size-5 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                                        💡 Como funciona
                                    </p>
                                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                        O sistema busca automaticamente os pedidos finalizados do período selecionado e calcula o valor a pagar para cada entregador baseado no número de entregas × valor por entrega. Clique em "Pagar" para marcar como pago.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DashboardLayout>
        </SidebarProvider>
    );
}