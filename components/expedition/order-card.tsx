'use client';

import React, { useEffect } from 'react';
import { Phone, MapPin, Printer, CheckCircle2, UserPlus, CreditCard, Banknote, QrCode, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderCardProps {
    order: any;
    columnId: string;
    onOpenPrintModal: (order: any) => void;
    onMoveOrder: (orderId: number, currentStatus: string) => void;
    onRegisterCustomer: (order: any) => void;
    onOpenDetails?: (order: any) => void;
}

export function OrderCard({ order, columnId, onOpenPrintModal, onMoveOrder, onRegisterCustomer, onOpenDetails }: OrderCardProps) {
    // Debug: Log order data structure
    useEffect(() => {
        if (order.id) {
            console.log(`[OrderCard] Order #${order.id} data:`, {
                endereco_entrega: order.endereco_entrega,
                bairro_entrega: order.bairro_entrega,
                tipo_entrega: order.tipo_entrega,
                allKeys: Object.keys(order)
            });
        }
    }, [order]);
    // Formatar itens do JSON do NocoDB
    const formattedItems = Array.isArray(order.itens)
        ? order.itens.map((item: any) => {
            const nome = item.produto || item.nome || 'Item';
            const qtd = item.quantidade || 1;
            return `${qtd}x ${nome}`;
        })
        : [];

    // Detectar automaticamente se é Delivery ou Retirada
    // 1. Verificar campo tipo_entrega primeiro
    // 2. Se tiver endereço de entrega, é delivery
    // 3. Se não existir tipo_entrega, verificar se tem taxa de entrega nos itens
    const endereco = order.endereco_entrega || '';
    const bairro = order.bairro_entrega || '';
    const hasAddress = endereco && endereco !== 'Retirada no balcão' && endereco.length > 3;
    const hasNeighborhood = bairro && bairro.length > 0;
    
    const isRetiradaExplicita = order.tipo_entrega === 'retirada';
    const hasDeliveryItem = Array.isArray(order.itens) && order.itens.some((item: any) => {
        const nome = (item.produto || item.nome || '').toLowerCase();
        return nome.includes('taxa de entrega') || nome.includes('delivery');
    });
    
    // É delivery se: tipo_entrega for 'delivery' OU tiver endereço OU tiver item de entrega
    const isDelivery = !isRetiradaExplicita && (
        order.tipo_entrega === 'delivery' || 
        hasAddress || 
        hasNeighborhood || 
        hasDeliveryItem
    );

    // Calcular tempo relativo (simplificado)
    const orderTime = order.criado_em ? new Date(order.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';

    return (
        <div
            className={cn(
                "bg-white rounded-lg shadow-sm border-l-4 p-4 space-y-3",
                columnId === 'pagamento_pendente' ? "border-orange-500" :
                    columnId === 'pendente' ? "border-red-500" :
                        columnId === 'preparando' ? "border-amber-500" :
                            columnId === 'entrega' ? "border-blue-500" :
                                "border-green-500"
            )}
        >
            <div className="flex justify-between items-start">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">#{order.id}</span>
                        {order.is_recorrente && (
                            <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase">
                                VIP / Recorrente
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <h4 className="font-bold text-base leading-tight text-slate-900">
                            {order.nome_cliente || order.cliente_nome || order.telefone_cliente || 'Cliente'}
                        </h4>
                        {!order.is_recorrente && (
                            <button
                                onClick={() => onRegisterCustomer(order)}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                title="Registrar Cliente"
                            >
                                <UserPlus className="size-3" />
                                <span className="text-[9px] font-bold uppercase">Registrar</span>
                            </button>
                        )}
                    </div>
                </div>
                <span className={cn(
                    "text-xs font-bold px-2 py-1 rounded",
                    columnId === 'pagamento_pendente' ? "text-orange-600 bg-orange-50" :
                        columnId === 'pendente' ? "text-red-600 bg-red-50" :
                            columnId === 'preparando' ? "text-amber-600 bg-amber-50" :
                                columnId === 'entrega' ? "text-blue-600 bg-blue-50" :
                                    "text-green-600 bg-green-50"
                )}>
                    {orderTime}
                </span>
            </div>

            <div className="text-sm space-y-1">
                <p className="text-slate-500 flex items-center gap-1.5 line-clamp-1">
                    <Phone className="size-3.5" /> {order.telefone_cliente || order.telefone || 'N/A'}
                </p>
                <div className="flex items-center justify-between">
                    <p className="text-slate-600 flex items-center gap-1.5 line-clamp-1 flex-1">
                        <MapPin className="size-3.5 shrink-0" />
                        <span className="truncate">
                            {!isDelivery 
                                ? 'Retirada no balcão' 
                                : order.endereco_entrega && order.endereco_entrega !== 'Retirada no balcão'
                                    ? `${order.endereco_entrega}${order.bairro_entrega ? ' - ' + order.bairro_entrega : ''}`
                                    : order.bairro_entrega || order.bairro || 'Endereço não informado'}
                        </span>
                    </p>
                    <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ml-2",
                        isDelivery ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                    )}>
                        {isDelivery ? "Delivery" : "Retirada"}
                    </span>
                </div>
            </div>

            <div className="py-2 border-y border-slate-100">
                <ul className="text-sm font-medium space-y-1 text-slate-700">
                    {formattedItems.map((item: string, idx: number) => (
                        <li key={idx} className="line-clamp-1">• {item}</li>
                    ))}
                </ul>
                {order.observacoes && (
                    <div className="mt-2 p-2 bg-red-50 rounded border border-red-100">
                        <p className="text-xs font-bold text-red-600 uppercase">OBS: {order.observacoes}</p>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between pt-2">
                <span className="text-[10px] font-bold uppercase py-1.5 px-2.5 rounded bg-green-100 text-green-700 flex items-center gap-1">
                    <span className="size-1.5 bg-green-500 rounded-full animate-pulse" />
                    {order.forma_pagamento || 'Pagar na Entrega'}
                </span>
                <span className="text-base font-bold text-slate-900">
                    R$ {Number(order.valor_total || order.total || 0).toFixed(2).replace('.', ',')}
                </span>
            </div>

            {columnId === 'pagamento_pendente' && (
                <div className="grid grid-cols-6 gap-2 pt-1">
                    <button
                        onClick={() => onOpenDetails?.(order)}
                        className="col-span-1 h-9 flex items-center justify-center rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                        title="Ver Detalhes"
                    >
                        <Eye className="size-4" />
                    </button>
                    <button
                        onClick={() => onOpenPrintModal(order)}
                        className="col-span-1 h-9 flex items-center justify-center rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                        <Printer className="size-4" />
                    </button>
                    <button
                        onClick={() => onMoveOrder(order.id, order.status)}
                        className="col-span-4 h-9 bg-orange-500 text-white text-xs font-bold rounded uppercase tracking-wider hover:bg-orange-600 transition-all shadow-sm active:scale-95 transition-transform"
                    >
                        Confirmar Pagamento
                    </button>
                </div>
            )}

            {columnId !== 'finalizado' && columnId !== 'pagamento_pendente' && (
                <div className="grid grid-cols-6 gap-2 pt-1">
                    <button
                        onClick={() => onOpenDetails?.(order)}
                        className="col-span-1 h-9 flex items-center justify-center rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                        title="Ver Detalhes"
                    >
                        <Eye className="size-4" />
                    </button>
                    <button
                        onClick={() => onOpenPrintModal(order)}
                        className="col-span-1 h-9 flex items-center justify-center rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                        <Printer className="size-4" />
                    </button>
                    <button
                        onClick={() => onMoveOrder(order.id, order.status)}
                        className="col-span-4 h-9 bg-primary text-white text-xs font-bold rounded uppercase tracking-wider hover:opacity-90 transition-all shadow-sm active:scale-95 transition-transform"
                    >
                        {columnId === 'pendente' ? 'Mover para Preparando' :
                            columnId === 'preparando' ? 'Finalizar Preparo' :
                                'Confirmar Entrega'}
                    </button>
                </div>
            )}

            {columnId === 'finalizado' && (
                <div className="flex items-center gap-1 text-green-600 text-[10px] font-bold uppercase pt-2">
                    <CheckCircle2 className="size-3" />
                    Concluído com Sucesso
                </div>
            )}
        </div>
    );
}
