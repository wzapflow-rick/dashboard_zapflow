'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from './auth';
import { getReceitaDoProduto, atualizarEstoqueInsumo, getInsumos } from './insumos';
import { getReceitaDoComplemento, getInsumosDoGrupo } from './complements';
import { getReceitaDoItemBase } from './itens-base';
import { OrderStatusSchema } from '@/lib/validations';
import { logAction } from '@/lib/audit';
import { incrementCouponUsage } from './coupons';
import { addPointsForOrder } from './loyalty';
import { finishDelivery } from './drivers';
import { sendOrderStatusMessage } from './whatsapp';
import { logger } from '@/lib/logger';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const TABLE_ID = 'm2ic8zof3feve3l'; // pedidos-pedidos

// Rate limiting para atualização de status
const orderUpdateAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ORDER_UPDATES = 30;
const ORDER_WINDOW_MS = 60 * 1000; // 1 minuto

const CLIENTS_TABLE_ID = 'mfpwzmya0e4ej1k'; // clientes
const DRIVERS_TABLE_ID = 'mhevb5nu9nczggv'; // entregadores

async function nocoFetchForTable(tableId: string, endpoint: string, options: RequestInit = {}) {
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
        console.error(`NocoDB Error (Table ${tableId}): ${res.status} ${text}`);
        throw new Error(`NocoDB API Error: ${res.status}`);
    }

    return res;
}

export async function getOrders() {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const ordersRes = await nocoFetchForTable(TABLE_ID, `/records?limit=1000&where=(empresa_id,eq,${user.empresaId})&sort=-id`);
        const ordersData = await ordersRes.json();
        const orders = ordersData.list || [];

        if (orders.length === 0) return [];

        const clientsRes = await nocoFetchForTable(CLIENTS_TABLE_ID, `/records?limit=1000&where=(empresa_id,eq,${user.empresaId})`);
        const clientsData = await clientsRes.json();
        const clients = clientsData.list || [];

        let drivers: any[] = [];
        try {
            const driversRes = await nocoFetchForTable(DRIVERS_TABLE_ID, `/records?limit=1000&where=(empresa_id,eq,${user.empresaId})`);
            const driversData = await driversRes.json();
            drivers = driversData.list || [];
        } catch (driverError) {
            drivers = [];
        }

        // Create plain object lookups instead of Maps
        const clientsByPhone: Record<string, any> = {};
        clients.forEach((c: any) => {
            if (c.telefone) clientsByPhone[String(c.telefone)] = c;
        });

        const driversById: Record<string, any> = {};
        drivers.forEach((d: any) => {
            if (d.id) driversById[String(d.id)] = d;
        });

        return orders.map((order: any) => {
            const phone = order.telefone_cliente ? String(order.telefone_cliente) : '';
            const client = clientsByPhone[phone] || null;
            const driverId = order.entregador_id ? String(order.entregador_id) : '';
            const driver = driversById[driverId] || null;

            return {
                id: order.id,
                status: order.status,
                valor_total: order.valor_total,
                criado_em: order.criado_em,
                telefone_cliente: order.telefone_cliente,
                endereco_entrega: order.endereco_entrega || '',
                bairro_entrega: order.bairro_entrega || '',
                tipo_entrega: order.tipo_entrega || '',
                entregador_id: order.entregador_id || null,
                itens: order.itens,
                cupom_id: order.cupom_id || null,
                canal: order.canal || '',
                nome_cliente: client?.nome || order.cliente_nome || null,
                is_recorrente: !!client,
                entregador_nome: driver?.nome || null,
                entregador_telefone: driver?.telefone || null,
                entregador_veiculo: driver?.veiculo || null,
            };
        });
    } catch (error) {
        console.error('API Error:', error);
        throw new Error('Failed to fetch orders with client data');
    }
}

export async function createManualOrder(data: {
    cliente_nome: string;
    telefone_cliente: string;
    itens: string;
    valor_total: number;
}) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const payload = {
            cliente_nome: data.cliente_nome || 'Cliente Manual',
            telefone_cliente: data.telefone_cliente || '00000000000',
            itens: data.itens,
            valor_total: data.valor_total,
            status: 'pendente',
            canal: 'Painel',
            empresa_id: user.empresaId,
            criado_em: new Date().toISOString(),
        };

        const res = await nocoFetchForTable(TABLE_ID, '/records', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        revalidatePath('/dashboard/expedition');
        return await res.json();
    } catch (error: any) {
        console.error('Erro ao criar pedido manual:', error);
        throw new Error(error.message || 'Failed to create manual order');
    }
}

