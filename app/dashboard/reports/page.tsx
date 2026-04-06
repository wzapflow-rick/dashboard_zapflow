'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';
import { 
    DollarSign, 
    TrendingUp, 
    TrendingDown, 
    ShoppingBag, 
    CreditCard, 
    Truck, 
    Calendar,
    Download,
    ChevronDown,
    PieChart,
    BarChart3
} from 'lucide-react';
import { getSalesReport, getMonthlyComparison } from '@/app/actions/reports';

interface ReportData {
    periodo: { inicio: string; fim: string };
    totalVendas: number;
    totalDescontos: number;
    totalTaxasEntrega: number;
    quantidadePedidos: number;
    mediaPorPedido: number;
    pedidoMaisCaro: { id: number; valor: number; cliente: string; data: string } | null;
    statusCounts: Record<string, number>;
    pagamentos: Record<string, number>;
    entregas: Record<string, number>;
    vendasPorDia: Record<string, number>;
    topProdutos: { nome: string; qtd: number }[];
}

const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

function ReportsContent() {
    const [loading, setLoading] = useState(true);
    const [report, setReport] = useState<ReportData | null>(null);
    const [monthlyData, setMonthlyData] = useState<any[]>([]);
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(1)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        loadReport();
        loadMonthly();
    }, [dateRange]);

    const loadReport = async () => {
        setLoading(true);
        try {
            const data = await getSalesReport(dateRange.start, dateRange.end);
            setReport(data);
        } catch (err) {
            console.error('Erro ao carregar relatório:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadMonthly = async () => {
        try {
            const data = await getMonthlyComparison();
            setMonthlyData(data);
        } catch (err) {
            console.error('Erro ao carregar comparação mensal:', err);
        }
    };

    const quickRanges = [
        { label: 'Hoje', days: 0 },
        { label: 'Ontem', days: 1 },
        { label: 'Últimos 7 dias', days: 7 },
        { label: 'Últimos 30 dias', days: 30 },
    ];

    const handleQuickRange = (days: number) => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);
        setDateRange({
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        });
    };

    const handleExport = () => {
        if (!report) return;
        
        // Export to CSV
        const headers = ['Data', 'Produto', 'Quantidade', 'Valor Total', 'Forma Pagamento', 'Tipo Entrega'];
        const rows = Object.entries(report.vendasPorDia).map(([data, valor]) => [data, '', '', valor, '', '']);
        
        const csvContent = [
            'RELATÓRIO DE VENDAS',
            `Período: ${report.periodo.inicio} até ${report.periodo.fim}`,
            '',
            'RESUMO',
            `Faturamento Total,R$ ${report.totalVendas.toFixed(2).replace('.', ',')}`,
            `Pedidos,${report.quantidadePedidos}`,
            `Média por Pedido,R$ ${report.mediaPorPedido.toFixed(2).replace('.', ',')}`,
            `Descontos,R$ ${report.totalDescontos.toFixed(2).replace('.', ',')}`,
            `Taxas de Entrega,R$ ${report.totalTaxasEntrega.toFixed(2).replace('.', ',')}`,
            '',
            'TOP PRODUTOS',
            ...report.topProdutos.map(p => `${p.nome},${p.qtd}`),
            '',
            'FORMA DE PAGAMENTO',
            ...Object.entries(report.pagamentos).map(([forma, valor]) => `${forma},R$ ${valor.toFixed(2).replace('.', ',')}`),
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio_vendas_${report.periodo.inicio}_ate_${report.periodo.fim}.csv`;
        link.click();
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Relatórios</h1>
                    <p className="text-slate-500 mt-1">Análisis de vendas e desempenho</p>
                </div>
                <button 
                    onClick={handleExport}
                    disabled={!report}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Download className="size-4" />
                    Exportar
                </button>
            </div>

            {/* Date Range Selector */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex gap-2">
                        {quickRanges.map((range) => (
                            <button
                                key={range.label}
                                onClick={() => handleQuickRange(range.days)}
                                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                            >
                                {range.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
                        />
                        <span className="text-slate-400">até</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                    <p className="text-slate-500 mt-2">Carregando...</p>
                </div>
            ) : report ? (
                <>
                    {/* Main Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-2xl border border-slate-200 p-4">
                            <div className="flex items-center gap-2 text-slate-500 mb-2">
                                <DollarSign className="size-4" />
                                <span className="text-sm font-medium">Faturamento</span>
                            </div>
                            <p className="text-2xl font-black text-green-600">{formatCurrency(report.totalVendas)}</p>
                            <p className="text-xs text-slate-400 mt-1">{report.quantidadePedidos} pedidos</p>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-4">
                            <div className="flex items-center gap-2 text-slate-500 mb-2">
                                <TrendingUp className="size-4" />
                                <span className="text-sm font-medium">Média/Pedido</span>
                            </div>
                            <p className="text-2xl font-black text-violet-600">{formatCurrency(report.mediaPorPedido)}</p>
                            <p className="text-xs text-slate-400 mt-1">por pedido</p>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-4">
                            <div className="flex items-center gap-2 text-slate-500 mb-2">
                                <ShoppingBag className="size-4" />
                                <span className="text-sm font-medium">Descontos</span>
                            </div>
                            <p className="text-2xl font-black text-red-500">{formatCurrency(report.totalDescontos)}</p>
                            <p className="text-xs text-slate-400 mt-1">total concedidos</p>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-4">
                            <div className="flex items-center gap-2 text-slate-500 mb-2">
                                <Truck className="size-4" />
                                <span className="text-sm font-medium">Taxas Entrega</span>
                            </div>
                            <p className="text-2xl font-black text-blue-600">{formatCurrency(report.totalTaxasEntrega)}</p>
                            <p className="text-xs text-slate-400 mt-1">recebidas</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Top Produtos */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-4">
                            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <BarChart3 className="size-5 text-primary" />
                                Produtos Mais Vendidos
                            </h3>
                            <div className="space-y-3">
                                {report.topProdutos.map((produto, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-600 text-xs font-bold flex items-center justify-center">
                                            {idx + 1}
                                        </span>
                                        <span className="flex-1 font-medium text-slate-900 text-sm truncate">{produto.nome}</span>
                                        <span className="text-sm font-bold text-slate-500">{produto.qtd}x</span>
                                    </div>
                                ))}
                                {report.topProdutos.length === 0 && (
                                    <p className="text-slate-400 text-center py-4">Nenhum produto vendido no período</p>
                                )}
                            </div>
                        </div>

                        {/* Pagamentos */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-4">
                            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <CreditCard className="size-5 text-primary" />
                                Forma de Pagamento
                            </h3>
                            <div className="space-y-3">
                                {Object.entries(report.pagamentos).map(([forma, valor]) => (
                                    <div key={forma} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${
                                                forma === 'pix' ? 'bg-purple-500' :
                                                forma === 'dinheiro' ? 'bg-green-500' :
                                                forma === 'cartão' ? 'bg-blue-500' : 'bg-slate-400'
                                            }`} />
                                            <span className="font-medium text-slate-900 capitalize">{forma}</span>
                                        </div>
                                        <span className="font-bold text-slate-700">{formatCurrency(valor)}</span>
                                    </div>
                                ))}
                                {Object.keys(report.pagamentos).length === 0 && (
                                    <p className="text-slate-400 text-center py-4">Nenhum pagamento registrado</p>
                                )}
                            </div>
                        </div>

                        {/* Tipo de Entrega */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-4">
                            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <Truck className="size-5 text-primary" />
                                Tipo de Entrega
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Truck className="size-4 text-blue-500" />
                                        <span className="font-medium text-slate-900">Delivery</span>
                                    </div>
                                    <span className="font-bold text-blue-600">{report.entregas.delivery}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ShoppingBag className="size-4 text-purple-500" />
                                        <span className="font-medium text-slate-900">Retirada</span>
                                    </div>
                                    <span className="font-bold text-purple-600">{report.entregas.retirada}</span>
                                </div>
                            </div>
                        </div>

                        {/* Status dos Pedidos */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-4">
                            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <PieChart className="size-5 text-primary" />
                                Status dos Pedidos
                            </h3>
                            <div className="space-y-2">
                                {Object.entries(report.statusCounts).map(([status, count]) => (
                                    <div key={status} className="flex items-center justify-between text-sm">
                                        <span className="capitalize text-slate-600">{status}</span>
                                        <span className="font-bold text-slate-900">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Comparativo Mensal */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4">
                        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Calendar className="size-5 text-primary" />
                            Evolução Mensal (Últimos 6 meses)
                        </h3>
                        <div className="flex items-end gap-2 h-40">
                            {monthlyData.map((mes, idx) => {
                                const max = Math.max(...monthlyData.map(m => m.total), 1);
                                const height = (mes.total / max) * 100;
                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                                        <div 
                                            className="w-full bg-violet-500 rounded-t-lg transition-all hover:bg-violet-600"
                                            style={{ height: `${height}%`, minHeight: mes.total > 0 ? '4px' : '0' }}
                                        />
                                        <span className="text-xs text-slate-500 uppercase">{mes.mes}</span>
                                        <span className="text-xs font-bold text-slate-700">{formatCurrency(mes.total)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            ) : (
                <div className="text-center py-12">
                    <p className="text-slate-500">Nenhum dado encontrado para o período selecionado</p>
                </div>
            )}
        </div>
    );
}

export default function ReportsPage() {
    return (
        <SidebarProvider>
            <DashboardLayout>
                <ReportsContent />
            </DashboardLayout>
        </SidebarProvider>
    );
}
