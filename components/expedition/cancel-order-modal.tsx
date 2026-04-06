'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Ban, AlertTriangle } from 'lucide-react';

interface CancelOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (motivo: string) => void;
    orderId: number;
}

const cancelReasons = [
    'Cliente solicitou',
    'Falta de ingredientes',
    'Pagamento não identificado',
    'Pedido duplicado',
    'Problema com endereço',
    'Outro motivo'
];

export default function CancelOrderModal({ isOpen, onClose, onConfirm, orderId }: CancelOrderModalProps) {
    const [selectedReason, setSelectedReason] = useState<string>('');
    const [customReason, setCustomReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        const motivo = selectedReason === 'Outro motivo' ? customReason : selectedReason;
        if (!motivo) return;

        setIsSubmitting(true);
        await onConfirm(motivo);
        setIsSubmitting(false);
        setSelectedReason('');
        setCustomReason('');
    };

    const handleClose = () => {
        setSelectedReason('');
        setCustomReason('');
        onClose();
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={handleClose}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-red-50 dark:bg-red-900/20">
                        <div className="flex items-center gap-3">
                            <div className="size-10 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center">
                                <Ban className="size-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">Cancelar Pedido</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">#{orderId}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            <X className="size-5 text-slate-500 dark:text-slate-400" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-4">
                        <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                            <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                                O cliente será notificado sobre o cancelamento via WhatsApp.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                Selecione o motivo:
                            </label>
                            <div className="space-y-2">
                                {cancelReasons.map((reason) => (
                                    <button
                                        key={reason}
                                        onClick={() => setSelectedReason(reason)}
                                        className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                                            selectedReason === reason
                                                ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                                                : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                                        }`}
                                    >
                                        {reason}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {selectedReason === 'Outro motivo' && (
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                    Descreva o motivo:
                                </label>
                                <textarea
                                    value={customReason}
                                    onChange={(e) => setCustomReason(e.target.value)}
                                    placeholder="Digite o motivo do cancelamento..."
                                    className="w-full h-24 px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500/20 dark:text-white resize-none"
                                />
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
                        <button
                            onClick={handleClose}
                            className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                        >
                            Voltar
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!selectedReason || (selectedReason === 'Outro motivo' && !customReason) || isSubmitting}
                            className="flex-1 px-4 py-2.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? 'Cancelando...' : 'Confirmar Cancelamento'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
