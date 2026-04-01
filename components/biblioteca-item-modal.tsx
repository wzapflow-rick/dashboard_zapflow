'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { X, ChefHat, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { upsertItemBase, type ItemBase, getReceitaDoItemBase, saveReceitaDoItemBase } from '@/app/actions/itens-base';
import { getInsumos, type Insumo } from '@/app/actions/insumos';

interface BibliotecaItemModalProps {
    isOpen: boolean;
    editingItem: Partial<ItemBase> | null;
    onClose: () => void;
    onSaved: (item: ItemBase) => void;
}

// --- Utilitários de formatação de moeda (R$ xx,xx) ---
function formatCurrency(value: string): string {
    // Remove tudo que não for dígito
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    // Divide por 100 para ter centavos
    const number = parseInt(digits, 10) / 100;
    return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseCurrency(formatted: string): number {
    // "59,90" -> 59.90
    const clean = formatted.replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
}

function useCurrencyInput(initial?: number) {
    const initFormatted = initial != null && initial > 0
        ? initial.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '';
    const [display, setDisplay] = useState<string>(initFormatted);

    const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setDisplay(formatCurrency(e.target.value));
    }, []);

    const reset = useCallback((val?: number) => {
        setDisplay(val != null && val > 0
            ? val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '');
    }, []);

    return { display, onChange, reset, value: parseCurrency(display) };
}
// -----------------------------------------------------

