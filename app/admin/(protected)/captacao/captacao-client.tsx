'use client';

import { useState } from 'react';
import { buscarLeads, importarLeads, type LeadCaptado } from '@/app/actions/captacao';
import {
    Search,
    Loader2,
    MapPin,
    Phone,
    Star,
    Radar,
    Send,
    CheckCircle2,
    ExternalLink,
    PhoneOff,
} from 'lucide-react';

export default function CaptacaoClient() {
    const [cidade, setCidade] = useState('');
    const [tipoComida, setTipoComida] = useState('');
    const [soComTelefone, setSoComTelefone] = useState(true);
    const [minAvaliacoes, setMinAvaliacoes] = useState(0);

    const [buscando, setBuscando] = useState(false);
    const [importando, setImportando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);
    const [sucesso, setSucesso] = useState<string | null>(null);

    const [leads, setLeads] = useState<LeadCaptado[]>([]);
    const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
    const [buscou, setBuscou] = useState(false);

    async function handleBuscar() {
        setErro(null);
        setSucesso(null);
        if (!cidade.trim() || !tipoComida.trim()) {
            setErro('Informe a cidade e o tipo de comida.');
            return;
        }
        setBuscando(true);
        const res = await buscarLeads({
            cidade: cidade.trim(),
            tipoComida: tipoComida.trim(),
            soComTelefone,
            minAvaliacoes,
        });
        setBuscando(false);
        setBuscou(true);

        if (!res.success || !res.leads) {
            setErro(res.error || 'Falha na busca.');
            setLeads([]);
            return;
        }
        setLeads(res.leads);
        // pre-seleciona todos os que ainda nao existem na base
        setSelecionados(new Set(res.leads.filter((l) => !l.jaExiste && l.telefone).map((l) => l.place_id)));
    }

    function toggle(placeId: string) {
        setSelecionados((prev) => {
            const novo = new Set(prev);
            if (novo.has(placeId)) novo.delete(placeId);
            else novo.add(placeId);
            return novo;
        });
    }

    function toggleTodos() {
        const elegiveis = leads.filter((l) => !l.jaExiste && l.telefone);
        if (selecionados.size === elegiveis.length) {
            setSelecionados(new Set());
        } else {
            setSelecionados(new Set(elegiveis.map((l) => l.place_id)));
        }
    }

    async function handleImportar() {
        setErro(null);
        setSucesso(null);
        const escolhidos = leads.filter((l) => selecionados.has(l.place_id));
        if (escolhidos.length === 0) {
            setErro('Selecione ao menos um lead para importar.');
            return;
        }
        setImportando(true);
        const res = await importarLeads({
            cidade: cidade.trim(),
            tipoComida: tipoComida.trim(),
            leads: escolhidos,
        });
        setImportando(false);

        if (!res.success) {
            setErro(res.error || 'Falha ao importar.');
            return;
        }
        setSucesso(
            `${res.importados} lead(s) importado(s) para o funil de remarketing.` +
                (res.pulados ? ` ${res.pulados} pulado(s) (telefone inválido).` : ''),
        );
        // marca os importados como ja existentes
        setLeads((prev) =>
            prev.map((l) => (selecionados.has(l.place_id) ? { ...l, jaExiste: true } : l)),
        );
        setSelecionados(new Set());
    }

    const novos = leads.filter((l) => !l.jaExiste).length;
    const elegiveis = leads.filter((l) => !l.jaExiste && l.telefone).length;

    return (
        <div className="min-h-screen bg-[#0a1628] p-4 lg:p-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-start gap-4 mb-8">
                    <div className="size-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0">
                        <Radar className="size-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white text-balance">Captação de Delivery Ativo</h1>
                        <p className="text-slate-400 text-sm mt-1 text-pretty">
                            Busque lojas de delivery por cidade e tipo de comida no Google, filtre os melhores leads e
                            jogue direto no funil de remarketing.
                        </p>
                    </div>
                </div>

                {/* Form de busca */}
                <div className="bg-[#0f1f35] border border-[#1e3a5f]/50 rounded-2xl p-6 space-y-5 mb-6">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                <MapPin className="inline size-4 mr-1.5 -mt-0.5" />
                                Cidade
                            </label>
                            <input
                                value={cidade}
                                onChange={(e) => setCidade(e.target.value)}
                                placeholder="Ex: Aracaju, SE"
                                className="w-full rounded-lg bg-[#0a1628] border border-[#1e3a5f] text-white placeholder:text-slate-600 px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                <Search className="inline size-4 mr-1.5 -mt-0.5" />
                                Tipo de comida / nicho
                            </label>
                            <input
                                value={tipoComida}
                                onChange={(e) => setTipoComida(e.target.value)}
                                placeholder="Ex: hamburgueria, pizzaria, açaí"
                                className="w-full rounded-lg bg-[#0a1628] border border-[#1e3a5f] text-white placeholder:text-slate-600 px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={soComTelefone}
                                onChange={(e) => setSoComTelefone(e.target.checked)}
                                className="size-4 rounded border-[#1e3a5f] bg-[#0a1628] accent-emerald-500"
                            />
                            Só lojas com telefone
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-300">
                            Mín. de avaliações:
                            <select
                                value={minAvaliacoes}
                                onChange={(e) => setMinAvaliacoes(Number(e.target.value))}
                                className="rounded-lg bg-[#0a1628] border border-[#1e3a5f] text-white px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500/50"
                            >
                                <option value={0}>Qualquer</option>
                                <option value={10}>10+</option>
                                <option value={50}>50+</option>
                                <option value={100}>100+</option>
                            </select>
                        </label>
                    </div>

                    <button
                        onClick={handleBuscar}
                        disabled={buscando}
                        className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-60 text-white font-semibold py-3.5 rounded-lg flex items-center justify-center gap-2 transition-all"
                    >
                        {buscando ? (
                            <>
                                <Loader2 className="size-5 animate-spin" /> Procurando lojas no Google...
                            </>
                        ) : (
                            <>
                                <Search className="size-5" /> Buscar lojas
                            </>
                        )}
                    </button>
                </div>

                {erro && (
                    <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                        {erro}
                    </div>
                )}
                {sucesso && (
                    <div className="mb-6 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
                        <CheckCircle2 className="size-4 shrink-0" />
                        {sucesso}
                    </div>
                )}

                {/* Resultados */}
                {buscou && !buscando && leads.length === 0 && !erro && (
                    <div className="text-center py-16 text-slate-500">
                        Nenhuma loja encontrada com esses filtros. Tente outro tipo de comida ou afrouxe os filtros.
                    </div>
                )}

                {leads.length > 0 && (
                    <>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                            <p className="text-slate-400 text-sm">
                                {leads.length} loja(s) · <span className="text-emerald-400">{novos} nova(s)</span> ·{' '}
                                {elegiveis} com telefone válido
                            </p>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={toggleTodos}
                                    className="text-xs text-slate-400 hover:text-emerald-400 underline"
                                >
                                    {selecionados.size === elegiveis ? 'Desmarcar todos' : 'Selecionar todos os novos'}
                                </button>
                                <button
                                    onClick={handleImportar}
                                    disabled={importando || selecionados.size === 0}
                                    className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2"
                                >
                                    {importando ? (
                                        <>
                                            <Loader2 className="size-4 animate-spin" /> Importando...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="size-4" /> Importar {selecionados.size} para o funil
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {leads.map((lead) => {
                                const selecionavel = !lead.jaExiste && !!lead.telefone;
                                const checked = selecionados.has(lead.place_id);
                                return (
                                    <div
                                        key={lead.place_id}
                                        className={
                                            'flex items-start gap-3 rounded-xl p-4 border transition-colors ' +
                                            (lead.jaExiste
                                                ? 'bg-[#0f1f35]/40 border-[#1e3a5f]/30 opacity-60'
                                                : checked
                                                  ? 'bg-emerald-500/5 border-emerald-500/40'
                                                  : 'bg-[#0f1f35] border-[#1e3a5f]/50')
                                        }
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            disabled={!selecionavel}
                                            onChange={() => toggle(lead.place_id)}
                                            className="mt-1 size-4 rounded border-[#1e3a5f] bg-[#0a1628] accent-emerald-500 disabled:opacity-30"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-white font-medium">{lead.nome}</span>
                                                {lead.jaExiste && (
                                                    <span className="text-[10px] uppercase tracking-wide bg-slate-600/30 text-slate-400 px-2 py-0.5 rounded-full">
                                                        já na base
                                                    </span>
                                                )}
                                                {lead.tipo && (
                                                    <span className="text-[10px] uppercase tracking-wide bg-[#1e3a5f]/50 text-slate-400 px-2 py-0.5 rounded-full">
                                                        {lead.tipo}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400 flex-wrap">
                                                {lead.telefone ? (
                                                    <span className="flex items-center gap-1">
                                                        <Phone className="size-3.5" /> {lead.telefone}
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-amber-500/80">
                                                        <PhoneOff className="size-3.5" /> sem telefone
                                                    </span>
                                                )}
                                                {lead.rating != null && (
                                                    <span className="flex items-center gap-1">
                                                        <Star className="size-3.5 fill-amber-400 text-amber-400" />
                                                        {lead.rating.toFixed(1)}
                                                        {lead.total_avaliacoes != null && (
                                                            <span className="text-slate-600">
                                                                ({lead.total_avaliacoes})
                                                            </span>
                                                        )}
                                                    </span>
                                                )}
                                                {lead.google_maps_uri && (
                                                    <a
                                                        href={lead.google_maps_uri}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1 text-slate-500 hover:text-emerald-400"
                                                    >
                                                        <ExternalLink className="size-3.5" /> Maps
                                                    </a>
                                                )}
                                            </div>
                                            {lead.endereco && (
                                                <p className="text-xs text-slate-600 mt-1 truncate">{lead.endereco}</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
