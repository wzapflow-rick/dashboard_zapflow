'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Printer, Check } from 'lucide-react';

interface PrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: any;
    onConfirm: () => void;
}

export default function PrintModal({ isOpen, onClose, order, onConfirm }: PrintModalProps) {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
                >
                    <div className="p-6 text-center space-y-4">
                        <div className="size-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
                            <Printer className="size-8" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900">Confirmar Impressão?</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                Deseja imprimir o cupom do pedido <span className="font-bold text-slate-900">{order?.id}</span>?
                            </p>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all"
                            >
                                Não
                            </button>
                            <button
                                onClick={onConfirm}
                                className="flex-1 px-4 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                            >
                                <Check className="size-4" />
                                Sim, Imprimir
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