export async function updateOrderStatus(id: number, status: string) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const validated = OrderStatusSchema.safeParse({ orderId: id, status });
        if (!validated.success) {
            const errorMsg = validated.error.issues.map((issue: any) => issue.message).join(', ');
            throw new Error(`Dados inválidos: ${errorMsg}`);
        }

        const now = Date.now();
        const attemptKey = `${user.empresaId}:order_update`;
        const attempt = orderUpdateAttempts.get(attemptKey);

        if (attempt && attempt.count >= MAX_ORDER_UPDATES) {
            const timeSinceLast = now - attempt.lastAttempt;
            if (timeSinceLast < ORDER_WINDOW_MS) {
                throw new Error('Muitas atualizações. Aguarde um momento.');
            } else {
                orderUpdateAttempts.delete(attemptKey);
            }
        }

        // SECURE: Fetch and verify order belongs to user's company
        const orderRes = await nocoFetchForTable(TABLE_ID, `/records/${id}`);
        const orderData = await orderRes.json();
        
        if (!orderData || Number(orderData.empresa_id) !== Number(user.empresaId)) {
            logger.securityAccessDenied(user.empresaId, `order:${id}`, 'UPDATE_STATUS');
            throw new Error('Acesso negado: Pedido não pertence a esta empresa');
        }

        if (status === 'finalizado') {
            try {
                if (orderData.telefone_cliente) {
                    const clientsRes = await nocoFetchForTable(CLIENTS_TABLE_ID,
                        `/records?where=(empresa_id,eq,${user.empresaId})~and(telefone,eq,${orderData.telefone_cliente})`
                    );
                    const clientsData = await clientsRes.json();
                    const client = clientsData.list?.[0];

                    if (client) {
                        const now = new Date();
                        const dateOnly = now.toISOString().split('T')[0];

                        await nocoFetchForTable(CLIENTS_TABLE_ID, '/records', {
                            method: 'PATCH',
                            body: JSON.stringify({
                                id: client.id,
                                ultima_compra: dateOnly,
                                ultimo_pedido: JSON.stringify(orderData.itens || [])
                            })
                        });
                    }
                }
            } catch (err) {
                console.error('Erro ao atualizar dados do cliente:', err);
            }
        }

        const res = await nocoFetchForTable(TABLE_ID, '/records', {
            method: 'PATCH',
            body: JSON.stringify({ id, status })
        });

        if (status === 'finalizado') {
            deduzirInsumosDoPedido(id).catch(err => console.error('Falha na dedução:', err));

            if (orderData.cupom_id) {
                incrementCouponUsage(orderData.cupom_id).catch(err =>
                    console.error('Falha ao incrementar cupom:', err)
                );
            }

            if (orderData.telefone_cliente && orderData.valor_total) {
                addPointsForOrder(
                    orderData.telefone_cliente,
                    orderData.cliente_nome || 'Cliente',
                    Number(orderData.valor_total),
                    id
                ).catch(err => console.error('Falha ao adicionar pontos:', err));
            }

            finishDelivery(id).catch(err => console.error('Falha ao finalizar entrega:', err));
        }

        if (orderData.telefone_cliente) {
            sendOrderStatusMessage(orderData.telefone_cliente, id, status, user.empresaId)
                .catch(err => console.error('Falha ao enviar WhatsApp:', err));
        }

        await logAction('UPDATE_ORDER_STATUS', `Pedido #${id} atualizado para: ${status}`);

        const currentAttempt = orderUpdateAttempts.get(attemptKey) || { count: 0, lastAttempt: now };
        currentAttempt.count += 1;
        currentAttempt.lastAttempt = now;
        orderUpdateAttempts.set(attemptKey, currentAttempt);

        revalidatePath('/dashboard/expedition');
        revalidatePath('/dashboard/customers');
        return await res.json();
    } catch (error: any) {
        console.error('API Error:', error);
        throw new Error(error.message || 'Failed to update order status');
    }
}

