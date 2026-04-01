'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { upsertGrupoSlot, type GrupoSlot, type TipoGrupo, type RegraPreco } from '@/app/actions/grupos-slots';
import { motion, AnimatePresence } from 'motion/react';

interface GrupoSlotModalProps {
    isOpen: boolean;
    editingGrupo: Partial<GrupoSlot> | null;
    onClose: () => void;
    onSaved: (grupo: GrupoSlot) => void;
}

const SLOT_OPTIONS = [1, 2, 3, 4];

const SLOT_LABELS: Record<number, string> = {
    1: 'Inteiro',
    2: '½ + ½',
    3: '⅓ + ⅓ + ⅓',
    4: '¼ + ¼ + ¼ + ¼',
};

export function GrupoSlotModal({ isOpen, editingGrupo, onClose, onSaved }: GrupoSlotModalProps) {
    const [nome, setNome] = useState(editingGrupo?.nome || '');
    const [descricao, setDescricao] = useState(editingGrupo?.descricao || '');
    const [tipo, setTipo] = useState<TipoGrupo>(editingGrupo?.tipo || 'fracionado');
    const [qtdSlots, setQtdSlots] = useState<number>(editingGrupo?.qtd_slots ?? 2);
    const [regraPreco, setRegraPreco] = useState<RegraPreco>(editingGrupo?.regra_preco || 'mais_caro');
    const [minSlots, setMinSlots] = useState<number>(editingGrupo?.min_slots ?? 1);
    const [maxSlots, setMaxSlots] = useState<number>(editingGrupo?.max_slots ?? 2);
    const [saving, setSaving] = useState(false);

    // Sync form when editingGrupo changes
    React.useEffect(() => {
        setNome(editingGrupo?.nome || '');
        setDescricao(editingGrupo?.descricao || '');
        setTipo(editingGrupo?.tipo || 'fracionado');
        setQtdSlots(editingGrupo?.qtd_slots ?? 2);
        setRegraPreco(editingGrupo?.regra_preco || 'mais_caro');
        setMinSlots(editingGrupo?.min_slots ?? 1);
        setMaxSlots(editingGrupo?.max_slots ?? (editingGrupo?.qtd_slots ?? 2));
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
                        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <motion.div
                        className="relative bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl overflow-y-auto max-h-[90vh]"
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-slate-900">
                                {editingGrupo?.id ? 'Editar Grupo' : 'Novo Grupo de Opcionais'}
                            </h2>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-5">
                            {/* Nome */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome do Grupo</label>
                                <input
                                    type="text"
                                    value={nome}
                                    onChange={e => setNome(e.target.value)}
                                    placeholder="Ex: Sabores, Bordas, Adicionais..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                                />
                            </div>

                            {/* Descrição */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Descrição (opcional)</label>
                                <input
                                    type="text"
                                    value={descricao}
                                    onChange={e => setDescricao(e.target.value)}
                                    placeholder="Ex: Escolha os sabores da sua pizza"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                                />
                            </div>

                            {/* Tipo */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Grupo</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {(['fracionado', 'adicional'] as TipoGrupo[]).map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setTipo(t)}
                                            className={cn(
                                                'py-3 px-4 rounded-xl border text-sm font-medium transition-all',
                                                tipo === t
                                                    ? 'border-primary bg-primary/10 text-primary'
                                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
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
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Divisão do Produto</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {SLOT_OPTIONS.map(n => (
                                            <button
                                                key={n}
                                                onClick={() => handleQtdSlotsChange(n)}
                                                className={cn(
                                                    'py-3 rounded-xl border text-center transition-all',
                                                    qtdSlots === n
                                                        ? 'border-primary bg-primary/10 text-primary'
                                                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
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
                                <label className="block text-sm font-medium text-slate-700 mb-2">Regra de Precificação</label>
                                <div className="space-y-2">
                                    {([
                                        { value: 'mais_caro', label: 'Cobrar pelo mais caro', desc: 'Preço do sabor mais caro da seleção' },
                                        { value: 'media', label: 'Média dos preços', desc: 'Soma de todos ÷ quantidade de slots' },
                                        { value: 'soma', label: 'Soma total', desc: 'Cobra a soma de todos os sabores' },
                                    ] as { value: RegraPreco; label: string; desc: string }[]).map(r => (
                                        <button
                                            key={r.value}
                                            onClick={() => setRegraPreco(r.value)}
                                            className={cn(
                                                'w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all',
                                                regraPreco === r.value
                                                    ? 'border-primary bg-primary/10 text-primary'
                                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                                            )}
                                        >
                                            <div className={cn(
                                                'mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0',
                                                regraPreco === r.value ? 'border-primary bg-primary' : 'border-slate-300'
                                            )} />
                                            <div>
                                                <div className="text-sm font-medium text-slate-900">{r.label}</div>
                                                <div className="text-xs text-slate-500">{r.desc}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Min / Max de seleção */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Mínimo de escolhas</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={tipo === 'fracionado' ? qtdSlots : 99}
                                        value={minSlots}
                                        onChange={e => setMinSlots(Math.max(0, Number(e.target.value)))}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Máximo de escolhas</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={tipo === 'fracionado' ? qtdSlots : 99}
                                        value={maxSlots}
                                        onChange={e => setMaxSlots(Math.max(1, Number(e.target.value)))}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200">
                            <button
                                onClick={onClose}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors text-sm font-medium"
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
