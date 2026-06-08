'use client';

import { useEffect, useState } from 'react';
import {
    getCronStatuses,
    getCronRunHistory,
    triggerCron,
    type CronStatus,
} from '@/app/actions/cron-monitoring';
import type { CronLastRun } from '@/lib/cron-logger';
import {
    Activity,
    CheckCircle,
    XCircle,
    Clock,
    Play,
    Loader2,
    RefreshCw,
    AlertTriangle,
    ChevronDown,
    ChevronRight,
} from 'lucide-react';

function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '—';
    }
}

/** Ha quanto tempo rodou (texto relativo simples). */
function timeAgo(iso: string | null | undefined): string {
    if (!iso) return 'nunca executado';
    const diffMs = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return 'agora há pouco';
    if (min < 60) return `há ${min} min`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `há ${hrs} h`;
    const dias = Math.floor(hrs / 24);
    return `há ${dias} dia${dias > 1 ? 's' : ''}`;
}

/** Considera o cron "atrasado" se nao roda ha mais de 26h (esperado: 1x/dia). */
function isStale(iso: string | null | undefined): boolean {
    if (!iso) return true;
    return Date.now() - new Date(iso).getTime() > 26 * 60 * 60 * 1000;
}

function SummaryBadges({ summary }: { summary: Record<string, unknown> | null }) {
    if (!summary || Object.keys(summary).length === 0) {
        return <span className="text-slate-500 text-sm">Sem dados</span>;
    }
    return (
        <div className="flex flex-wrap gap-2">
            {Object.entries(summary).map(([k, v]) => (
                <span
                    key={k}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0a1628] border border-[#1e3a5f] text-xs text-slate-300"
                >
                    <span className="text-slate-500">{k}:</span>
                    <span className="font-semibold text-white">{String(v)}</span>
                </span>
            ))}
        </div>
    );
}

function CronCard({ cron, onChanged }: { cron: CronStatus; onChanged: () => void }) {
    const [running, setRunning] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [history, setHistory] = useState<CronLastRun[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);

    const last = cron.lastRun;
    const stale = isStale(last?.created_at);
    const errored = last?.status === 'error';

    const handleRun = async () => {
        setRunning(true);
        setFeedback(null);
        try {
            const res = await triggerCron(cron.jobName);
            if (res.success) {
                setFeedback('Disparado com sucesso.');
                onChanged();
                if (expanded) loadHistory();
            } else {
                setFeedback(`Erro: ${res.error}`);
            }
        } finally {
            setRunning(false);
        }
    };

    const loadHistory = async () => {
        setLoadingHistory(true);
        try {
            const rows = await getCronRunHistory(cron.jobName);
            setHistory(rows);
        } finally {
            setLoadingHistory(false);
        }
    };

    const toggleExpand = () => {
        const next = !expanded;
        setExpanded(next);
        if (next && history.length === 0) loadHistory();
    };

    // Cor do indicador de status
    let statusColor = 'text-emerald-400';
    let StatusIcon = CheckCircle;
    let statusLabel = 'Operando';
    if (!last) {
        statusColor = 'text-slate-500';
        StatusIcon = Clock;
        statusLabel = 'Nunca executado';
    } else if (errored) {
        statusColor = 'text-red-400';
        StatusIcon = XCircle;
        statusLabel = 'Falhou';
    } else if (stale) {
        statusColor = 'text-amber-400';
        StatusIcon = AlertTriangle;
        statusLabel = 'Atrasado';
    }

    return (
        <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${statusColor}`}>
                        <StatusIcon className="size-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-lg">{cron.label}</h3>
                        <p className="text-sm text-slate-400 mt-0.5 max-w-xl">{cron.description}</p>
                        <div className="flex items-center gap-2 mt-2 text-sm">
                            <span className={`font-semibold ${statusColor}`}>{statusLabel}</span>
                            <span className="text-slate-600">•</span>
                            <span className="text-slate-400">Último disparo: {timeAgo(last?.created_at)}</span>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleRun}
                    disabled={running}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-60 text-white text-sm font-semibold transition-all shadow-lg shadow-orange-500/20"
                >
                    {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                    Executar agora
                </button>
            </div>

            {/* Detalhes do ultimo disparo */}
            <div className="mt-5 pt-5 border-t border-[#1e3a5f]/60 grid sm:grid-cols-2 gap-4">
                <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Data e hora</p>
                    <p className="text-sm text-white">{formatDateTime(last?.created_at)}</p>
                    {last?.duration_ms != null && (
                        <p className="text-xs text-slate-500 mt-1">Duração: {last.duration_ms} ms</p>
                    )}
                </div>
                <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Resultado</p>
                    <SummaryBadges summary={last?.summary ?? null} />
                </div>
            </div>

            {feedback && (
                <div
                    className={`mt-4 text-sm rounded-lg px-3 py-2 ${
                        feedback.startsWith('Erro')
                            ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    }`}
                >
                    {feedback}
                </div>
            )}

            {/* Historico */}
            <button
                onClick={toggleExpand}
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
            >
                {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                Histórico recente
            </button>

            {expanded && (
                <div className="mt-3 space-y-2">
                    {loadingHistory ? (
                        <div className="flex items-center gap-2 text-slate-500 text-sm">
                            <Loader2 className="size-4 animate-spin" /> Carregando...
                        </div>
                    ) : history.length === 0 ? (
                        <p className="text-sm text-slate-500">Nenhuma execução registrada ainda.</p>
                    ) : (
                        history.map((h, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between gap-4 flex-wrap bg-[#0a1628] border border-[#1e3a5f]/60 rounded-lg px-3 py-2"
                            >
                                <div className="flex items-center gap-2">
                                    {h.status === 'error' ? (
                                        <XCircle className="size-4 text-red-400" />
                                    ) : (
                                        <CheckCircle className="size-4 text-emerald-400" />
                                    )}
                                    <span className="text-sm text-slate-300">{formatDateTime(h.created_at)}</span>
                                </div>
                                <SummaryBadges summary={h.summary} />
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

export default function MonitoramentoPage() {
    const [crons, setCrons] = useState<CronStatus[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const data = await getCronStatuses();
            setCrons(data);
        } catch (error) {
            console.error('Erro ao carregar status dos crons:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="size-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                        <Activity className="size-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Monitoramento de Cobrança</h1>
                        <p className="text-slate-400 text-sm">Status dos disparos automáticos de cobrança e renovação.</p>
                    </div>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0f1f35] border border-[#1e3a5f] hover:border-orange-500/50 text-slate-300 hover:text-white text-sm font-medium transition-all"
                >
                    <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-500">
                    <Loader2 className="size-6 animate-spin mr-2" /> Carregando...
                </div>
            ) : (
                <div className="space-y-5">
                    {crons.map((cron) => (
                        <CronCard key={cron.jobName} cron={cron} onChanged={load} />
                    ))}

                    <div className="flex items-start gap-3 p-4 bg-[#0f1f35] border border-[#1e3a5f] rounded-xl text-sm text-slate-400">
                        <AlertTriangle className="size-5 text-amber-400 shrink-0 mt-0.5" />
                        <p>
                            Os disparos automáticos dependem do agendamento no crontab da VPS (1x ao dia). O status{' '}
                            <span className="text-amber-400 font-medium">Atrasado</span> indica que o cron não roda há mais de 26h —
                            verifique se a linha do crontab está ativa. Use <span className="text-white font-medium">Executar agora</span> para
                            disparar manualmente a qualquer momento.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
