'use client';

import React, { useState, useEffect } from 'react';
import { Phone, MapPin, Printer, CheckCircle2, UserPlus, CreditCard, Banknote, QrCode, Eye, Truck, ChevronDown, User, X, ExternalLink, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAvailableDrivers, assignDriverToOrder, Driver } from '@/app/actions/drivers';

interface OrderCardProps {
    order: any;
    columnId: string;
    onOpenPrintModal: (order: any) => void;
    onMoveOrder: (orderId: number, currentStatus: string) => void;
    onRegisterCustomer: (order: any) => void;
    onOpenDetails?: (order: any) => void;
    onCancelOrder?: (orderId: number) => void;
}

export function OrderCard({ order, columnId, onOpenPrintModal, onMoveOrder, onRegisterCustomer, onOpenDetails, onCancelOrder }: OrderCardProps) {
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [selectedDriver, setSelectedDriver] = useState<number | null>(order.entregador_id || null);
    const [assigning, setAssigning] = useState(false);
    const [showDriverDropdown, setShowDriverDropdown] = useState(false);

    const loadDrivers = async () => {
        try {
            const data = await getAvailableDrivers();
            setDrivers(data);
        } catch (error) {
            console.error('Erro ao carregar entregadores:', error);
        }
    };

    // Detectar automaticamente se é Delivery ou Retirada
    const endereco = order.endereco_entrega || '';
    const bairro = order.bairro_entrega || '';
    const hasAddress = endereco && endereco !== 'Retirada no balcão' && endereco.length > 3;
    const hasNeighborhood = bairro && bairro.length > 0;

    const isRetiradaExplicita = order.tipo_entrega === 'retirada';
    const hasDeliveryItem = Array.isArray(order.itens) && order.itens.some((item: any) => {
        const nome = (item.produto || item.nome || '').toLowerCase();
        return nome.includes('taxa de entrega') || nome.includes('delivery');
    });

    const isDelivery = !isRetiradaExplicita && (
        order.tipo_entrega === 'delivery' ||
        hasAddress ||
        hasNeighborhood ||
        hasDeliveryItem
    );

    // Carregar entregadores quando for delivery
    useEffect(() => {
        if (isDelivery) {
            loadDrivers();
        }
    }, [isDelivery, order.id]);

    const handleAssignDriver = async (driverId: number | null) => {
        setAssigning(true);
        try {
            await assignDriverToOrder(order.id, driverId);
            setSelectedDriver(driverId);
            setShowDriverDropdown(false);
        } catch (error) {
            console.error('Erro ao atribuir entregador:', error);
        } finally {
            setAssigning(false);
        }
    };

    // Formatar itens do JSON do NocoDB
    const formattedItems = Array.isArray(order.itens)
        ? order.itens.map((item: any) => {
            const nome = item.produto || item.nome || 'Item';
            const qtd = item.quantidade || 1;
            return `${qtd}x ${nome}`;
        })
        : [];

    // ✅ Formatar tempo - criado_em já vem como ISO string do servidor
    // Não usar new Date() em Client Component!
    const orderTime = order.criado_em
        ? new Date(order.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : '--:--';

    // Verificar se é pedido agendado
    const dataAgendamento = order.data_agendamento || order.dataAgendamento;
    const isAgendado = !!dataAgendamento;
    
    // Calcular tempo restante até o agendamento (em minutos)
    let minutosAteAgendamento = null;
    let podeLiberar = false;
    
    if (isAgendado && dataAgendamento) {
        // Parse da data considering timezone - NocoDB usually stores as ISO or local
        const agendamentoStr = dataAgendamento.replace(' ', 'T');
        const agendamento = new Date(agendamentoStr);
        const agora = new Date();
        
        // Se a data é inválida, tenta outro formato
        if (isNaN(agendamento.getTime())) {
            console.log('Data agendamento inválida:', dataAgendamento);
        } else {
            minutosAteAgendamento = Math.floor((agendamento.getTime() - agora.getTime()) / (1000 * 60));
            // Libera 40 minutos antes OU se já passou do horário (atrasado)
            podeLiberar = minutosAteAgendamento <= 40;
        }
    }

    // Formatar horário agendado
    const horarioAgendado = dataAgendamento
        ? new Date(dataAgendamento.replace(' ', 'T')).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : null;

    return (
        <div
            className={cn(
                "bg-white dark:bg-slate-800 rounded-lg shadow-sm border-l-4 p-4 space-y-3 border border-slate-200 dark:border-slate-700",
                columnId === 'agendado' ? "border-violet-500" :
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
                        {isAgendado && (
                            <span className="text-[9px] bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300 px-1.5 py-0.5 rounded font-bold uppercase flex items-center gap-1">
                                📅 {horarioAgendado}
                                {minutosAteAgendamento !== null && minutosAteAgendamento > 0 && (
                                    <span className="text-[10px]">({minutosAteAgendamento}min)</span>
                                )}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <h4 className="font-bold text-base leading-tight text-slate-900 dark:text-slate-200">
                            {order.nome_cliente || order.cliente_nome || order.telefone_cliente || 'Cliente'}
                        </h4>
                        {!order.is_recorrente && (
                            <button
                                onClick={() => onRegisterCustomer(order)}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors dark:bg-primary/20 dark:text-primary-foreground dark:hover:bg-primary/30"
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
                    columnId === 'agendado' ? "text-violet-600 bg-violet-50 dark:bg-violet-900/30" :
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
                <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 line-clamp-1">
                    <Phone className="size-3.5" /> {order.telefone_cliente || order.telefone || 'N/A'}
                </p>
                <div className="flex items-center justify-between">
                    <p className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5 line-clamp-1 flex-1">
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
                        isDelivery ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300" : "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300"
                    )}>
                        {isDelivery ? "Delivery" : "Retirada"}
                    </span>
                </div>
            </div>

            <div className="py-2 border-y border-slate-100 dark:border-slate-700">
                <ul className="text-sm font-medium space-y-1 text-slate-700 dark:text-slate-300">
                    {formattedItems.map((item: string, idx: number) => (
                        <li key={idx} className="line-clamp-1">• {item}</li>
                    ))}
                </ul>
                {order.observacoes && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/30 rounded border border-red-100 dark:border-red-800">
                        <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase">OBS: {order.observacoes}</p>
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-1 pt-2">
                <div className="flex items-center justify-between">
                    <span className={cn(
                        "text-[10px] font-bold uppercase py-1.5 px-2.5 rounded flex items-center gap-1",
                        order.forma_pagamento === 'pix' ? "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300" :
                            order.forma_pagamento === 'dinheiro' ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300" :
                                "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                    )}>
                        {order.forma_pagamento || 'Pagar na Entrega'}
                    </span>
                    <span className="text-base font-bold text-slate-900 dark:text-white">
                        R$ {Number(order.valor_total || order.total || 0).toFixed(2).replace('.', ',')}
                    </span>
                </div>
                
                {/* Linha com taxa de entrega, desconto e troco */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    {Number(order.taxa_entrega) > 0 && (
                        <span className="text-slate-500 dark:text-slate-400">
                            Entrega: R$ {Number(order.taxa_entrega).toFixed(2).replace('.', ',')}
                        </span>
                    )}
                    {Number(order.desconto) > 0 && (
                        <span className="text-green-600 dark:text-green-400 font-medium">
                            Desconto: -R$ {Number(order.desconto).toFixed(2).replace('.', ',')}
                        </span>
                    )}
                    {order.forma_pagamento === 'dinheiro' && Number(order.troco_necessario) > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                            Troco: R$ {Number(order.troco_necessario).toFixed(2).replace('.', ',')}
                        </span>
                    )}
                    {order.cupom_codigo && (
                        <span className="text-violet-600 dark:text-violet-400 font-medium">
                            Cupom: {order.cupom_codigo}
                        </span>
                    )}
                    {Number(order.pontos_ganhos) > 0 && (
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                            +{order.pontos_ganhos} pontos
                        </span>
                    )}
                </div>
            </div>

            {/* Seleção de Entregador - apenas para delivery */}
            {isDelivery && columnId !== 'finalizado' && columnId !== 'pagamento_pendente' && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                    <div className="relative">
                        <button
                            onClick={() => setShowDriverDropdown(!showDriverDropdown)}
                            disabled={assigning}
                            className={cn(
                                "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                                selectedDriver
                                    ? "bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
                                    : "bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"
                            )}
                        >
                            <span className="flex items-center gap-2">
                                <Truck className="size-4" />
                                {assigning ? 'Atribuindo...' :
                                    selectedDriver
                                        ? drivers.find(d => d.id === selectedDriver)?.nome || 'Entregador atribuído'
                                        : 'Atribuir entregador'}
                            </span>
                            <ChevronDown className={cn("size-4 transition-transform", showDriverDropdown && "rotate-180")} />
                        </button>

                        {showDriverDropdown && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                                {selectedDriver && (
                                    <button
                                        onClick={() => handleAssignDriver(null)}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                    >
                                        <X className="size-4" />
                                        Remover entregador
                                    </button>
                                )}
                                {drivers.length === 0 ? (
                                    <div className="px-3 py-4 text-center text-sm text-slate-400 dark:text-slate-500">
                                        Nenhum entregador disponível
                                    </div>
                                ) : (
                                    drivers.map((driver) => (
                                        <button
                                            key={driver.id}
                                            onClick={() => handleAssignDriver(driver.id!)}
                                            className={cn(
                                                "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors",
                                                selectedDriver === driver.id && "bg-primary/10 dark:bg-primary/20"
                                            )}
                                        >
                                            <User className="size-4 text-slate-400 dark:text-slate-500" />
                                            <span className="flex-1 text-left dark:text-white">{driver.veiculo} - {driver.nome}</span>
                                            <span className="text-xs text-slate-400 dark:text-slate-500">{driver.telefone}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Mostrar entregador atribuído em pedidos finalizados */}
            {order.entregador_id && columnId === 'finalizado' && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                        <Truck className="size-4" />
                        <span>Entregue por: {order.entregador_nome || 'Entregador'}</span>
                    </div>
                </div>
            )}

            {/* Link de rastreamento para delivery */}
            {isDelivery && (columnId === 'entrega' || columnId === 'preparando') && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                    <a
                        href={`/track/${order.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg text-purple-700 dark:text-purple-300 text-sm font-medium hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                    >
                        <ExternalLink className="size-4" />
                        Link de Rastreamento
                    </a>
                </div>
            )}

            {columnId === 'pagamento_pendente' && (
                <div className="grid grid-cols-6 gap-2 pt-1">
                    <button
                        onClick={() => onOpenDetails?.(order)}
                        className="col-span-1 h-9 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        title="Ver Detalhes"
                    >
                        <Eye className="size-4" />
                    </button>
                    <button
                        onClick={() => onOpenPrintModal(order)}
                        className="col-span-1 h-9 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                        <Printer className="size-4" />
                    </button>
                    {onCancelOrder && String(columnId) !== 'finalizado' && String(columnId) !== 'agendado' && String(columnId) !== 'cancelado' && String(columnId) !== 'pagamento_pendente' && (
                        <button
                            onClick={() => onCancelOrder(order.id)}
                            className="col-span-1 h-9 flex items-center justify-center rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                            title="Cancelar Pedido"
                        >
                            <Ban className="size-4" />
                        </button>
                    )}
                    <button
                        onClick={() => onMoveOrder(order.id, order.status)}
                        className="col-span-3 h-9 bg-orange-500 text-white text-xs font-bold rounded uppercase tracking-wider hover:bg-orange-600 transition-all shadow-sm active:scale-95 transition-transform"
                    >
                        Confirmar Pagamento
                    </button>
                </div>
            )}

            {columnId === 'agendado' && podeLiberar && (
                <div className="grid grid-cols-6 gap-2 pt-1">
                    <button
                        onClick={() => onOpenDetails?.(order)}
                        className="col-span-1 h-9 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        title="Ver Detalhes"
                    >
                        <Eye className="size-4" />
                    </button>
                    <button
                        onClick={() => onOpenPrintModal(order)}
                        className="col-span-1 h-9 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                        <Printer className="size-4" />
                    </button>
                    <button
                        onClick={() => onMoveOrder(order.id, order.status)}
                        className="col-span-4 h-9 bg-violet-500 text-white text-xs font-bold rounded uppercase tracking-wider hover:bg-violet-600 transition-all shadow-sm active:scale-95 transition-transform"
                    >
                        Liberar para Produção
                    </button>
                </div>
            )}

            {columnId === 'agendado' && !podeLiberar && (
                <div className="flex items-center justify-center py-2 text-violet-600 text-[10px] font-bold uppercase">
                    {minutosAteAgendamento !== null && minutosAteAgendamento > 0 
                        ? `Aguardando liberação (${minutosAteAgendamento}min)` 
                        : 'Aguardando agendamento'}
                </div>
            )}

            {columnId !== 'finalizado' && columnId !== 'pagamento_pendente' && columnId !== 'agendado' && (
                <div className="grid grid-cols-6 gap-2 pt-1">
                    <button
                        onClick={() => onOpenDetails?.(order)}
                        className="col-span-1 h-9 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        title="Ver Detalhes"
                    >
                        <Eye className="size-4" />
                    </button>
                    <button
                        onClick={() => onOpenPrintModal(order)}
                        className="col-span-1 h-9 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                        <Printer className="size-4" />
                    </button>
                    {onCancelOrder && columnId !== 'finalizado' && (
                        <button
                            onClick={() => onCancelOrder(order.id)}
                            className="col-span-1 h-9 flex items-center justify-center rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                            title="Cancelar Pedido"
                        >
                            <Ban className="size-4" />
                        </button>
                    )}
                    <button
                        onClick={() => onMoveOrder(order.id, order.status)}
                        className={`${onCancelOrder ? 'col-span-3' : 'col-span-4'} h-9 bg-primary text-white text-xs font-bold rounded uppercase tracking-wider hover:opacity-90 transition-all shadow-sm active:scale-95 transition-transform`}
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