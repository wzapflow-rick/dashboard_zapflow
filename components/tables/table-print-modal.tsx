'use client';

import React, { useRef, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Printer, X, ChevronLeft } from 'lucide-react';
import { type MesaComDetalhes, type ComandaComPedidos } from '@/app/actions/tables';
import { printThermal, getReceiptCss, getLarguraPadrao, setLarguraPadrao, type LarguraPapel } from '@/lib/thermal-print';

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
  const [largura, setLargura] = useState<LarguraPapel>('58mm');

  React.useEffect(() => {
    setLargura(getLarguraPadrao());
  }, []);

  if (!isOpen) return null;

  const handleLarguraChange = (l: LarguraPapel) => {
    setLargura(l);
    setLarguraPadrao(l);
  };

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
    printThermal({
      title: tipo === 'mesa' ? `Mesa ${mesa.numero}` : `Comanda - ${comanda?.nome_cliente || comanda?.id}`,
      bodyHtml: `<div class="zf-receipt">${printContent.innerHTML}</div>`,
      largura,
    });
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
          <div className="p-4 overflow-y-auto flex-1 flex justify-center bg-slate-100 dark:bg-slate-900/50">
            <div
              ref={printRef}
              className="zf-receipt bg-white shadow-lg h-fit"
              style={{ width: largura === '58mm' ? '240px' : '300px', padding: '10px 12px' }}
            >
              <style dangerouslySetInnerHTML={{ __html: getReceiptCss(largura) }} />

              {/* Cabeçalho invertido */}
              <div className="zf-brand">
                <div className="zf-name">{tipo === 'mesa' ? `MESA ${mesa.numero}` : 'COMANDA'}</div>
                <div className="zf-sub">{new Date().toLocaleString('pt-BR')}</div>
              </div>

              {/* Badge de tipo */}
              <div className="zf-badge-wrap">
                <span className="zf-badge">{tipo === 'mesa' ? 'CONTA DA MESA' : 'CONTA INDIVIDUAL'}</span>
              </div>

              {mesa.nome && tipo === 'mesa' && (
                <div className="zf-meta zf-center"><b>{mesa.nome}</b></div>
              )}

              <hr className="zf-dash" />

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
                  <div key={cmd.id}>
                    <div className="zf-section">{cmd.nome_cliente || `Comanda ${cmd.id}`}</div>

                    {itensComanda.length > 0 ? (
                      <>
                        <div className="zf-ihead">
                          <span className="zf-q">Qtd</span>
                          <span className="zf-nm">Itens</span>
                          <span className="zf-pr">Preço</span>
                        </div>
                        {itensComanda.map((item: any, idx: number) => (
                          <div className="zf-li" key={idx}>
                            <span className="zf-q">{item.quantidade}x</span>
                            <span className="zf-nm">{item.produto || item.nome}</span>
                            <span className="zf-pr">{formatPrice((Number(item.preco_unitario) || Number(item.preco) || 0) * (item.quantidade || 1))}</span>
                          </div>
                        ))}
                        <div className="zf-row zf-strong">
                          <span>Subtotal</span>
                          <span>{formatPrice(totalComanda)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="zf-meta">Nenhum item</div>
                    )}

                    {tipo === 'mesa' && comandasParaImprimir.length > 1 && (
                      <hr className="zf-dash" />
                    )}
                  </div>
                );
              })}

              {/* Total Geral em caixa invertida */}
              {(tipo === 'mesa' || comandasParaImprimir.length > 1) && (
                <div className="zf-total">
                  <span>TOTAL</span>
                  <span>{formatPrice(totalGeral)}</span>
                </div>
              )}

              {/* Rodapé */}
              <div className="zf-foot">
                <div className="zf-thanks">Obrigado pela preferência!</div>
                <div>ZapFlow</div>
              </div>
              <div className="zf-cut">- - - - - - - - - - - -</div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-3 shrink-0">
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
