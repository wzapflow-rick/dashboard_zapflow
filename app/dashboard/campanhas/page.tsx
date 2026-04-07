'use client';

/*
SETUP NECESSÁRIO:
1. No NocoDB, criar tabela "campanhas_config" com os campos descritos em /docs/CAMPANHAS.md
2. Copiar o ID da tabela e colar em NOCODB_TABLE_CAMPANHAS no .env
3. Criar tabela "campanhas_disparos" e colar ID em NOCODB_TABLE_DISPAROS
4. Gerar uma string aleatória segura e colocar em N8N_WEBHOOK_SECRET
5. No N8N, configurar o webhook com a mesma chave
*/

import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';
import {
    Megaphone,
    Plus,
    Edit,
    Trash2,
    X,
    Loader2,
    Send,
    AlertCircle,
    Users,
    TrendingUp,
    ChevronLeft,
    ChevronRight,
    Check,
    Clock,
    CalendarDays
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import {
    getCampanhas,
    createCampanha,
    updateCampanha,
    deleteCampanha,
    toggleCampanha,
    getDisparos,
    getDisparosStats,
    type CampanhaConfig,
    type CampanhaFormData,
    type CampanhaTipo,
    type DisparoLog,
    type DisparoStats
} from '@/app/actions/campanhas';

const TIPOS: { value: CampanhaTipo; label: string; color: string }[] = [
    { value: 'reengajamento', label: 'Reengajamento', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    { value: 'cupom', label: 'Cupom', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    { value: 'pos_pedido', label: 'Pós-pedido', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    { value: 'horario', label: 'Horário', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    { value: 'data_especial', label: 'Data especial', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
    { value: 'produto_destaque', label: 'Produto destaque', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
];

const VARS_POR_TIPO: Record<CampanhaTipo, string[]> = {
    reengajamento: ['nome_cliente', 'ultimo_pedido', 'dias_ausente', 'nome_loja'],
    cupom: ['nome_cliente', 'cupom', 'desconto', 'nome_loja'],
    pos_pedido: ['nome_cliente', 'ultimo_pedido', 'pontos', 'produto_destaque', 'nome_loja'],
    horario: ['nome_cliente', 'nome_loja'],
    data_especial: ['nome_cliente', 'cupom', 'desconto', 'nome_loja'],
    produto_destaque: ['nome_cliente', 'produto_destaque', 'cupom', 'desconto', 'nome_loja'],
};

const DIAS_SEMANA = [
    { value: 'seg', label: 'Seg' },
    { value: 'ter', label: 'Ter' },
    { value: 'qua', label: 'Qua' },
    { value: 'qui', label: 'Qui' },
    { value: 'sex', label: 'Sex' },
    { value: 'sab', label: 'Sáb' },
    { value: 'dom', label: 'Dom' },
];

const STATUS_COLORS: Record<string, string> = {
    enviado: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    erro: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    ignorado: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

const emptyFormData: CampanhaFormData = {
    tipo: 'reengajamento',
    ativo: true,
    nome: '',
    gatilho_dias: 7,
    horario_envio: '10:00',
    dias_semana: ['seg', 'ter', 'qua', 'qui', 'sex'],
    desconto_percentual: 0,
    variante_1: '',
    variante_2: '',
    variante_3: '',
    variante_4: '',
    max_envios_semana: 2,
};

export default function CampanhasPage() {
    const [campanhas, setCampanhas] = useState<CampanhaConfig[]>([]);
    const [disparos, setDisparos] = useState<DisparoLog[]>([]);
    const [stats, setStats] = useState<DisparoStats>({ total_enviados: 0, total_erros: 0, total_clientes_alcancados: 0 });
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCampanha, setEditingCampanha] = useState<CampanhaConfig | null>(null);
    const [formData, setFormData] = useState<CampanhaFormData>(emptyFormData);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState(1);
    const [disparoPage, setDisparoPage] = useState(1);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
    const textareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});

    const DISPAROS_PER_PAGE = 20;

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            setLoading(true);
            const [campanhasData, disparosData, statsData] = await Promise.all([
                getCampanhas(),
                getDisparos(),
                getDisparosStats()
            ]);
            setCampanhas(campanhasData);
            setDisparos(disparosData);
            setStats(statsData);
        } catch (error) {
            console.error('Erro ao carregar campanhas:', error);
            toast.error('Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    }

    function openModal(campanha?: CampanhaConfig) {
        if (campanha) {
            setEditingCampanha(campanha);
            setFormData({
                tipo: campanha.tipo,
                ativo: campanha.ativo,
                nome: campanha.nome,
                gatilho_dias: campanha.gatilho_dias || 7,
                horario_envio: campanha.horario_envio || '10:00',
                dias_semana: campanha.dias_semana || ['seg', 'ter', 'qua', 'qui', 'sex'],
                desconto_percentual: campanha.desconto_percentual || 0,
                variante_1: campanha.variante_1 || '',
                variante_2: campanha.variante_2 || '',
                variante_3: campanha.variante_3 || '',
                variante_4: campanha.variante_4 || '',
                max_envios_semana: campanha.max_envios_semana || 2,
            });
            setActiveTab(1);
        } else {
            setEditingCampanha(null);
            setFormData(emptyFormData);
            setActiveTab(1);
        }
        setIsModalOpen(true);
    }

    function closeModal() {
        setIsModalOpen(false);
        setEditingCampanha(null);
        setFormData(emptyFormData);
    }

    async function handleSave() {
        if (!formData.nome.trim()) {
            toast.error('Nome da campanha é obrigatório');
            return;
        }
        if (!formData.variante_1.trim()) {
            toast.error('Variante 1 é obrigatória');
            return;
        }

        setSaving(true);
        try {
            if (editingCampanha) {
                const result = await updateCampanha(editingCampanha.id, formData);
                if (result.success) {
                    toast.success('Campanha atualizada!');
                    closeModal();
                    await loadData();
                } else {
                    toast.error(result.error || 'Erro ao atualizar');
                }
            } else {
                const result = await createCampanha(formData);
                if (result.success) {
                    toast.success('Campanha criada!');
                    closeModal();
                    await loadData();
                } else {
                    toast.error(result.error || 'Erro ao criar');
                }
            }
        } catch (error) {
            toast.error('Erro ao salvar campanha');
        } finally {
            setSaving(false);
        }
    }

    async function handleToggle(id: number, ativo: boolean) {
        try {
            const result = await toggleCampanha(id, ativo);
            if (result.success) {
                toast.success(ativo ? 'Campanha ativada' : 'Campanha desativada');
                await loadData();
            } else {
                toast.error(result.error || 'Erro ao alternar');
            }
        } catch (error) {
            toast.error('Erro ao alternar campanha');
        }
    }

    async function handleDelete(id: number) {
        try {
            const result = await deleteCampanha(id);
            if (result.success) {
                toast.success('Campanha excluída');
                setDeleteConfirm(null);
                await loadData();
            } else {
                toast.error(result.error || 'Erro ao excluir');
            }
        } catch (error) {
            toast.error('Erro ao excluir campanha');
        }
    }

    function insertVariable(varName: string, tab: number) {
        const textarea = textareaRefs.current[tab];
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = formData[`variante_${tab}` as keyof CampanhaFormData] as string || '';
        const newText = text.substring(0, start) + `{{${varName}}}` + text.substring(end);

        setFormData(prev => ({ ...prev, [`variante_${tab}`]: newText }));

        setTimeout(() => {
            textarea.focus();
            const newPos = start + `{{${varName}}}`.length;
            textarea.setSelectionRange(newPos, newPos);
        }, 0);
    }

    const getTipoInfo = (tipo: CampanhaTipo) => TIPOS.find(t => t.value === tipo) || TIPOS[0];

    const pageCount = Math.max(1, Math.ceil(disparos.length / DISPAROS_PER_PAGE));
    const paginatedDisparos = disparos.slice(
        (disparoPage - 1) * DISPAROS_PER_PAGE,
        disparoPage * DISPAROS_PER_PAGE
    );

    const taxaErro = stats.total_enviados + stats.total_erros > 0
        ? ((stats.total_erros / (stats.total_enviados + stats.total_erros)) * 100).toFixed(1)
        : '0';

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleString('pt-BR');
        } catch {
            return dateStr;
        }
    };

    const truncate = (str: string, len: number) => str.length > len ? str.substring(0, len) + '...' : str;

    return (
        <SidebarProvider>
            <DashboardLayout>
                <div className="space-y-8">
                    <header className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Campanhas automáticas</h1>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Configure mensagens automáticas via WhatsApp para seus clientes.</p>
                        </div>
                        <button
                            onClick={() => openModal()}
                            className="px-4 py-2.5 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 transition-all flex items-center gap-2 text-sm"
                        >
                            <Plus className="size-4" />
                            Nova campanha
                        </button>
                    </header>

                    {/* Metric Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="size-11 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center text-green-600 dark:text-green-400">
                                    <Send className="size-5" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Enviados (30 dias)</p>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total_enviados}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="size-11 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                                    <Users className="size-5" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Clientes alcançados</p>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total_clientes_alcancados}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="size-11 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center text-red-600 dark:text-red-400">
                                    <AlertCircle className="size-5" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Taxa de erro</p>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{taxaErro}%</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Campaigns List */}
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <Megaphone className="size-5 text-violet-500" />
                            Campanhas configuradas
                        </h2>

                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="size-8 animate-spin text-violet-500" />
                            </div>
                        ) : campanhas.length === 0 ? (
                            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center">
                                <Megaphone className="size-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                                <p className="text-slate-500 dark:text-slate-400">Nenhuma campanha configurada ainda.</p>
                                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Clique em "Nova campanha" para começar.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {campanhas.map((c) => {
                                    const tipoInfo = getTipoInfo(c.tipo);
                                    const numVariantes = [c.variante_1, c.variante_2, c.variante_3, c.variante_4].filter(Boolean).length;

                                    return (
                                        <div
                                            key={c.id}
                                            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm"
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => handleToggle(c.id, !c.ativo)}
                                                        className={cn(
                                                            "relative w-11 h-6 rounded-full transition-colors",
                                                            c.ativo ? "bg-violet-600" : "bg-slate-300 dark:bg-slate-600"
                                                        )}
                                                    >
                                                        <span className={cn(
                                                            "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm",
                                                            c.ativo ? "translate-x-5" : "translate-x-0"
                                                        )} />
                                                    </button>
                                                    <div>
                                                        <h3 className="font-bold text-slate-900 dark:text-white">{c.nome}</h3>
                                                        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${tipoInfo.color}`}>
                                                            {tipoInfo.label}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => openModal(c)}
                                                        className="p-1.5 text-slate-400 hover:text-violet-500 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                                                    >
                                                        <Edit className="size-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteConfirm(c.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-4">
                                                {c.horario_envio && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="size-3.5" />
                                                        {c.horario_envio}
                                                    </span>
                                                )}
                                                {c.dias_semana && c.dias_semana.length > 0 && (
                                                    <span className="flex items-center gap-1">
                                                        <CalendarDays className="size-3.5" />
                                                        {c.dias_semana.map(d => d.toUpperCase()).join(', ')}
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1">
                                                    {numVariantes} variante{numVariantes > 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Disparos History */}
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <TrendingUp className="size-5 text-violet-500" />
                            Histórico de disparos
                        </h2>

                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
                                        <tr>
                                            <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Data/Hora</th>
                                            <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Campanha</th>
                                            <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Cliente</th>
                                            <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Telefone</th>
                                            <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Variante</th>
                                            <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                                            <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Mensagem</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {paginatedDisparos.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                                                    Nenhum disparo registrado ainda.
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedDisparos.map((d) => {
                                                const campanha = campanhas.find(c => c.id === d.campanha_id);
                                                return (
                                                    <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                            {formatDate(d.enviado_em)}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                            {campanha ? campanha.nome : `#${d.campanha_id}`}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                            #{d.cliente_id}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono text-xs">
                                                            {d.telefone}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                            V{d.variante_usada}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[d.status]}`}>
                                                                {d.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate" title={d.mensagem_enviada}>
                                                            {truncate(d.mensagem_enviada, 50)}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {pageCount > 1 && (
                                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-600">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Página {disparoPage} de {pageCount}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setDisparoPage(p => Math.max(1, p - 1))}
                                            disabled={disparoPage === 1}
                                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            <ChevronLeft className="size-4" />
                                        </button>
                                        <button
                                            onClick={() => setDisparoPage(p => Math.min(pageCount, p + 1))}
                                            disabled={disparoPage === pageCount}
                                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Modal */}
                <AnimatePresence>
                    {isModalOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4"
                            onClick={closeModal}
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
                            >
                                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                        {editingCampanha ? 'Editar campanha' : 'Nova campanha'}
                                    </h2>
                                    <button onClick={closeModal} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                        <X className="size-5 text-slate-400" />
                                    </button>
                                </div>

                                <div className="p-6 space-y-6">
                                    {/* Seção 1 — Identificação */}
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Identificação</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Nome *</label>
                                                <input
                                                    type="text"
                                                    value={formData.nome}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                                                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                                                    placeholder="Ex: Reengajamento 7 dias"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Tipo</label>
                                                <select
                                                    value={formData.tipo}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value as CampanhaTipo }))}
                                                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                                                >
                                                    {TIPOS.map(t => (
                                                        <option key={t.value} value={t.value}>{t.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Seção 2 — Quando disparar */}
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Quando disparar</h3>

                                        {formData.tipo === 'reengajamento' && (
                                            <div className="mb-4">
                                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Dias sem pedido para disparar</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={formData.gatilho_dias || 7}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, gatilho_dias: parseInt(e.target.value) || 7 }))}
                                                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                                                />
                                            </div>
                                        )}

                                        {(formData.tipo === 'cupom' || formData.tipo === 'produto_destaque' || formData.tipo === 'reengajamento') && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Horário de envio</label>
                                                    <input
                                                        type="time"
                                                        value={formData.horario_envio || '10:00'}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, horario_envio: e.target.value }))}
                                                        className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Dias da semana</label>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {DIAS_SEMANA.map(d => {
                                                            const selected = (formData.dias_semana || []).includes(d.value);
                                                            return (
                                                                <button
                                                                    key={d.value}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const dias = formData.dias_semana || [];
                                                                        const newDias = selected
                                                                            ? dias.filter(x => x !== d.value)
                                                                            : [...dias, d.value];
                                                                        setFormData(prev => ({ ...prev, dias_semana: newDias }));
                                                                    }}
                                                                    className={cn(
                                                                        "px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors",
                                                                        selected
                                                                            ? "bg-violet-600 text-white border-violet-600"
                                                                            : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-violet-300"
                                                                    )}
                                                                >
                                                                    {d.label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {formData.tipo === 'pos_pedido' && (
                                            <div className="mb-4">
                                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Minutos após a entrega</label>
                                                <select
                                                    value={formData.gatilho_dias || 60}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, gatilho_dias: parseInt(e.target.value) }))}
                                                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                                                >
                                                    <option value={30}>30 minutos</option>
                                                    <option value={60}>60 minutos</option>
                                                    <option value={120}>120 minutos</option>
                                                </select>
                                            </div>
                                        )}

                                        {formData.tipo === 'horario' && (
                                            <div className="mb-4">
                                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Momento do disparo</label>
                                                <select
                                                    value={formData.gatilho_dias || 0}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, gatilho_dias: parseInt(e.target.value) }))}
                                                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                                                >
                                                    <option value={0}>Ao abrir a loja</option>
                                                    <option value={1}>1 hora antes de fechar</option>
                                                    <option value={2}>Ao fechar a loja</option>
                                                </select>
                                            </div>
                                        )}

                                        {formData.tipo === 'data_especial' && (
                                            <div className="mb-4">
                                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Data especial</label>
                                                <select
                                                    value={formData.gatilho_dias || 0}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, gatilho_dias: parseInt(e.target.value) }))}
                                                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                                                >
                                                    <option value={0}>Aniversário do cliente</option>
                                                    <option value={1}>Dia das Mães</option>
                                                    <option value={2}>Dia dos Namorados</option>
                                                    <option value={3}>Dia dos Pais</option>
                                                    <option value={4}>Natal</option>
                                                    <option value={5}>Aniversário da loja</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    {/* Seção 3 — Configurações */}
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Configurações</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Máx. mensagens por cliente/semana</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={10}
                                                    value={formData.max_envios_semana}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, max_envios_semana: parseInt(e.target.value) || 2 }))}
                                                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                                                />
                                            </div>
                                            {(formData.tipo === 'cupom' || formData.tipo === 'data_especial' || formData.tipo === 'produto_destaque') && (
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Desconto percentual (%)</label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={100}
                                                        value={formData.desconto_percentual || 0}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, desconto_percentual: parseInt(e.target.value) || 0 }))}
                                                        className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Seção 4 — Mensagens (variantes) */}
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Mensagens (variantes)</h3>

                                        {/* Tabs */}
                                        <div className="flex gap-1 mb-4 bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
                                            {[1, 2, 3, 4].map(tab => (
                                                <button
                                                    key={tab}
                                                    onClick={() => setActiveTab(tab)}
                                                    className={cn(
                                                        "flex-1 py-2 text-sm font-medium rounded-lg transition-colors",
                                                        activeTab === tab
                                                            ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                                                    )}
                                                >
                                                    Variante {tab}
                                                    {tab === 1 && <span className="text-red-500 ml-0.5">*</span>}
                                                </button>
                                            ))}
                                        </div>

                                        <textarea
                                            ref={(el) => { textareaRefs.current[activeTab] = el; }}
                                            value={(formData[`variante_${activeTab}` as 'variante_1' | 'variante_2' | 'variante_3' | 'variante_4'] || '')}
                                            onChange={(e) => setFormData(prev => ({ ...prev, [`variante_${activeTab}`]: e.target.value }))}
                                            rows={5}
                                            className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none resize-none"
                                            placeholder={`Escreva a mensagem da variante ${activeTab}...`}
                                        />

                                        {/* Variable chips */}
                                        <div className="mt-2">
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Variáveis disponíveis (clique para inserir):</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {VARS_POR_TIPO[formData.tipo].map(v => (
                                                    <button
                                                        key={v}
                                                        type="button"
                                                        onClick={() => insertVariable(v, activeTab)}
                                                        className="px-2 py-1 text-xs font-mono bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-lg border border-violet-200 dark:border-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors"
                                                    >
                                                        {`{{${v}}}`}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Modal footer */}
                                <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
                                    <button
                                        onClick={closeModal}
                                        className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="px-6 py-2.5 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {saving ? (
                                            <>
                                                <Loader2 className="size-4 animate-spin" />
                                                Salvando...
                                            </>
                                        ) : (
                                            <>
                                                <Check className="size-4" />
                                                {editingCampanha ? 'Salvar alterações' : 'Criar campanha'}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Delete confirmation */}
                <AnimatePresence>
                    {deleteConfirm && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4"
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 max-w-sm w-full"
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="size-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center text-red-600 dark:text-red-400">
                                        <Trash2 className="size-5" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Excluir campanha?</h3>
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                                    Esta ação não pode ser desfeita. Todos os dados desta campanha serão removidos permanentemente.
                                </p>
                                <div className="flex items-center justify-end gap-3">
                                    <button
                                        onClick={() => setDeleteConfirm(null)}
                                        className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={() => handleDelete(deleteConfirm)}
                                        className="px-4 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-all"
                                    >
                                        Excluir
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DashboardLayout>
        </SidebarProvider>
    );
}

function cn(...classes: (string | boolean | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}