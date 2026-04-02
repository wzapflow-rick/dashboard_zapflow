'use client';

import React from 'react';
import { AlertTriangle, X, ArrowRight, AlertCircle, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StockWarning {
    insumo_id: number;
    nome: string;
    necessario: number;
    disponivel: number;
    unidade: string;
}

interface StockWarningModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    shortages: StockWarning[];
    orderId: number;
    cliente: {
        nome: string;
        telefone: string;
    } | null;
}

export default function StockWarningModal({ isOpen, onClose, onConfirm, shortages, orderId, cliente }: StockWarningModalProps) {
    if (!isOpen) return null;

    const handleWhatsApp = () => {
        if (!cliente?.telefone) return;

        const nomesFaltantes = shortages.map(s => s.nome).join(', ');
        const mensagem = `Olá ${cliente.nome || ''}! Aqui é da pizzaria. Notei que alguns ingredientes para o seu pedido #${orderId} estão em falta no momento (${nomesFaltantes}). Gostaria de trocar por outro sabor ou prefere cancelar?`;

        const phone = cliente.telefone.replace(/\D/g, '');
        const cleanPhone = phone.startsWith('55') ? phone : `55${phone}`;

        const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(mensagem)}`;
        window.open(url, '_blank');
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700"
                >
                    <div className="p-6 text-center space-y-4">
                        <div className="size-16 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 mx-auto">
                            <AlertTriangle className="size-8" />
                        </div>

                        <div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">Estoque Insuficiente!</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
                                O pedido #{orderId} requer insumos que não estão disponíveis no momento.
                            </p>
                        </div>

                        <button
                            onClick={handleWhatsApp}
                            disabled={!cliente?.telefone}
                            className={`w-full py-3 rounded-2xl border flex items-center justify-center gap-2 text-sm font-black transition-all uppercase tracking-wider ${cliente?.telefone
                                    ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                                    : "bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-600 cursor-not-allowed"
                                }`}
                        >
                            <MessageCircle className="size-5" />
                            {cliente?.telefone ? "Avisar Cliente no WhatsApp" : "Telefone não encontrado"}
                        </button>

                        <div className="bg-slate-50 dark:bg-slate-700 rounded-2xl border border-slate-100 dark:border-slate-600 divide-y divide-slate-200 dark:divide-slate-600 overflow-y-auto max-h-[200px] custom-scrollbar">
                            {shortages.map((s) => (
                                <div key={s.insumo_id} className="p-4 flex items-center justify-between text-left">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{s.nome}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-sm font-bold text-red-600 dark:text-red-400">{s.disponivel.toFixed(2)}{s.unidade}</span>
                                            <ArrowRight className="size-3 text-slate-300 dark:text-slate-500" />
                                            <span className="text-sm font-bold text-slate-900 dark:text-white">{s.necessario.toFixed(2)}{s.unidade}</span>
                                        </div>
                                    </div>
                                    <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter">
                                        Falta: {(s.necessario - s.disponivel).toFixed(2)}{s.unidade}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-2xl text-left">
                            <AlertCircle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed font-medium">
                                Você pode forçar o aceite do pedido, mas o estoque ficará **negativo**. Deseja continuar?
                            </p>
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 dark:bg-slate-700 border-t border-slate-100 dark:border-slate-600 flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-sm uppercase tracking-wider"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 text-sm uppercase tracking-wider"
                        >
                            Mover Mesmo Assim
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
