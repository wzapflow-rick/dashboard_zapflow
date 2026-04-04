'use server';

import { revalidatePath } from 'next/cache';
import { incrementCouponUsage } from './coupons';
import { deductPointsForOrder } from './loyalty';
import { sendOrderCreatedMessage } from './whatsapp';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const ORDERS_TABLE_ID = 'm2ic8zof3feve3l'; // pedidos
const CLIENTS_TABLE_ID = 'mfpwzmya0e4ej1k'; // clientes
const COUPONS_TABLE_ID = 'myfkyl2km6bvp4p'; // cupons

async function nocoFetch(tableId: string, endpoint: string, options: RequestInit = {}) {
    const url = `${NOCODB_URL}/api/v2/tables/${tableId}${endpoint}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            'xc-token': NOCODB_TOKEN,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
        cache: 'no-store',
    });

    if (!res.ok) {
        const text = await res.text();
        console.error(`NocoDB Error: ${res.status} ${text}`);
        throw new Error(`NocoDB API Error: ${res.status}`);
    }

    return res;
}

interface OrderItem {
    id: number;
    nome: string;
    preco: number;
    quantidade: number;
    complementos?: {
        grupoId: number;
        grupoNome: string;
        items: {
            id: number;
            nome: string;
            preco: number;
            fator_proporcao: number;
        }[];
    }[];
}

interface CreatePublicOrderData {
    empresaId: number;
    clienteTelefone: string;
    clienteNome: string;
    clienteEndereco?: string;
    clienteBairro?: string;
    tipoEntrega: 'delivery' | 'retirada';
    taxaEntrega?: number;
    itens: OrderItem[];
    subtotal: number;
    desconto: number;
    total: number;
    cupomCodigo?: string;
    cupomId?: number | string;
    pontosGanhos: number;
    pontosUsados?: number;
    descontoPontos?: number;
    formaPagamento: 'pix' | 'dinheiro' | 'cartao';
    troco?: number;
    observacoes?: string;
    dataAgendamento?: string | null; // ISO date string para agendamento
}

// Verificar se cliente existe
export async function checkCustomerByPhone(empresaId: number, telefone: string) {
    try {
        const cleanPhone = telefone.replace(/\D/g, '');
        
        // Buscar por telefone - pode ter DDD ou não, com 9 ou sem
        const phoneVariations = [
            cleanPhone,
            cleanPhone.slice(-11), // Remove DDD se tiver 12 dígitos
            cleanPhone.slice(-10), // Remove DDD e 9 se tiver 11 dígitos
            '55' + cleanPhone, // Adiciona 55 na frente
        ];
        
        for (const phone of phoneVariations) {
            // Tentar com campo 'empresas'
            let checkRes = await nocoFetch(CLIENTS_TABLE_ID, 
                `/records?where=(empresas,eq,${empresaId})~and(telefone,like,${phone})`);
            let checkData = await checkRes.json();
            
            if (checkData.list && checkData.list.length > 0) {
                return checkData.list[0];
            }
            
            // Tentar com campo 'empresa_id' também
            checkRes = await nocoFetch(CLIENTS_TABLE_ID, 
                `/records?where=(empresa_id,eq,${empresaId})~and(telefone,like,${phone})`);
            checkData = await checkRes.json();
            
            if (checkData.list && checkData.list.length > 0) {
                return checkData.list[0];
            }
        }
        
        // Última tentativa: buscar todos os clientes da empresa e filtrar manualmente
        const allClientsRes = await nocoFetch(CLIENTS_TABLE_ID, 
            `/records?where=(empresas,eq,${empresaId})&limit=1000`);
        const allClientsData = await allClientsRes.json();
        const allClients = allClientsData.list || [];
        
        const found = allClients.find((c: any) => {
            const clientPhone = (c.telefone || '').replace(/\D/g, '');
            return phoneVariations.some(p => clientPhone.includes(p) || p.includes(clientPhone));
        });
        
        if (found) return found;
        
        return null;
    } catch (error) {
        console.error('Erro ao verificar cliente:', error);
        return null;
    }
}

// Verificar ou criar cliente
async function ensureCliente(empresaId: number, telefone: string, nome: string, endereco?: string, bairro?: string) {
    try {
        // Buscar cliente existente
        const checkRes = await nocoFetch(CLIENTS_TABLE_ID, 
            `/records?where=(empresas,eq,${empresaId})~and(telefone,eq,${telefone})`);
        const checkData = await checkRes.json();
        
        if (checkData.list && checkData.list.length > 0) {
            // Atualizar nome e endereço se fornecidos
            const existing = checkData.list[0];
            await nocoFetch(CLIENTS_TABLE_ID, '/records', {
                method: 'PATCH',
                body: JSON.stringify({
                    id: existing.id,
                    nome: nome || existing.nome,
                    endereco: endereco || existing.endereco,
                    bairro_entrega: bairro || existing.bairro_entrega,
                }),
            });
            return existing.id;
        } else {
            // Criar novo cliente
            const createRes = await nocoFetch(CLIENTS_TABLE_ID, '/records', {
                method: 'POST',
                body: JSON.stringify({
                    empresas: empresaId,
                    nome: nome || 'Cliente Cardápio',
                    telefone,
                    endereco: endereco || '',
                    bairro_entrega: bairro || '',
                }),
            });
            const created = await createRes.json();
            return created.id;
        }
    } catch (error) {
        console.error('Erro ao garantir cliente:', error);
        return null;
    }
}

// Criar pedido público (com status pagamento_pendente)
export async function createPublicOrder(data: CreatePublicOrderData) {
    try {
        // Validar dados obrigatórios
        if (!data.empresaId || !data.clienteTelefone || !data.itens?.length) {
            throw new Error('Dados incompletos para criar pedido');
        }

        // Garantir que o cliente existe
        await ensureCliente(
            data.empresaId,
            data.clienteTelefone,
            data.clienteNome,
            data.clienteEndereco,
            data.clienteBairro
        );

        // Montar itens formatados para exibição no kanban e dashboard
        const itensFormatados = data.itens.map((item: any) => {
            let produtoNome = item.nome;
            
            // Adicionar complementos ao nome se existirem
            if (item.complementos && item.complementos.length > 0) {
                const complementosStr = item.complementos
                    .map((c: any) => c.items.map((i: any) => i.nome).join(', '))
                    .join(' + ');
                if (complementosStr) {
                    produtoNome += ` (${complementosStr})`;
                }
            }
            
            return {
                produto: produtoNome,
                nome: produtoNome,
                quantidade: item.quantidade,
                preco: item.preco,
                subtotal: item.preco * item.quantidade,
            };
        });

        // Montar payload do pedido
        // Nota: endereco_entrega e bairro_entrega precisam existir como colunas na tabela NocoDB
        const enderecoCompleto = data.tipoEntrega === 'retirada' 
            ? 'Retirada no balcão' 
            : [data.clienteEndereco, data.clienteBairro].filter(Boolean).join(', ') || '';
        
        const orderPayload: any = {
            empresa_id: data.empresaId,
            telefone_cliente: data.clienteTelefone,
            cliente_nome: data.clienteNome,
            tipo_entrega: data.tipoEntrega,
            taxa_entrega: data.taxaEntrega || 0,
            itens: JSON.stringify(itensFormatados),
            subtotal: data.subtotal,
            desconto: data.desconto || 0,
            valor_total: data.total,
            cupom_codigo: data.cupomCodigo || '',
            pontos_ganhos: data.pontosGanhos || 0,
            forma_pagamento: data.formaPagamento,
            troco_necessario: data.troco || 0,
            status: data.dataAgendamento ? 'agendado' : (data.formaPagamento === 'dinheiro' ? 'pendente' : 'pagamento_pendente'),
            origem: 'cardapio_publico',
            criado_em: new Date().toISOString(),
        };

        // Adicionar agendamento se existir
        if (data.dataAgendamento) {
            orderPayload.data_agendamento = data.dataAgendamento;
            orderPayload.observacoes = data.observacoes 
                ? `${data.observacoes}\n📅 Agendado para: ${new Date(data.dataAgendamento).toLocaleString('pt-BR')}`
                : `📅 Agendado para: ${new Date(data.dataAgendamento).toLocaleString('pt-BR')}`;
        }

        // Adicionar campos de endereço (NocoDB ignorará se as colunas não existirem)
        orderPayload.endereco_entrega = enderecoCompleto;
        orderPayload.bairro_entrega = data.tipoEntrega === 'retirada' ? '' : (data.clienteBairro || '');
        
        // Incluir endereço no campo observacoes como fallback
        if (data.tipoEntrega === 'delivery' && enderecoCompleto && enderecoCompleto !== 'Retirada no balcão') {
            orderPayload.observacoes = data.observacoes 
                ? `${data.observacoes}\n📍 Endereço: ${enderecoCompleto}`
                : `📍 Endereço: ${enderecoCompleto}`;
        }

        console.log('[createPublicOrder] Payload being sent:', {
            endereco_entrega: orderPayload.endereco_entrega,
            bairro_entrega: orderPayload.bairro_entrega,
            tipo_entrega: orderPayload.tipo_entrega,
            clienteEndereco: data.clienteEndereco,
            clienteBairro: data.clienteBairro,
            observacoes: orderPayload.observacoes,
        });

        const res = await nocoFetch(ORDERS_TABLE_ID, '/records', {
            method: 'POST',
            body: JSON.stringify(orderPayload),
        });

        const order = await res.json();
        
        // Incrementar uso do cupom se foi usado
        if (data.cupomId) {
            incrementCouponUsage(data.cupomId).catch(err => 
                console.error('Erro ao incrementar uso do cupom:', err)
            );
        }
        
        // Deduzir pontos se foram usados
        if (data.pontosUsados && data.pontosUsados > 0 && data.descontoPontos) {
            deductPointsForOrder(
                data.clienteTelefone.replace(/\D/g, ''),
                data.pontosUsados,
                data.descontoPontos,
                order.id
            ).catch(err => console.error('Erro ao deduzir pontos:', err));
        }
        
        // Enviar mensagem de confirmação com link de rastreamento
        sendOrderCreatedMessage(data.clienteTelefone, order.id, data.total, data.dataAgendamento)
            .catch(err => console.error('Erro ao enviar mensagem WhatsApp:', err));
        
        revalidatePath('/dashboard/expedition');
        
        return {
            success: true,
            orderId: order.id,
            message: 'Pedido criado com sucesso!',
        };
    } catch (error: any) {
        console.error('Erro ao criar pedido público:', error);
        throw new Error(error.message || 'Erro ao criar pedido');
    }
}

// Verificar status do pedido (para o cliente acompanhar)
export async function checkOrderStatus(orderId: number) {
    try {
        const res = await nocoFetch(ORDERS_TABLE_ID, `/records/${orderId}`);
        const order = await res.json();
        
        return {
            id: order.id,
            status: order.status,
            valor_total: order.valor_total,
            criado_em: order.criado_em,
        };
    } catch (error) {
        console.error('Erro ao verificar status:', error);
        return null;
    }
}

// Atualizar status do pedido (para o painel admin)
export async function updateOrderStatusPublic(orderId: number, status: string) {
    try {
        const res = await nocoFetch(ORDERS_TABLE_ID, '/records', {
            method: 'PATCH',
            body: JSON.stringify({ id: orderId, status }),
        });

        revalidatePath('/dashboard/expedition');
        
        return { success: true };
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        throw new Error('Erro ao atualizar status');
    }
}

// Confirmar pagamento (muda de pagamento_pendente para pendente)
export async function confirmPayment(orderId: number) {
    return updateOrderStatusPublic(orderId, 'pendente');
}

// Cancelar pedido por falta de pagamento
export async function cancelUnpaidOrder(orderId: number) {
    return updateOrderStatusPublic(orderId, 'cancelado');
}