export function BibliotecaItemModal({ isOpen, editingItem, onClose, onSaved }: BibliotecaItemModalProps) {
    const [nome, setNome] = useState(editingItem?.nome || '');
    // const [descricao, setDescricao] = useState(editingItem?.descricao || '');
    const [saving, setSaving] = useState(false);
    const [insumosDisponiveis, setInsumosDisponiveis] = useState<Insumo[]>([]);
    const [receita, setReceita] = useState<{ insumo: number; quantidade: number }[]>([]);
    const [loadingInsumos, setLoadingInsumos] = useState(false);

    const precoSugerido = useCurrencyInput(editingItem?.preco_sugerido);
    const precoCusto = useCurrencyInput(editingItem?.preco_custo);

    React.useEffect(() => {
        setNome(editingItem?.nome || '');
        // setDescricao(editingItem?.descricao || '');
        precoSugerido.reset(editingItem?.preco_sugerido);
        precoCusto.reset(editingItem?.preco_custo);
        // Carregar insumos quando abrir o modal
        if (isOpen) {
            fetchInsumos();
            if (editingItem?.id) {
                fetchReceita(editingItem.id);
            } else {
                setReceita([]);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingItem, isOpen]);

    const fetchInsumos = async () => {
        setLoadingInsumos(true);
        try {
            const data = await getInsumos();
            setInsumosDisponiveis(data);
        } catch (error) {
            toast.error('Erro ao carregar insumos');
        } finally {
            setLoadingInsumos(false);
        }
    };

    const fetchReceita = async (itemId: number) => {
        try {
            const data = await getReceitaDoItemBase(itemId);
            setReceita(data.map((r: any) => ({
                insumo: r.insumo,
                quantidade: r.quantidade,
            })));
        } catch (error) {
            toast.error('Erro ao carregar receita do sabor');
        }
    };

    const adicionarInsumo = (insumoId: number) => {
        if (!insumoId) return;
        const jaExiste = receita.find(r => r.insumo === insumoId);
        if (jaExiste) {
            toast.warning('Insumo já adicionado.');
            return;
        }
        setReceita(prev => [...prev, { insumo: insumoId, quantidade: 1 }]);
    };

    const removerInsumo = (insumoId: number) => {
        setReceita(prev => prev.filter(r => r.insumo !== insumoId));
    };

    const atualizarQuantidade = (insumoId: number, quantidade: number) => {
        setReceita(prev => prev.map(r => 
            r.insumo === insumoId ? { ...r, quantidade } : r
        ));
    };

    const handleSave = async () => {
        if (!nome.trim()) {
            toast.error('O nome do sabor é obrigatório.');
            return;
        }
        if (precoSugerido.value <= 0) {
            toast.error('Preço sugerido deve ser maior que zero.');
            return;
        }
        try {
            setSaving(true);
            const saved = await upsertItemBase({
                ...(editingItem?.id ? { id: editingItem.id } : {}),
                nome: nome.trim(),
                // descricao: descricao.trim() || undefined,
                preco_sugerido: precoSugerido.value,
                preco_custo: precoCusto.value > 0 ? precoCusto.value : undefined,
            });
            toast.success(editingItem?.id ? 'Sabor atualizado!' : 'Sabor criado na biblioteca!');
            // Salvar receita do sabor
            if (saved.id) {
                await saveReceitaDoItemBase(Number(saved.id), receita);
            }
            onSaved(saved as ItemBase);
        } catch (e: any) {
            toast.error(e.message || 'Erro ao salvar sabor');
        } finally {
            setSaving(false);
        }
    };

    const inputClass =
        'w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors';

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
                        className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-xl"
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <ChefHat className="w-5 h-5 text-primary" />
                                </div>
                                <h2 className="text-lg font-semibold text-slate-900">
                                    {editingItem?.id ? 'Editar Sabor' : 'Novo Sabor na Biblioteca'}
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Nome */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome do Sabor *</label>
                                <input
                                    type="text"
                                    value={nome}
                                    onChange={e => setNome(e.target.value)}
                                    placeholder="Ex: Calabresa, Frango, Açaí Tradicional..."
                                    className={inputClass}
                                />
                            </div>

                            {/* Preços com formatação automática */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Preço Sugerido *</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium pointer-events-none">R$</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={precoSugerido.display}
                                            onChange={precoSugerido.onChange}
                                            placeholder="0,00"
                                            className={`${inputClass} pl-9`}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Preço de Custo</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium pointer-events-none">R$</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={precoCusto.display}
                                            onChange={precoCusto.onChange}
                                            placeholder="0,00"
                                            className={`${inputClass} pl-9`}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Insumos do sabor */}
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Insumos (Ficha Técnica)</label>
                                {loadingInsumos ? (
                                    <div className="text-sm text-slate-500">Carregando insumos...</div>
                                ) : (
                                    <>
                                        <div className="flex gap-2">
                                            <select
                                                id="select-insumo"
                                                className={`${inputClass} flex-1`}
                                                defaultValue=""
                                            >
                                                <option value="">Selecione um insumo</option>
                                                {insumosDisponiveis.map(insumo => (
                                                    <option key={insumo.id} value={insumo.id}>
                                                        {insumo.nome}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const select = document.getElementById('select-insumo') as HTMLSelectElement;
                                                    const value = Number(select.value);
                                                    if (value) {
                                                        adicionarInsumo(value);
                                                        select.value = '';
                                                    }
                                                }}
                                                className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                        {receita.length > 0 && (
                                            <div className="space-y-2">
                                                {receita.map(item => {
                                                    const insumo = insumosDisponiveis.find(i => i.id === item.insumo);
                                                    return (
                                                        <div key={item.insumo} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                                                            <span className="flex-1 text-sm text-slate-700">
                                                                {insumo?.nome || `Insumo #${item.insumo}`}
                                                            </span>
                                                            <input
                                                                type="number"
                                                                min="0.001"
                                                                step="0.001"
                                                                value={item.quantidade}
                                                                onChange={e => atualizarQuantidade(item.insumo, Number(e.target.value))}
                                                                className="w-20 text-sm border border-slate-200 rounded px-2 py-1"
                                                            />
                                                            <span className="text-xs text-slate-500 w-12">
                                                                {insumo?.unidade_medida || 'un'}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => removerInsumo(item.insumo)}
                                                                className="p-1 hover:bg-red-100 rounded text-red-500"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            <p className="text-xs text-slate-500">
                                💡 Este sabor fica na Biblioteca e pode ser adicionado a qualquer grupo sem recadastrar.
                            </p>
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
                                className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? 'Salvando...' : (editingItem?.id ? 'Salvar' : 'Criar Sabor')}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
