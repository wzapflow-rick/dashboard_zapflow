'use client';

import React, { useRef, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Printer, X, ChevronLeft, Smartphone } from 'lucide-react';
import { printThermal, getReceiptCss, getLarguraPadrao, setLarguraPadrao, type LarguraPapel } from '@/lib/thermal-print';
import { printViaRawBT, isIOS, type ReciboDados } from '@/lib/rawbt-print';

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
            bodyHtml: `<div class="zf-receipt">${printContent.innerHTML}</div>`,
            largura,
        });
    };

    // Impressão pelo celular via app RawBT (Android) ligado à térmica por rede/cabo/Bluetooth.
    // NÃO bloqueamos por Android: com "Site para computador" ligado o Chrome esconde
    // o "Android" do userAgent. Só bloqueamos no iPhone/iPad, onde o RawBT não existe.
    const handlePrintMobile = () => {
        if (isIOS()) {
            alert('A impressão pelo celular usa o app RawBT, que só existe no Android. No iPhone/iPad, use uma impressora Wi-Fi.');
            return;
        }
        const dados: ReciboDados = {
            empresaNome: order?.empresa_nome || order?.nome_empresa || 'PEDIDO',
            pedidoId: order?.id,
            isDelivery: !!isDelivery,
            clienteNome: order?.nome_cliente || order?.cliente_nome || 'Cliente',
            clienteTelefone: order?.telefone_cliente || '-',
            endereco: order?.endereco_entrega,
            bairro: order?.bairro_entrega,
            itens: formattedItems,
            observacoes: order?.observacoes,
            subtotal: order?.valor_total || order?.total || 0,
            taxaEntrega: order?.taxa_entrega || 0,
            desconto: order?.desconto || 0,
            total: order?.valor_total || order?.total || 0,
            formaPagamento: order?.forma_pagamento,
            troco: order?.troco,
        };
        printViaRawBT(dados, largura);
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
                    <div className="p-4 flex justify-center bg-slate-100 dark:bg-slate-900/50">
                        <div
                            ref={printRef}
                            className="zf-receipt bg-white shadow-lg"
                            style={{ width: largura === '58mm' ? '240px' : '300px', padding: '10px 12px' }}
                        >
                            <style dangerouslySetInnerHTML={{ __html: getReceiptCss(largura) }} />

                            {/* Cabeçalho da loja (bloco invertido) */}
                            <div className="zf-brand">
                                <div className="zf-name">{(order?.empresa_nome || order?.nome_empresa || 'PEDIDO').toUpperCase()}</div>
                                <div className="zf-sub">{new Date().toLocaleString('pt-BR')}</div>
                            </div>

                            {/* Badge de tipo */}
                            <div className="zf-badge-wrap">
                                <span className="zf-badge">{isDelivery ? 'DELIVERY' : 'RETIRADA'}</span>
                            </div>

                            {/* Número do pedido em destaque */}
                            <div className="zf-bignum-label">PEDIDO</div>
                            <div className="zf-bignum">#{order?.id}</div>

                            <hr className="zf-dash" />

                            {/* Dados do cliente */}
                            <div className="zf-section">Cliente</div>
                            <div className="zf-meta"><b>Nome:</b> {order?.nome_cliente || order?.cliente_nome || 'Cliente'}</div>
                            <div className="zf-meta"><b>Tel:</b> {order?.telefone_cliente || '-'}</div>
                            {isDelivery ? (
                                <div className="zf-meta"><b>End:</b> {order?.endereco_entrega}{order?.bairro_entrega ? ` - ${order.bairro_entrega}` : ''}</div>
                            ) : (
                                <div className="zf-meta"><b>Retirada no balcão</b></div>
                            )}

                            <hr className="zf-dash" />

                            {/* Itens */}
                            <div className="zf-section">Itens</div>
                            <div className="zf-ihead">
                                <span className="zf-q">Qtd</span>
                                <span className="zf-nm">Itens</span>
                                <span className="zf-pr">Preço</span>
                            </div>
                            {formattedItems.map((item: any, idx: number) => (
                                <div key={idx}>
                                    <div className="zf-li">
                                        <span className="zf-q">{item.qtd}x</span>
                                        <span className="zf-nm">{item.nome}</span>
                                        <span className="zf-pr">{formatPrice(item.preco * item.qtd)}</span>
                                    </div>
                                    {item.observacao && (
                                        <div className="zf-obs">&gt; {item.observacao}</div>
                                    )}
                                </div>
                            ))}

                            {order?.observacoes && (
                                <>
                                    <hr className="zf-dash" />
                                    <div className="zf-section">Observações</div>
                                    <div className="zf-meta">{order.observacoes}</div>
                                </>
                            )}

                            <hr className="zf-dash" />

                            {/* Subtotais */}
                            <div className="zf-row">
                                <span>Subtotal</span>
                                <span>{formatPrice(order?.valor_total || order?.total || 0)}</span>
                            </div>
                            {order?.taxa_entrega > 0 && (
                                <div className="zf-row">
                                    <span>Entrega</span>
                                    <span>{formatPrice(order.taxa_entrega)}</span>
                                </div>
                            )}
                            {order?.desconto > 0 && (
                                <div className="zf-row">
                                    <span>Desconto</span>
                                    <span>-{formatPrice(order.desconto)}</span>
                                </div>
                            )}

                            {/* TOTAL em caixa invertida */}
                            <div className="zf-total">
                                <span>TOTAL</span>
                                <span>{formatPrice(order?.valor_total || order?.total || 0)}</span>
                            </div>

                            {/* Pagamento */}
                            <div className="zf-meta"><b>Pagamento:</b> {order?.forma_pagamento || 'Não informado'}</div>
                            {order?.forma_pagamento === 'dinheiro' && order?.troco && (
                                <div className="zf-meta"><b>Troco para:</b> {formatPrice(order.troco)}</div>
                            )}

                            {/* Rodapé */}
                            <div className="zf-foot">
                                <div className="zf-thanks">Obrigado pela preferência!</div>
                            </div>
                            <div className="zf-cut">- - - - - - - - - - - -</div>
                            <div className="zf-sign">powered by zapflow</div>
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
                        <button
                            onClick={handlePrintMobile}
                            className="w-full px-4 py-2.5 bg-slate-800 dark:bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-900 dark:hover:bg-slate-600 transition-all flex items-center justify-center gap-2"
                        >
                            <Smartphone className="size-4" />
                            Imprimir no celular (RawBT)
                        </button>
                        <p className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500 text-center">
                            No celular Android, instale o app <b>RawBT</b> (grátis na Play Store) e conecte a impressora térmica por cabo ou Bluetooth.
                        </p>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
