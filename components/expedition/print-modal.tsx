'use client';

import React, { useRef, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Printer, X, ChevronLeft } from 'lucide-react';
import { printThermal, getLarguraPadrao, setLarguraPadrao, type LarguraPapel } from '@/lib/thermal-print';

interface PrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: any;
}

const formatPrice = (value: number) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;

export default function PrintModal({ isOpen, onClose, order }: PrintModalProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const [largura, setLargura] = useState<LarguraPapel>('58mm');

    React.useEffect(() => {
        setLargura(getLarguraPadrao());
    }, []);

    if (!isOpen) return null;

    const handleLarguraChange = (l: LarguraPapel) => {
        setLargura(l);
        setLarguraPadrao(l);
    };

    const handlePrint = () => {
        const printContent = printRef.current;
        if (!printContent) return;
        printThermal({
            title: `Pedido #${order?.id}`,
            bodyHtml: printContent.innerHTML,
            largura,
        });
    };

    const formattedItems = useMemo(() => {
        let rawItens = order?.itens;
        if (typeof rawItens === 'string') {
            try {
                rawItens = JSON.parse(rawItens);
            } catch (e) {
                console.error('Erro ao processar itens do pedido:', e);
                rawItens = [];
            }
        }
        
        return Array.isArray(rawItens)
            ? rawItens.map((item: any) => ({
                nome: item.produto || item.nome || 'Item',
                qtd: item.quantidade || 1,
                preco: item.preco || 0,
                observacao: item.observacao || ''
            }))
            : [];
    }, [order?.itens]);

    const isDelivery = order?.tipo_entrega !== 'retirada' && order?.endereco_entrega;

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
                    className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            <ChevronLeft className="size-5 text-slate-600 dark:text-slate-300" />
                        </button>
                        <h3 className="font-bold text-slate-900 dark:text-white">Imprimir Ticket</h3>
                        <div className="w-9" />
                    </div>

                    {/* Ticket Preview */}
                    <div className="p-4">
	                        <div 
	                            ref={printRef}
	                            className="bg-white border-2 border-dashed border-slate-300 rounded-lg p-4 text-sm font-mono text-slate-900"
	                        >
	                            <div className="text-center mb-4">
	                                <h1 className="text-lg font-bold text-slate-900">PEDIDO #{order?.id}</h1>
	                                <p className="text-xs text-slate-600">{new Date().toLocaleString('pt-BR')}</p>
	                            </div>
	                            
	                            <div className="border-t border-b border-dashed border-slate-300 py-2 mb-2 text-slate-900">
	                                <p><strong className="text-slate-900">Cliente:</strong> {order?.nome_cliente || order?.cliente_nome || 'Cliente'}</p>
	                                <p><strong className="text-slate-900">Tel:</strong> {order?.telefone_cliente || '-'}</p>
	                                {isDelivery ? (
	                                    <p><strong className="text-slate-900">End:</strong> {order?.endereco_entrega} {order?.bairro_entrega && `- ${order.bairro_entrega}`}</p>
	                                ) : (
	                                    <p><strong className="text-slate-900">Retirada no balcão</strong></p>
	                                )}
	                            </div>

                            <div className="mb-2">
                                {formattedItems.map((item: any, idx: number) => (
                                    <div key={idx} className="py-1">
                                        <div className="flex justify-between">
                                            <span className="flex-1">{item.qtd}x {item.nome}</span>
                                            <span>{formatPrice(item.preco * item.qtd)}</span>
                                        </div>
                                        {item.observacao && (
                                            <p className="text-[10px] text-slate-600 ml-4 italic">OBS: {item.observacao}</p>
                                        )}
                                    </div>
                                ))}
                            </div>

	                            {order?.observacoes && (
	                                <div className="border-t border-dashed border-slate-300 py-2 my-2 text-slate-900">
	                                    <p className="text-xs"><strong className="text-slate-900">OBS:</strong> {order.observacoes}</p>
	                                </div>
	                            )}

	                            <div className="border-t border-dashed border-slate-300 py-2 mt-2 text-slate-900">
	                                <div className="flex justify-between">
	                                    <span>Subtotal:</span>
	                                    <span>{formatPrice(order?.valor_total || order?.total || 0)}</span>
	                                </div>
	                                {order?.taxa_entrega > 0 && (
	                                    <div className="flex justify-between">
	                                        <span>Entrega:</span>
	                                        <span>{formatPrice(order.taxa_entrega)}</span>
	                                    </div>
	                                )}
	                                {order?.desconto > 0 && (
	                                    <div className="flex justify-between text-green-700">
	                                        <span>Desconto:</span>
	                                        <span>-{formatPrice(order.desconto)}</span>
	                                    </div>
	                                )}
	                                <div className="total-line flex justify-between font-bold text-lg mt-1 text-slate-900">
	                                    <span>TOTAL:</span>
	                                    <span>{formatPrice(order?.valor_total || order?.total || 0)}</span>
	                                </div>
	                            </div>

	                            <div className="text-center mt-4 text-xs text-slate-600">
	                                <p>Pagamento: {order?.forma_pagamento || 'Não informado'}</p>
	                                {order?.forma_pagamento === 'dinheiro' && order?.troco && (
	                                    <p>Troco para: {formatPrice(order.troco)}</p>
	                                )}
	                                <p className="mt-2">Obrigado pela preferência!</p>
	                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">Largura do papel:</span>
                            {(['58mm', '80mm'] as const).map((l) => (
                                <button
                                    key={l}
                                    onClick={() => handleLarguraChange(l)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                        largura === l
                                            ? 'bg-primary text-white'
                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                    }`}
                                >
                                    {l}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handlePrint}
                                className="flex-1 px-4 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                            >
                                <Printer className="size-4" />
                                Imprimir
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
