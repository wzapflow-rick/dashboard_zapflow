'use client';

import { useState, useRef } from 'react';
import {
    estruturarCardapio,
    criarDemoCardapio,
    type CardapioEstruturado,
} from '@/app/actions/demo-cardapio';
import {
    Sparkles,
    Loader2,
    ImagePlus,
    Trash2,
    Plus,
    ExternalLink,
    Copy,
    Check,
    MessageCircle,
    UtensilsCrossed,
    ArrowLeft,
    ClipboardPaste,
} from 'lucide-react';

type Etapa = 'entrada' | 'revisao' | 'pronto';

interface DemoCriada {
    slug: string;
    empresaId: number;
    totalItens: number;
}

function formatBRL(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function DemoCardapioClient() {
    const [etapa, setEtapa] = useState<Etapa>('entrada');

    // Entrada
    const [texto, setTexto] = useState('');
    const [imagem, setImagem] = useState<string | null>(null);
    const [nomeLoja, setNomeLoja] = useState('');
    const [telefone, setTelefone] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Estado de processamento
    const [processando, setProcessando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    // Revisao
    const [cardapio, setCardapio] = useState<CardapioEstruturado | null>(null);

    // Resultado
    const [demo, setDemo] = useState<DemoCriada | null>(null);
    const [copiado, setCopiado] = useState(false);

    function handleImagem(file: File | null | undefined) {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setErro('Envie um arquivo de imagem (print do cardápio).');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => setImagem(reader.result as string);
        reader.readAsDataURL(file);
    }

    async function handleEstruturar() {
        setErro(null);
        if (!texto.trim() && !imagem) {
            setErro('Cole o texto do cardápio ou envie um print.');
            return;
        }
        setProcessando(true);
        const res = await estruturarCardapio({
            texto: texto.trim() || undefined,
            imagemBase64: imagem || undefined,
        });
        setProcessando(false);

        if (!res.success || !res.cardapio) {
            setErro(res.error || 'Falha ao processar o cardápio.');
            return;
        }
        setCardapio(res.cardapio);
        if (!nomeLoja && res.cardapio.nome_loja) setNomeLoja(res.cardapio.nome_loja);
        setEtapa('revisao');
    }

    async function handleCriar() {
        if (!cardapio) return;
        setErro(null);
        if (!nomeLoja.trim()) {
            setErro('Informe o nome da loja.');
            return;
        }
        setProcessando(true);
        const res = await criarDemoCardapio({
            cardapio,
            nomeLoja: nomeLoja.trim(),
            telefone: telefone.trim() || undefined,
        });
        setProcessando(false);

        if (!res.success || !res.slug) {
            setErro(res.error || 'Falha ao criar a demo.');
            return;
        }
        setDemo({ slug: res.slug, empresaId: res.empresaId!, totalItens: res.totalItens || 0 });
        setEtapa('pronto');
    }

    function resetar() {
        setEtapa('entrada');
        setTexto('');
        setImagem(null);
        setNomeLoja('');
        setTelefone('');
        setCardapio(null);
        setDemo(null);
        setErro(null);
        setCopiado(false);
    }

    // ----- edicao do cardapio na revisao -----
    function updateItem(ci: number, ii: number, campo: 'nome' | 'descricao' | 'preco', valor: string) {
        if (!cardapio) return;
        const novo = structuredClone(cardapio);
        if (campo === 'preco') {
            novo.categorias[ci].itens[ii].preco = parseFloat(valor.replace(',', '.')) || 0;
        } else {
            novo.categorias[ci].itens[ii][campo] = valor;
        }
        setCardapio(novo);
    }
    function removerItem(ci: number, ii: number) {
        if (!cardapio) return;
        const novo = structuredClone(cardapio);
        novo.categorias[ci].itens.splice(ii, 1);
        if (novo.categorias[ci].itens.length === 0) novo.categorias.splice(ci, 1);
        setCardapio(novo);
    }
    function updateCategoria(ci: number, nome: string) {
        if (!cardapio) return;
        const novo = structuredClone(cardapio);
        novo.categorias[ci].nome = nome;
        setCardapio(novo);
    }
    function adicionarItem(ci: number) {
        if (!cardapio) return;
        const novo = structuredClone(cardapio);
        novo.categorias[ci].itens.push({ nome: '', descricao: '', preco: 0 });
        setCardapio(novo);
    }

    const linkPublico =
        demo && typeof window !== 'undefined' ? `${window.location.origin}/menu/${demo.slug}` : '';

    function copiarLink() {
        if (!linkPublico) return;
        navigator.clipboard.writeText(linkPublico);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
    }

    function abrirWhatsApp() {
        if (!linkPublico) return;
        const msg =
            `Opa! Montei o cardápio digital da *${nomeLoja}* pra você ver funcionando 👇\n\n` +
            `${linkPublico}\n\n` +
            `É só abrir no celular. Seus clientes pedem por aqui sem comissão de app. ` +
            `Se curtir, eu deixo no ar de vez. O que achou?`;
        const tel = telefone.replace(/\D/g, '');
        const base = tel ? `https://wa.me/55${tel}` : 'https://wa.me/';
        window.open(`${base}?text=${encodeURIComponent(msg)}`, '_blank');
    }

    const totalItens = cardapio?.categorias.reduce((acc, c) => acc + c.itens.length, 0) ?? 0;

    return (
        <div className="min-h-screen bg-[#0a1628] p-4 lg:p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-start gap-4 mb-8">
                    <div className="size-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20 shrink-0">
                        <UtensilsCrossed className="size-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white text-balance">Demo de Cardápio por IA</h1>
                        <p className="text-slate-400 text-sm mt-1 text-pretty">
                            Cole o cardápio do prospect (texto ou print), a IA monta tudo, e você gera um link pronto pra
                            mandar no WhatsApp.
                        </p>
                    </div>
                </div>

                {/* Steps indicator */}
                <div className="flex items-center gap-2 mb-6 text-xs">
                    {(['entrada', 'revisao', 'pronto'] as Etapa[]).map((e, i) => {
                        const labels = ['1. Cardápio', '2. Revisão', '3. Link pronto'];
                        const ativo = etapa === e;
                        const concluido =
                            (e === 'entrada' && etapa !== 'entrada') ||
                            (e === 'revisao' && etapa === 'pronto');
                        return (
                            <div key={e} className="flex items-center gap-2">
                                <span
                                    className={
                                        'px-3 py-1 rounded-full border ' +
                                        (ativo
                                            ? 'bg-orange-500/15 border-orange-500/50 text-orange-300'
                                            : concluido
                                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                              : 'bg-[#0f1f35] border-[#1e3a5f] text-slate-500')
                                    }
                                >
                                    {labels[i]}
                                </span>
                                {i < 2 && <span className="text-slate-600">→</span>}
                            </div>
                        );
                    })}
                </div>

                {erro && (
                    <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                        {erro}
                    </div>
                )}

                {/* ETAPA 1: ENTRADA */}
                {etapa === 'entrada' && (
                    <div className="bg-[#0f1f35] border border-[#1e3a5f]/50 rounded-2xl p-6 space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                <ClipboardPaste className="inline size-4 mr-1.5 -mt-0.5" />
                                Cole o cardápio em texto
                            </label>
                            <textarea
                                value={texto}
                                onChange={(e) => setTexto(e.target.value)}
                                rows={6}
                                placeholder={
                                    'Ex:\nX-Burguer - 18,00\nX-Salada - 20,00\nRefrigerante lata - 6,00\n...'
                                }
                                className="w-full rounded-lg bg-[#0a1628] border border-[#1e3a5f] text-white placeholder:text-slate-600 px-4 py-3 text-sm focus:outline-none focus:border-orange-500/50 resize-y"
                            />
                        </div>

                        <div className="flex items-center gap-3 text-slate-500 text-xs">
                            <div className="h-px bg-[#1e3a5f] flex-1" />
                            E / OU
                            <div className="h-px bg-[#1e3a5f] flex-1" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                <ImagePlus className="inline size-4 mr-1.5 -mt-0.5" />
                                Print do cardápio (Instagram, foto, etc.)
                            </label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleImagem(e.target.files?.[0])}
                            />
                            {imagem ? (
                                <div className="relative inline-block">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={imagem || '/placeholder.svg'}
                                        alt="Print do cardápio enviado"
                                        className="max-h-48 rounded-lg border border-[#1e3a5f]"
                                    />
                                    <button
                                        onClick={() => setImagem(null)}
                                        className="absolute -top-2 -right-2 size-7 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600"
                                        aria-label="Remover imagem"
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full border-2 border-dashed border-[#1e3a5f] rounded-lg py-8 text-slate-500 hover:border-orange-500/40 hover:text-slate-400 transition-colors flex flex-col items-center gap-2"
                                >
                                    <ImagePlus className="size-7" />
                                    <span className="text-sm">Clique para enviar um print</span>
                                </button>
                            )}
                        </div>

                        <button
                            onClick={handleEstruturar}
                            disabled={processando}
                            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-60 text-white font-semibold py-3.5 rounded-lg flex items-center justify-center gap-2 transition-all"
                        >
                            {processando ? (
                                <>
                                    <Loader2 className="size-5 animate-spin" /> A IA está lendo o cardápio...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="size-5" /> Montar cardápio com IA
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* ETAPA 2: REVISAO */}
                {etapa === 'revisao' && cardapio && (
                    <div className="space-y-5">
                        <div className="bg-[#0f1f35] border border-[#1e3a5f]/50 rounded-2xl p-6 grid sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Nome da loja *</label>
                                <input
                                    value={nomeLoja}
                                    onChange={(e) => setNomeLoja(e.target.value)}
                                    placeholder="Ex: Burguer do João"
                                    className="w-full rounded-lg bg-[#0a1628] border border-[#1e3a5f] text-white placeholder:text-slate-600 px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    WhatsApp do dono (opcional)
                                </label>
                                <input
                                    value={telefone}
                                    onChange={(e) => setTelefone(e.target.value)}
                                    placeholder="Ex: 79998049790"
                                    className="w-full rounded-lg bg-[#0a1628] border border-[#1e3a5f] text-white placeholder:text-slate-600 px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <p className="text-slate-400 text-sm">
                                {cardapio.categorias.length} categoria(s) · {totalItens} item(ns). Revise e ajuste o que
                                precisar.
                            </p>
                        </div>

                        <div className="space-y-4">
                            {cardapio.categorias.map((cat, ci) => (
                                <div
                                    key={ci}
                                    className="bg-[#0f1f35] border border-[#1e3a5f]/50 rounded-2xl p-5"
                                >
                                    <input
                                        value={cat.nome}
                                        onChange={(e) => updateCategoria(ci, e.target.value)}
                                        className="bg-transparent text-orange-400 font-bold text-lg mb-3 w-full focus:outline-none border-b border-transparent focus:border-orange-500/40"
                                    />
                                    <div className="space-y-2">
                                        {cat.itens.map((item, ii) => (
                                            <div
                                                key={ii}
                                                className="flex flex-col sm:flex-row sm:items-center gap-2 bg-[#0a1628] rounded-lg p-3"
                                            >
                                                <div className="flex-1 space-y-1">
                                                    <input
                                                        value={item.nome}
                                                        onChange={(e) => updateItem(ci, ii, 'nome', e.target.value)}
                                                        placeholder="Nome do item"
                                                        className="w-full bg-transparent text-white text-sm font-medium focus:outline-none"
                                                    />
                                                    <input
                                                        value={item.descricao}
                                                        onChange={(e) =>
                                                            updateItem(ci, ii, 'descricao', e.target.value)
                                                        }
                                                        placeholder="Descrição (opcional)"
                                                        className="w-full bg-transparent text-slate-500 text-xs focus:outline-none"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-500 text-sm">R$</span>
                                                    <input
                                                        value={String(item.preco).replace('.', ',')}
                                                        onChange={(e) => updateItem(ci, ii, 'preco', e.target.value)}
                                                        inputMode="decimal"
                                                        className="w-20 bg-[#0f1f35] border border-[#1e3a5f] rounded px-2 py-1 text-white text-sm text-right focus:outline-none focus:border-orange-500/50"
                                                    />
                                                    <button
                                                        onClick={() => removerItem(ci, ii)}
                                                        className="text-slate-600 hover:text-red-400 p-1"
                                                        aria-label="Remover item"
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => adicionarItem(ci)}
                                        className="mt-3 text-xs text-slate-400 hover:text-orange-400 flex items-center gap-1"
                                    >
                                        <Plus className="size-3.5" /> Adicionar item
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => setEtapa('entrada')}
                                className="sm:w-auto px-4 py-3 rounded-lg border border-[#1e3a5f] text-slate-300 hover:bg-[#162438] flex items-center justify-center gap-2"
                            >
                                <ArrowLeft className="size-4" /> Voltar
                            </button>
                            <button
                                onClick={handleCriar}
                                disabled={processando}
                                className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-60 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
                            >
                                {processando ? (
                                    <>
                                        <Loader2 className="size-5 animate-spin" /> Criando a loja...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="size-5" /> Gerar link do cardápio
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* ETAPA 3: PRONTO */}
                {etapa === 'pronto' && demo && (
                    <div className="bg-[#0f1f35] border border-[#1e3a5f]/50 rounded-2xl p-6 space-y-6">
                        <div className="text-center">
                            <div className="size-14 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Check className="size-7 text-emerald-400" />
                            </div>
                            <h2 className="text-xl font-bold text-white">Cardápio da {nomeLoja} no ar!</h2>
                            <p className="text-slate-400 text-sm mt-1">
                                {demo.totalItens} item(ns) publicados. Mande o link pro dono ver funcionando.
                            </p>
                        </div>

                        <div className="flex items-center gap-2 bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-4 py-3">
                            <span className="text-slate-300 text-sm truncate flex-1">{linkPublico}</span>
                            <button
                                onClick={copiarLink}
                                className="text-slate-400 hover:text-white p-1.5 shrink-0"
                                aria-label="Copiar link"
                            >
                                {copiado ? (
                                    <Check className="size-4 text-emerald-400" />
                                ) : (
                                    <Copy className="size-4" />
                                )}
                            </button>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                            <a
                                href={linkPublico}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-3 rounded-lg border border-[#1e3a5f] text-slate-300 hover:bg-[#162438] flex items-center justify-center gap-2 font-medium"
                            >
                                <ExternalLink className="size-4" /> Abrir cardápio
                            </a>
                            <button
                                onClick={abrirWhatsApp}
                                className="px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2"
                            >
                                <MessageCircle className="size-4" /> Enviar no WhatsApp
                            </button>
                        </div>

                        <button
                            onClick={resetar}
                            className="w-full text-sm text-slate-400 hover:text-orange-400 flex items-center justify-center gap-1.5 pt-2"
                        >
                            <Plus className="size-4" /> Montar outra demo
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
