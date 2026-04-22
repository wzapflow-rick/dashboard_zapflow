'use client';

import React, { useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Printer, X, ChevronLeft } from 'lucide-react';

interface PrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: any;
}

const formatPrice = (value: number) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;

export default function PrintModal({ isOpen, onClose, order }: PrintModalProps) {
    const printRef = useRef<HTMLDivElement>(null);

    if (!isOpen) return null;

    const handlePrint = () => {
        const printContent = printRef.current;
        if (!printContent) return;

        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (!printWindow) {
            alert('Bloqueador de pop-ups impede a impressão. Permita pop-ups para este site.');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Pedido #${order?.id}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Courier New', monospace; 
                        padding: 10px;
                        font-size: 12px;
                        width: 58mm;
                    }
                    .header { text-align: center; margin-bottom: 10px; }
                    .header h1 { font-size: 16px; font-weight: bold; }
                    .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
                    .item { display: flex; justify-content: space-between; margin: 4px 0; }
                    .item-name { flex: 1; }
                    .item-qty { margin-right: 10px; }
                    .total { font-weight: bold; font-size: 14px; margin-top: 10px; }
                    .footer { text-align: center; margin-top: 15px; font-size: 10px; }
                    @media print {
                        body { width: 58mm !important; }
                    }
                </style>
            </head>
            <body>${printContent.innerHTML}</body>
            </html>
        `);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        }, 250);
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
                preco: item.preco || 0
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
                            className="bg-white border-2 border-dashed border-slate-300 rounded-lg p-4 text-sm font-mono"
                        >
                            <div className="text-center mb-4">
                                <h1 className="text-lg font-bold">PEDIDO #{order?.id}</h1>
                                <p className="text-xs">{new Date().toLocaleString('pt-BR')}</p>
                            </div>
                            
                            <div className="border-t border-b border-dashed border-slate-300 py-2 mb-2">
                                <p><strong>Cliente:</strong> {order?.nome_cliente || order?.cliente_nome || 'Cliente'}</p>
                                <p><strong>Tel:</strong> {order?.telefone_cliente || '-'}</p>
                                {isDelivery ? (
                                    <p><strong>End:</strong> {order?.endereco_entrega} {order?.bairro_entrega && `- ${order.bairro_entrega}`}</p>
                                ) : (
                                    <p><strong>Retirada no balcão</strong></p>
                                )}
                            </div>

                            <div className="mb-2">
                                {formattedItems.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between py-1">
                                        <span className="flex-1">{item.qtd}x {item.nome}</span>
                                        <span>{formatPrice(item.preco * item.qtd)}</span>
                                    </div>
                                ))}
                            </div>

                            {order?.observacoes && (
                                <div className="border-t border-dashed border-slate-300 py-2 my-2">
                                    <p className="text-xs"><strong>OBS:</strong> {order.observacoes}</p>
                                </div>
                            )}

                            <div className="border-t border-dashed border-slate-300 py-2 mt-2">
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
                                    <div className="flex justify-between text-green-600">
                                        <span>Desconto:</span>
                                        <span>-{formatPrice(order.desconto)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-bold text-lg mt-1">
                                    <span>TOTAL:</span>
                                    <span>{formatPrice(order?.valor_total || order?.total || 0)}</span>
                                </div>
                            </div>

                            <div className="text-center mt-4 text-xs">
                                <p>Pagamento: {order?.forma_pagamento || 'Não informado'}</p>
                                {order?.forma_pagamento === 'dinheiro' && order?.troco && (
                                    <p>Troco para: {formatPrice(order.troco)}</p>
                                )}
                                <p className="mt-2">Obrigado pela preferência!</p>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
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
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
