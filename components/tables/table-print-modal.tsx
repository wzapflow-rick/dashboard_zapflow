'use client';

import React, { useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Printer, X, ChevronLeft } from 'lucide-react';
import { type MesaComDetalhes, type ComandaComPedidos } from '@/app/actions/tables';

interface TablePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  mesa: MesaComDetalhes;
  comanda?: ComandaComPedidos; // Se passado, imprime apenas essa comanda
  tipo: 'mesa' | 'comanda';
}

const formatPrice = (value: number) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;

export default function TablePrintModal({ isOpen, onClose, mesa, comanda, tipo }: TablePrintModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Determinar quais comandas mostrar
  const comandasParaImprimir = tipo === 'comanda' && comanda 
    ? [comanda] 
    : mesa.comandas;

  // Extrair todos os itens de todas as comandas selecionadas
  const todosItens = useMemo(() => {
    return comandasParaImprimir.flatMap((cmd) => {
      return cmd.pedidos.flatMap((pedido: any) => {
        try {
          const itens = typeof pedido.itens === 'string' ? JSON.parse(pedido.itens) : pedido.itens;
          return Array.isArray(itens) ? itens.map((item: any) => ({
            ...item,
            comandaNome: cmd.nome_cliente || `Comanda ${cmd.id}`,
            pedidoId: pedido.id,
          })) : [];
        } catch {
          return [];
        }
      });
    });
  }, [comandasParaImprimir]);

  // Calcular total
  const totalGeral = comandasParaImprimir.reduce((acc, cmd) => {
    return acc + cmd.pedidos.reduce((sum, p: any) => sum + (Number(p.valor_total) || 0), 0);
  }, 0);

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
        <title>${tipo === 'mesa' ? `Mesa ${mesa.numero}` : `Comanda - ${comanda?.nome_cliente || comanda?.id}`}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Courier New', monospace; 
            padding: 10px;
            font-size: 12px;
            width: 80mm;
          }
          .header { text-align: center; margin-bottom: 10px; }
          .header h1 { font-size: 18px; font-weight: bold; }
          .header h2 { font-size: 14px; margin-top: 4px; }
          .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
          .section-title { font-weight: bold; font-size: 13px; margin: 10px 0 5px 0; }
          .item { display: flex; justify-content: space-between; margin: 3px 0; padding: 2px 0; }
          .item-name { flex: 1; }
          .item-qty { width: 30px; text-align: center; }
          .item-price { width: 70px; text-align: right; }
          .subtotal { display: flex; justify-content: space-between; font-weight: bold; margin-top: 5px; padding-top: 5px; border-top: 1px dashed #000; }
          .total { display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; margin-top: 10px; padding: 8px 0; border-top: 2px solid #000; border-bottom: 2px solid #000; }
          .footer { text-align: center; margin-top: 15px; font-size: 10px; }
          @media print {
            body { width: 80mm !important; }
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
          className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="size-5 text-slate-600 dark:text-slate-300" />
            </button>
            <h3 className="font-bold text-slate-900 dark:text-white">
              {tipo === 'mesa' ? 'Conta da Mesa' : 'Conta Individual'}
            </h3>
            <div className="w-9" />
          </div>

          {/* Ticket Preview */}
          <div className="p-4 overflow-y-auto flex-1">
            <div 
              ref={printRef}
              className="bg-white border-2 border-dashed border-slate-300 rounded-lg p-4 text-sm font-mono text-slate-900"
            >
              {/* Cabeçalho */}
              <div className="text-center mb-4">
                <h1 className="text-lg font-bold text-slate-900">
                  MESA {mesa.numero}
                </h1>
                {mesa.nome && (
                  <p className="text-sm text-slate-600">{mesa.nome}</p>
                )}
                <p className="text-xs text-slate-600 mt-1">{new Date().toLocaleString('pt-BR')}</p>
              </div>

              <div className="border-t border-dashed border-slate-300 my-2" />

              {/* Itens por Comanda */}
              {comandasParaImprimir.map((cmd) => {
                const itensComanda = cmd.pedidos.flatMap((pedido: any) => {
                  try {
                    const itens = typeof pedido.itens === 'string' ? JSON.parse(pedido.itens) : pedido.itens;
                    return Array.isArray(itens) ? itens : [];
                  } catch {
                    return [];
                  }
                });

                const totalComanda = cmd.pedidos.reduce(
                  (sum, p: any) => sum + (Number(p.valor_total) || 0), 0
                );

                return (
                  <div key={cmd.id} className="mb-4">
                    <p className="font-bold text-slate-900 mb-2">
                      {cmd.nome_cliente || `Comanda ${cmd.id}`}
                    </p>
                    
                    {itensComanda.length > 0 ? (
                      <>
                        {itensComanda.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between py-1 text-slate-800">
                            <span className="flex-1">
                              {item.quantidade}x {item.produto || item.nome}
                            </span>
                            <span>
                              {formatPrice((Number(item.preco_unitario) || Number(item.preco) || 0) * (item.quantidade || 1))}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between font-bold mt-2 pt-2 border-t border-dashed border-slate-300 text-slate-900">
                          <span>Subtotal:</span>
                          <span>{formatPrice(totalComanda)}</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-slate-500 text-xs">Nenhum item</p>
                    )}

                    {tipo === 'mesa' && comandasParaImprimir.length > 1 && (
                      <div className="border-t border-dashed border-slate-300 my-3" />
                    )}
                  </div>
                );
              })}

              {/* Total Geral */}
              {(tipo === 'mesa' || comandasParaImprimir.length > 1) && (
                <div className="flex justify-between font-bold text-lg mt-4 pt-3 border-t-2 border-slate-900 text-slate-900">
                  <span>TOTAL:</span>
                  <span>{formatPrice(totalGeral)}</span>
                </div>
              )}

              {/* Rodapé */}
              <div className="text-center mt-6 text-xs text-slate-600">
                <p>Obrigado pela preferência!</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-3 shrink-0">
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
