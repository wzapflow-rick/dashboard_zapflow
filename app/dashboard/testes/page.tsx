'use client';

import { useState } from 'react';
import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';
import { motion } from 'framer-motion';
import {
    FlaskConical,
    Play,
    RefreshCcw,
    Trash2,
    ShieldCheck,
    Info,
    CheckCircle2,
    Loader2,
    LayoutDashboard
} from 'lucide-react';
import { generateMockOrder, setupPizzariaFicticia } from '@/app/actions/testing';
import { toast } from 'sonner';

export default function TestPage() {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSettingUp, setIsSettingUp] = useState(false);
    const [generatedCount, setGeneratedCount] = useState(0);

    const handleSetup = async () => {
        try {
            setIsSettingUp(true);
            await setupPizzariaFicticia();
            toast.success('Ambiente de Pizzaria configurado com sucesso! Insumos, Categorias e Produtos criados.');
        } catch (error: any) {
            toast.error(error.message || 'Falha ao configurar ambiente');
        } finally {
            setIsSettingUp(false);
        }
    };

    const handleGenerate = async () => {
        try {
            setIsGenerating(true);
            await generateMockOrder();
            setGeneratedCount(prev => prev + 1);
            toast.success('Pedido de teste gerado com sucesso! Verifique o Kanban.');
        } catch (error: any) {
            toast.error(error.message || 'Falha ao gerar pedido');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleBulkGenerate = async (count: number) => {
        try {
            setIsGenerating(true);
            for (let i = 0; i < count; i++) {
                await generateMockOrder();
                setGeneratedCount(prev => prev + 1);
            }
            toast.success(`${count} pedidos gerados com sucesso!`);
        } catch (error: any) {
            toast.error('Erro durante a geração em massa');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <SidebarProvider>
            <DashboardLayout>
                <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
                    {/* Header */}
                    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-3 italic">
                                <FlaskConical className="size-8 text-primary animate-pulse" />
                                Módulo de Testes
                            </h1>
                            <p className="text-slate-500 font-medium mt-1">
                                Gere dados fictícios para validar o fluxo do sistema.
                            </p>
                        </div>
                        <div className="bg-primary/10 px-4 py-2 rounded-xl border border-primary/20 flex items-center gap-2">
                            <ShieldCheck className="size-5 text-primary" />
                            <span className="text-primary font-bold text-sm">Ambiente de Homologação</span>
                        </div>
                    </header>

                    {/* Alerta de Uso */}
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-4 items-start shadow-sm">
                        <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                            <Info className="size-5 text-amber-600" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-bold text-amber-800 text-sm italic uppercase tracking-wider">Atenção!</h4>
                            <p className="text-amber-700 text-sm leading-relaxed">
                                Estes pedidos são criados diretamente no banco de dados. Eles afetarão suas métricas de faturamento e estoque caso as automações estejam ativas. Use apenas em fase de desenvolvimento.
                            </p>
                        </div>
                    </div>

                    {/* Testing Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Generate Single */}
                        <motion.div
                            whileHover={{ y: -4 }}
                            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between"
                        >
                            <div className="space-y-2">
                                <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-2">
                                    <Play className="size-6 fill-current" />
                                </div>
                                <h3 className="text-lg font-black text-slate-900">Gerar Pedido Único</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    Cria um novo cliente aleatório e um pedido com 1 a 3 itens do seu cardápio com status "Novo".
                                </p>
                            </div>
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="w-full h-12 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isGenerating ? <Loader2 className="animate-spin size-5" /> : <Play className="size-4" />}
                                Gerar 1 Pedido
                            </button>
                        </motion.div>

                        {/* Generate Bulk */}
                        <motion.div
                            whileHover={{ y: -4 }}
                            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between border-b-4 border-b-primary"
                        >
                            <div className="space-y-2">
                                <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-2">
                                    <RefreshCcw className="size-6" />
                                </div>
                                <h3 className="text-lg font-black text-slate-900">Geração em Massa</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    Simule um grande volume de pedidos para testar a performance do Kanban e scroll infinito.
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleBulkGenerate(5)}
                                    disabled={isGenerating}
                                    className="flex-1 h-12 bg-slate-100 text-slate-900 border border-slate-200 rounded-xl font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
                                >
                                    +5 Pedidos
                                </button>
                                <button
                                    onClick={() => handleBulkGenerate(10)}
                                    disabled={isGenerating}
                                    className="flex-1 h-12 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all disabled:opacity-50"
                                >
                                    +10 Pedidos
                                </button>
                            </div>
                        </motion.div>
                        {/* Full Niche Setup */}
                        <motion.div
                            whileHover={{ y: -4 }}
                            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between border-t-4 border-t-green-500 md:col-span-2"
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="size-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600 mb-2">
                                        <LayoutDashboard className="size-6" />
                                    </div>
                                    <h3 className="text-lg font-black text-slate-900">Gerar Setup Completo (Pizzaria)</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed max-w-xl">
                                        Cria automaticamente categorias, 3 insumos (Mussarela, Molho, Calabresa), e um produto "Pizza de Calabresa" com ficha técnica vinculada. Ideal para novos testes do zero.
                                    </p>
                                </div>
                                <button
                                    onClick={handleSetup}
                                    disabled={isSettingUp || isGenerating}
                                    className="h-12 px-8 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
                                >
                                    {isSettingUp ? <Loader2 className="animate-spin size-5" /> : <LayoutDashboard className="size-4" />}
                                    Configurar Pizzaria Completa
                                </button>
                            </div>
                        </motion.div>
                    </div>

                    {/* Stats / Feedback */}
                    <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            <CheckCircle2 className="size-32" />
                        </div>
                        <div className="relative z-10">
                            <h4 className="text-primary font-black uppercase tracking-widest text-xs mb-2 italic">Dashboard de Testes</h4>
                            <div className="flex items-baseline gap-4">
                                <span className="text-6xl font-black">{generatedCount}</span>
                                <span className="text-slate-400 font-bold">Pedidos gerados nesta sessão</span>
                            </div>
                            <p className="mt-6 text-slate-400 text-sm max-w-md">
                                Esta tela é uma ferramenta de auxílio. Após concluir seus testes, todos os pedidos ficarão visíveis na aba **Expedição** e os clientes em **Clientes**.
                            </p>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </SidebarProvider>
    );
}