export async function deduzirInsumosDoPedido(orderId: number) {
    try {
        // 1. Verificar se o controle de estoque está ativo para a empresa
        const user = await getMe();
        if (!user?.empresaId) return;

        const companyRes = await nocoFetchForTable('mrlxbm1guwn9iv8', `/records/${user.empresaId}`);
        const company = await companyRes.json() as any;

        // Se o valor vier como "0", "false", 0 ou false, consideramos desativado
        const isEstoqueAtivo = company.controle_estoque === true || company.controle_estoque === 1 || String(company.controle_estoque).toLowerCase() === 'true';

        if (!isEstoqueAtivo) {
            console.log(`Controle de estoque desativado para empresa ${user.empresaId}. Pulando dedução.`);
            return;
        }

        // 2. Buscar o pedido para pegar os itens
        const orderRes = await nocoFetchForTable(TABLE_ID, `/records/${orderId}`);
        const order = await orderRes.json();

        if (!order.itens) return;

        const itens = typeof order.itens === 'string' ? JSON.parse(order.itens) : order.itens;
        if (!Array.isArray(itens)) return;

        // 2. Para cada item, processar a receita
        console.log(`Iniciando dedução de estoque para pedido ${orderId}. Itens:`, itens.length);

        for (const item of itens) {
            const produtoId = item.id;
            const quantidadeVendida = Number(item.quantidade) || 1;

            if (!produtoId) {
                console.warn(`Item sem ID de produto detectado no pedido ${orderId}:`, item.produto);
                continue;
            }

            // A. Receita do Produto Principal
            const receitaProduto = await getReceitaDoProduto(produtoId);
            if (receitaProduto && receitaProduto.length > 0) {
                console.log(`Deduzindo insumos base para ${item.produto} x${quantidadeVendida}.`);
                const basePromises = receitaProduto.map((r: any) => {
                    const totalADeduzir = Number(r.quantidade_necessaria) * quantidadeVendida;
                    return atualizarEstoqueInsumo(r.insumo_id, -totalADeduzir);
                });
                await Promise.all(basePromises);
            }

            // B. Receita dos Complementos/Adicionais ou Itens Compostos
            // Verificar se é produto composto (grupos de slots)
            if (item.isComposite) {
                // Produto composto: processar complementos como itens base
                const complements = item.complements || [];
                if (Array.isArray(complements) && complements.length > 0) {
                    console.log(`Processando ${complements.length} itens base para produto composto ${item.produto}.`);

                    // Agrupar por grupo_id
                    const groups = new Map<number, any[]>();
                    complements.forEach((c: any) => {
                        if (c.id) {
                            const gId = c.grupo_id || 0;
                            if (!groups.has(gId)) groups.set(gId, []);
                            groups.get(gId)?.push(c);
                        }
                    });

                    for (const [gId, itemsInGroup] of groups.entries()) {
                        // Insumos fixos do grupo (se existirem)
                        if (gId > 0) {
                            const insumosDoGrupo = await getInsumosDoGrupo(gId);
                            if (insumosDoGrupo.length > 0) {
                                console.log(`- Deduzindo insumos fixos do grupo ${gId}: ${insumosDoGrupo.length} insumos`);
                                const grupoFixoPromises = insumosDoGrupo.map((r: any) => {
                                    const totalADeduzir = Number(r.quantidade_necessaria) * quantidadeVendida;
                                    return atualizarEstoqueInsumo(r.insumo_id, -totalADeduzir);
                                });
                                await Promise.all(grupoFixoPromises);
                            }
                        }

                        // Processar cada item base
                        for (const itemBase of itemsInGroup) {
                            let proportion: number;
                            if (itemBase.fator_proporcao !== undefined && itemBase.fator_proporcao !== null) {
                                proportion = Number(itemBase.fator_proporcao);
                            } else {
                                // Fallback: divide igualmente
                                const isProportional = item.tipo_calculo === 'media' || item.tipo_calculo === 'maior_valor' || item.cobrar_mais_caro;
                                proportion = isProportional ? (1 / itemsInGroup.length) : 1;
                            }

                            const receitaItemBase = await getReceitaDoItemBase(itemBase.id);
                            if (receitaItemBase && receitaItemBase.length > 0) {
                                const itemPromises = receitaItemBase.map((r: any) => {
                                    const totalADeduzir = Number(r.quantidade) * proportion * quantidadeVendida;
                                    console.log(`- Deduzindo Item Base ${itemBase.nome}: Insumo ${r.insumo}, Qtd: ${totalADeduzir.toFixed(4)} (Fator: ${proportion})`);
                                    return atualizarEstoqueInsumo(r.insumo, -totalADeduzir);
                                });
                                await Promise.all(itemPromises);
                            }
                        }
                    }
                }
            } else {
                // Produto normal: processar complementos tradicionais
                const complements = item.complements || item.adicionais || [];
                if (Array.isArray(complements) && complements.length > 0) {
                    console.log(`Processando ${complements.length} complementos para ${item.produto}.`);

                    // Agrupar por grupo para controlar dedução de insumos fixos por grupo
                    const groups = new Map<number, any[]>();
                    complements.forEach((c: any) => {
                        if (c.id) {
                            const gId = c.grupo_id || 0;
                            if (!groups.has(gId)) groups.set(gId, []);
                            groups.get(gId)?.push(c);
                        }
                    });

                    for (const [gId, itemsInGroup] of groups.entries()) {
                        // C. Insumos fixos do grupo (base) — deduzidos UMA vez por unidade vendida
                        // Ex: massa da pizza, caixa de papelão, etc.
                        if (gId > 0) {
                            const insumosDoGrupo = await getInsumosDoGrupo(gId);
                            if (insumosDoGrupo.length > 0) {
                                console.log(`- Deduzindo insumos fixos do grupo ${gId}: ${insumosDoGrupo.length} insumos`);
                                const grupoFixoPromises = insumosDoGrupo.map((r: any) => {
                                    const totalADeduzir = Number(r.quantidade_necessaria) * quantidadeVendida;
                                    return atualizarEstoqueInsumo(r.insumo_id, -totalADeduzir);
                                });
                                await Promise.all(grupoFixoPromises);
                            }
                        }

                        const firstItem = itemsInGroup[0];
                        // Prioridade: usar fator_proporcao manual do payload se disponível
                        // Fallback: calcular automaticamente baseado no tipo_calculo do grupo
                        for (const comp of itemsInGroup) {
                            let proportion: number;
                            if (comp.fator_proporcao !== undefined && comp.fator_proporcao !== null) {
                                // Fator manual definido pelo cliente ao montar o pedido
                                proportion = Number(comp.fator_proporcao);
                            } else {
                                // Fallback automático: divide igualmente entre os itens do grupo
                                const isProportional = firstItem?.tipo_calculo === 'media' || firstItem?.tipo_calculo === 'maior_valor' || firstItem?.cobrar_mais_caro;
                                proportion = isProportional ? (1 / itemsInGroup.length) : 1;
                            }

                            const receitaComp = await getReceitaDoComplemento(comp.id);
                            if (receitaComp && receitaComp.length > 0) {
                                const compPromises = receitaComp.map((r: any) => {
                                    const totalADeduzir = Number(r.quantidade_necessaria) * proportion * quantidadeVendida;
                                    console.log(`- Deduzindo Complemento ${comp.nome}: Insumo ${r.insumo_id}, Qtd: ${totalADeduzir.toFixed(4)} (Fator: ${proportion})`);
                                    return atualizarEstoqueInsumo(r.insumo_id, -totalADeduzir);
                                });
                                await Promise.all(compPromises);
                            }
                        }
                    }
                }
            }
        }

        console.log(`Dedução de estoque concluída para pedido ${orderId}.`);
    } catch (error) {
        console.error('Erro no processo de dedução de estoque:', error);
        throw error;
    }
}

