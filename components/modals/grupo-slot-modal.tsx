'use client';

import React, { useState, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { upsertGrupoSlot, type GrupoSlot, type TipoGrupo, type RegraPreco, type ModoPreco } from '@/app/actions/grupos-slots';
import { getCategories } from '@/app/actions/products';
import { motion, AnimatePresence } from 'motion/react';

interface GrupoSlotModalProps {
    isOpen: boolean;
    editingGrupo: Partial<GrupoSlot> | null;
    onClose: () => void;
    onSaved: (grupo: GrupoSlot) => void;
    availableGrupos?: GrupoSlot[];
}

const SLOT_OPTIONS = [1, 2, 3, 4];

const SLOT_LABELS: Record<number, string> = {
    1: 'Inteiro',
    2: '½ + ½',
    3: '⅓ + ⅓ + ⅓',
    4: '¼ + ¼ + ¼ + ¼',
};

export function GrupoSlotModal({ isOpen, editingGrupo, onClose, onSaved, availableGrupos = [] }: GrupoSlotModalProps) {
    const [nome, setNome] = useState(editingGrupo?.nome || '');
    const [descricao, setDescricao] = useState(editingGrupo?.descricao || '');
    const [tipo, setTipo] = useState<TipoGrupo>(editingGrupo?.tipo || 'fracionado');
    const [qtdSlots, setQtdSlots] = useState<number>(editingGrupo?.qtd_slots ?? 2);
    const [regraPreco, setRegraPreco] = useState<RegraPreco>(editingGrupo?.regra_preco || 'mais_caro');
    const [minSlots, setMinSlots] = useState<number>(editingGrupo?.min_slots ?? 1);
    const [maxSlots, setMaxSlots] = useState<number>(editingGrupo?.max_slots ?? 2);
    const [modoPreco, setModoPreco] = useState<ModoPreco>(editingGrupo?.modo_preco || 'por_item');
    const [precoFixo, setPrecoFixo] = useState<number>(editingGrupo?.preco_fixo ?? 0);
    const [completamentos, setCompletamentos] = useState<number[]>(editingGrupo?.completamentos_ids || []);
    const [categoriaId, setCategoriaId] = useState<number | string | null>(null);
    const [categories, setCategories] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);

    // Carregar categorias
    useEffect(() => {
        if (isOpen) {
            getCategories().then(setCategories).catch(console.error);
        }
    }, [isOpen]);

    // Sync form when editingGrupo changes
    React.useEffect(() => {
        setNome(editingGrupo?.nome || '');
        setDescricao(editingGrupo?.descricao || '');
        setTipo(editingGrupo?.tipo || 'fracionado');
        setQtdSlots(editingGrupo?.qtd_slots ?? 2);
        setRegraPreco(editingGrupo?.regra_preco || 'mais_caro');
        setMinSlots(editingGrupo?.min_slots ?? 1);
        setMaxSlots(editingGrupo?.max_slots ?? (editingGrupo?.qtd_slots ?? 2));
        setModoPreco(editingGrupo?.modo_preco || 'por_item');
        setPrecoFixo(Number(editingGrupo?.preco_fixo) || 0);
        setCompletamentos(Array.isArray(editingGrupo?.completamentos_ids) ? editingGrupo.completamentos_ids : []);
        
        // Garantir que categoria_id seja tratado como string ou number para o select
        const catId = editingGrupo?.categoria_id;
        setCategoriaId(catId ? String(catId) : null);
    }, [editingGrupo]);

    // Quando qtdSlots mudar, ajusta max_slots para não ultrapassar
    const handleQtdSlotsChange = (val: number) => {
        setQtdSlots(val);
        if (maxSlots > val) setMaxSlots(val);
        if (minSlots > val) setMinSlots(val);
    };

    const handleSave = async () => {
        if (!nome.trim()) {
            toast.error('O nome do grupo é obrigatório.');
            return;
        }
        try {
            setSaving(true);
            const saved = await upsertGrupoSlot({
                ...(editingGrupo?.id ? { id: editingGrupo.id } : {}),
                nome: nome.trim(),
                descricao: descricao.trim() || undefined,
                tipo,
                qtd_slots: qtdSlots,
                regra_preco: regraPreco,
                min_slots: minSlots,
                max_slots: maxSlots,
                modo_preco: modoPreco,
                preco_fixo: modoPreco === 'fixo' ? precoFixo : 0,
                completamentos_ids: completamentos,
                categoria_id: categoriaId,
            });
            toast.success(editingGrupo?.id ? 'Grupo atualizado!' : 'Grupo criado!');
            onSaved(saved as GrupoSlot);
        } catch (e: any) {
            toast.error(e.message || 'Erro ao salvar grupo');
        } finally {
            setSaving(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-slate-900/50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <motion.div
                        className="relative bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-xl overflow-y-auto max-h-[90vh] border border-slate-200 dark:border-slate-700"
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6 ">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-200">
                                {editingGrupo?.id ? 'Editar Grupo' : 'Novo Grupo de Opcionais'}
                            </h2>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-400 dark:text-zinc-200 hover:text-slate-600 transition-colors dark:bg-slate-800 dark:border-slate-700 dark:hover:text-slate-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-5">
                            {/* Nome */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-zinc-200">Nome do Grupo</label>
                                <input
                                    type="text"
                                    value={nome}
                                    onChange={e => setNome(e.target.value)}
                                    placeholder="Ex: Sabores, Bordas, Adicionais..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors dark:bg-slate-900/75 dark:text-zinc-200 dark:border-slate-700"
                                />
                            </div>

                            {/* Categoria */}
                            {tipo === 'fracionado' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-zinc-200">Categoria no Cardápio</label>
                                    <div className="relative">
                                        <select
                                            value={categoriaId || ''}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setCategoriaId(val === '' ? null : val);
                                            }}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors dark:bg-slate-900/75 dark:text-zinc-200 dark:border-slate-700 appearance-none"
                                        >
                                            <option value="">Nenhuma (Ficará em "Monte seu Pedido")</option>
                                            {categories.map(cat => (
                                                <option key={String(cat.id)} value={String(cat.id)}>{cat.nome}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                            )}

                            {/* Descrição */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-zinc-200">Descrição (opcional)</label>
                                <input
                                    type="text"
                                    value={descricao}
                                    onChange={e => setDescricao(e.target.value)}
                                    placeholder="Ex: Escolha os sabores da sua pizza"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors dark:bg-slate-900/75 dark:text-zinc-200 dark:border-slate-700"
                                />
                            </div>

                            {/* Tipo */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2 dark:text-zinc-200">Tipo de Grupo</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {(['fracionado', 'adicional'] as TipoGrupo[]).map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setTipo(t)}
                                            className={cn(
                                                'py-3 px-4 rounded-xl border text-sm font-medium transition-all',
                                                tipo === t
                                                    ? 'border-primary bg-primary/10 text-primary dark:bg-primary/10 dark:text-blue-400'
                                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:hover:border-slate-800 dark:bg-slate-900/75 dark:text-zinc-200 dark:border-slate-700'
                                            )}
                                        >
                                            {t === 'fracionado' ? '🍕 Fracionado' : '➕ Adicional'}
                                            <p className="text-xs font-normal text-slate-500 mt-0.5">
                                                {t === 'fracionado' ? 'Divide o produto (ex: meio-a-meio)' : 'Acrescenta ao pedido'}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Quantidade de Slots (só para fracionado) */}
                            {tipo === 'fracionado' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2 dark:text-zinc-200">Divisão do Produto</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {SLOT_OPTIONS.map(n => (
                                            <button
                                                key={n}
                                                onClick={() => handleQtdSlotsChange(n)}
                                                className={cn(
                                                    'py-3 rounded-xl border text-center transition-all',
                                                    qtdSlots === n
                                                        ? 'border-primary bg-primary/10 text-primary dark:bg-primary/10 dark:text-blue-400'
                                                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:hover:border-slate-800 dark:bg-slate-900/75 dark:text-zinc-200 dark:border-slate-700'
                                                )}
                                            >
                                                <div className="text-lg font-bold">{n}</div>
                                                <div className="text-xs text-slate-500">{SLOT_LABELS[n]}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Regra de Preço */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2 dark:text-zinc-200">Regra de Precificação</label>
                                <div className="space-y-2">
                                    {([
                                        { value: 'mais_caro', label: 'Cobrar pelo mais caro', desc: 'Preço do sabor mais caro da seleção' },
                                        { value: 'media', label: 'Média dos preços', desc: 'Soma de todos ÷ quantidade de slots' },
                                        { value: 'soma', label: 'Soma total', desc: 'Cobra a soma de todos os sabores' },
                                    ] as { value: RegraPreco; label: string; desc: string }[]).map(r => (
                                        <button
                                            key={r.value}
                                            onClick={() => setRegraPreco(r.value)}
                                            disabled={modoPreco === 'fixo'}
                                            className={cn(
                                                'w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all',
                                                regraPreco === r.value
                                                    ? 'border-primary bg-primary/10 text-primary dark:bg-primary/10 dark:text-blue-400'
                                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:hover:border-slate-800 dark:bg-slate-900/75 dark:text-zinc-200 dark:border-slate-700',
                                                modoPreco === 'fixo' && 'opacity-50 cursor-not-allowed'
                                            )}
                                        >
                                            <div className={cn(
                                                'mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0',
                                                regraPreco === r.value ? 'border-primary bg-primary dark:border-blue-400 dark:bg-blue-400' : 'border-slate-300 dark:border-slate-700'
                                            )} />
                                            <div>
                                                <div className="text-sm font-medium text-slate-900 dark:text-zinc-200">{r.label}</div>
                                                <div className="text-xs text-slate-500 dark:text-zinc-200">{r.desc}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Modo de Preço */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2 dark:text-zinc-200">Tipo de Preço</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {([
                                        { value: 'por_item', label: 'Por Item', desc: 'Usa o preço de cada item selecionado' },
                                        { value: 'fixo', label: 'Preço Fixo', desc: 'Define um preço único para o grupo' },
                                    ] as { value: ModoPreco; label: string; desc: string }[]).map(m => (
                                        <button
                                            key={m.value}
                                            onClick={() => setModoPreco(m.value)}
                                            className={cn(
                                                'py-3 px-4 rounded-xl border text-sm font-medium transition-all text-left',
                                                modoPreco === m.value
                                                    ? 'border-primary bg-primary/10 text-primary dark:bg-primary/10 dark:text-blue-400'
                                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:hover:border-slate-800 dark:bg-slate-900/75 dark:text-zinc-200 dark:border-slate-700'
                                            )}
                                        >
                                            <div className="font-medium">{m.label}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">{m.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Preço Fixo (só quando modo = fixo) */}
                            {modoPreco === 'fixo' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-zinc-200">Preço Fixo</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">R$</span>
                                        <input
                                            type="number"
                                            min={0}
                                            step={0.01}
                                            value={precoFixo}
                                            onChange={e => setPrecoFixo(Number(e.target.value) || 0)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2.5 text-slate-900 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors dark:bg-slate-900/75 dark:text-zinc-200 dark:border-slate-700"
                                            placeholder="0,00"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Min / Max de seleção */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-zinc-200">Mínimo de escolhas</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={tipo === 'fracionado' ? qtdSlots : 99}
                                        value={minSlots}
                                        onChange={e => setMinSlots(Math.max(0, Number(e.target.value)))}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors dark:bg-slate-900/75 dark:text-zinc-200 dark:border-slate-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-zinc-200">Máximo de escolhas</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={tipo === 'fracionado' ? qtdSlots : 99}
                                        value={maxSlots}
                                        onChange={e => setMaxSlots(Math.max(1, Number(e.target.value)))}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors dark:bg-slate-900/75 dark:text-zinc-200 dark:border-slate-700"
                                    />
                                </div>
                            </div>

                            {/* Completamentos */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2 dark:text-zinc-200">Completamentos</label>
                                <p className="text-xs text-slate-500 mb-3 dark:text-zinc-200">Grupos que serão sugeridos após a seleção deste grupo</p>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {availableGrupos.filter(g => g.id !== editingGrupo?.id).length === 0 ? (
                                        <p className="text-sm text-slate-400 italic">Nenhum outro grupo disponível</p>
                                    ) : (
                                        availableGrupos.filter(g => g.id !== editingGrupo?.id).map(grupo => (
                                            <label
                                                key={grupo.id}
                                                className={cn(
                                                    'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                                                    completamentos.includes(Number(grupo.id))
                                                        ? 'border-primary bg-primary/10 dark:bg-primary/10'
                                                        : 'border-slate-200 bg-slate-50 hover:border-slate-300 dark:bg-slate-900/75 dark:border-slate-700'
                                                )}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={completamentos.includes(Number(grupo.id))}
                                                    onChange={e => {
                                                        const id = Number(grupo.id);
                                                        if (e.target.checked) {
                                                            setCompletamentos([...completamentos, id]);
                                                        } else {
                                                            setCompletamentos(completamentos.filter(c => c !== id));
                                                        }
                                                    }}
                                                    className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
                                                />
                                                <div>
                                                    <div className="text-sm font-medium text-slate-900 dark:text-zinc-200">{grupo.nome}</div>
                                                    <div className="text-xs text-slate-500">{grupo.tipo === 'fracionado' ? 'Fracionado' : 'Adicional'}</div>
                                                </div>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200">
                            <button
                                onClick={onClose}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors text-sm font-medium dark:hover:border-slate-800 dark:bg-slate-900/75 dark:text-zinc-200 dark:border-slate-700"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Salvando...
                                    </>
                                ) : (editingGrupo?.id ? 'Salvar Alterações' : 'Criar Grupo')}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