export async function verificarEstoqueDoPedido(orderId: number) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        // 0. Verificar se o controle de estoque está ativo para a empresa
        const companyRes = await nocoFetchForTable('mrlxbm1guwn9iv8', `/records/${user.empresaId}`);
        const company = await companyRes.json() as any;

        // Se o valor vier como "0", "false", 0 ou false, consideramos desativado
        const isEstoqueAtivo = company.controle_estoque === true || company.controle_estoque === 1 || String(company.controle_estoque).toLowerCase() === 'true';

        if (!isEstoqueAtivo) {
            // Se o controle de estoque estiver desativado, retorna que está tudo certo
            return { hasEnough: true, shortages: [] };
        }

        // 1. Buscar o pedido
        const orderRes = await nocoFetchForTable(TABLE_ID, `/records/${orderId}`);
        const order = await orderRes.json() as any;

        if (!order.itens) return { hasEnough: true, shortages: [], cliente: { nome: order.cliente_nome, telefone: order.telefone_cliente } };

        const itens = typeof order.itens === 'string' ? JSON.parse(order.itens) : order.itens;
        if (!Array.isArray(itens)) return { hasEnough: true, shortages: [] };

        // 2. Buscar todos os insumos atuais para ter o estoque em tempo real
        const currentInsumos = await getInsumos();
        const insumosMap = new Map(currentInsumos.map((i: any) => [i.id, i]));

        // 3. Mapear necessidades totais do pedido
        const necessidades = new Map<number, { nome: string, total: number, disponivel: number, unidade: string }>();

        for (const item of itens) {
            const produtoId = item.id;
            const quantidadeVendida = Number(item.quantidade) || 1;
            if (!produtoId) continue;

            // 1. Insumos do Produto
            const receitaProduto = await getReceitaDoProduto(produtoId);
            for (const r of receitaProduto) {
                const insumo = insumosMap.get(r.insumo_id) as any;
                if (!insumo) continue;

                const totalPreciso = Number(r.quantidade_necessaria) * quantidadeVendida;
                const prev = necessidades.get(r.insumo_id) || {
                    nome: insumo.nome,
                    total: 0,
                    disponivel: Number(insumo.quantidade_atual),
                    unidade: insumo.unidade_medida
                };
                necessidades.set(r.insumo_id, { ...prev, total: prev.total + totalPreciso });
            }

            // 2. Insumos dos Complementos
            const complements = item.complements || item.adicionais || [];
            if (Array.isArray(complements) && complements.length > 0) {
                const groups = new Map<number, any[]>();
                complements.forEach((c: any) => {
                    if (c.id) {
                        const gId = c.grupo_id || 0;
                        if (!groups.has(gId)) groups.set(gId, []);
                        groups.get(gId)?.push(c);
                    }
                });

                for (const [gId, itemsInGroup] of groups.entries()) {
                    const firstItem = itemsInGroup[0];
                    const isProportional = firstItem.tipo_calculo === 'media' || firstItem.tipo_calculo === 'maior_valor';
                    const proportion = isProportional ? (1 / itemsInGroup.length) : 1;

                    for (const comp of itemsInGroup) {
                        const receitaComp = await getReceitaDoComplemento(comp.id);
                        for (const r of receitaComp) {
                            const insumo = insumosMap.get(r.insumo_id) as any;
                            if (!insumo) continue;

                            const totalPreciso = Number(r.quantidade_necessaria) * proportion * quantidadeVendida;
                            const prev = necessidades.get(r.insumo_id) || {
                                nome: insumo.nome,
                                total: 0,
                                disponivel: Number(insumo.quantidade_atual),
                                unidade: insumo.unidade_medida
                            };
                            necessidades.set(r.insumo_id, { ...prev, total: prev.total + totalPreciso });
                        }
                    }
                }
            }
        }


        // 4. Verificar faltas
        const shortages: any[] = [];
        necessidades.forEach((val, id) => {
            if (val.total > val.disponivel) {
                shortages.push({
                    insumo_id: id,
                    nome: val.nome,
                    necessario: val.total,
                    disponivel: val.disponivel,
                    unidade: val.unidade
                });
            }
        });

        return {
            hasEnough: shortages.length === 0,
            shortages,
            cliente: {
                nome: order.cliente_nome,
                telefone: order.telefone_cliente
            }
        };
    } catch (error) {
        console.error('Erro na verificação de estoque:', error);
        return { hasEnough: true, shortages: [], cliente: null }; // Falha na verificação não bloqueia por segurança
    }
}

// Lightweight polling: returns only pending order IDs for header badge
export async function getPendingOrdersForPolling() {
    try {
        const user = await getMe();
        if (!user?.empresaId) return [];

        const res = await nocoFetchForTable(TABLE_ID,
            `/records?where=(empresa_id,eq,${user.empresaId})~and(status,eq,pendente)&fields=id,criado_em&limit=100&sort=-id`
        );
        const data = await res.json();
        return data.list || [];
    } catch {
        return [];
    }
}