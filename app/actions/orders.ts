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

        // 1. Buscar Pedidos
        const ordersRes = await nocoFetchForTable(TABLE_ID, `/records?limit=1000&where=(empresa_id,eq,${user.empresaId})&sort=-id`);
        const ordersData = await ordersRes.json();
        const orders = ordersData.list || [];

        // Debug: Log first order structure
        if (orders.length > 0) {
            console.log('[getOrders] First order fields:', {
                id: orders[0].id,
                endereco_entrega: orders[0].endereco_entrega,
                bairro_entrega: orders[0].bairro_entrega,
                tipo_entrega: orders[0].tipo_entrega,
                entregador_id: orders[0].entregador_id,
                allKeys: Object.keys(orders[0]).sort()
            });
        }

        if (orders.length === 0) return [];

        // 2. Buscar Clientes da Empresa
        const clientsRes = await nocoFetchForTable(CLIENTS_TABLE_ID, `/records?limit=1000&where=(empresa_id,eq,${user.empresaId})`);
        const clientsData = await clientsRes.json();
        const clients = clientsData.list || [];

        // 3. Buscar Entregadores da Empresa (pode não existir ainda)
        let drivers: any[] = [];
        try {
            const driversRes = await nocoFetchForTable(DRIVERS_TABLE_ID, `/records?limit=1000&where=(empresa_id,eq,${user.empresaId})`);
            const driversData = await driversRes.json();
            drivers = driversData.list || [];
        } catch (driverError) {
            console.warn('Tabela de entregadores não encontrada ou erro ao buscar:', driverError);
            drivers = [];
        }

        // 4. Criar Maps para busca rápida
        const clientsMap = new Map<string, any>(clients.map((c: any) => [c.telefone, c]));
        const driversMap = new Map<number, any>(drivers.map((d: any) => [d.id, d]));

        // 5. Vincular dados
        return orders.map((order: any) => {
            const client = clientsMap.get(order.telefone_cliente);
            const driver = order.entregador_id ? driversMap.get(order.entregador_id) : null;
            return {
                ...order,
                nome_cliente: (client as any)?.nome || null,
                is_recorrente: !!client, // Se está na base de clientes, é recorrente
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

export async function updateOrderStatus(id: number, status: string) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        // Validação com Zod
        const validated = OrderStatusSchema.safeParse({ orderId: id, status });
        if (!validated.success) {
            const errorMsg = validated.error.issues.map((issue: any) => issue.message).join(', ');
            throw new Error(`Dados inválidos: ${errorMsg}`);
        }

        // Rate limiting por empresa
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

        // Buscar detalhes do pedido para obter o telefone do cliente
        const orderRes = await nocoFetchForTable(TABLE_ID, `/records/${id}`);
        const orderData = await orderRes.json();

        // Se o status for finalizado, atualizamos os dados do cliente
        if (status === 'finalizado') {
            try {
                if (orderData.telefone_cliente) {
                    // 2. Buscar o cliente na base pelo telefone e empresa
                    const clientsRes = await nocoFetchForTable(CLIENTS_TABLE_ID,
                        `/records?where=(empresa_id,eq,${user.empresaId})~and(telefone,eq,${orderData.telefone_cliente})`
                    );
                    const clientsData = await clientsRes.json();
                    const client = clientsData.list?.[0];

                    if (client) {
                        // 3. Atualizar data e último pedido
                        const now = new Date();
                        // Formatamos como YYYY-MM-DD para seguir o pedido do usuário ("só a data")
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
                console.error('Erro ao atualizar dados do cliente após finalizar pedido:', err);
                // Não interrompemos o fluxo principal se a atualização do cliente falhar
            }
        }

        const res = await nocoFetchForTable(TABLE_ID, '/records', {
            method: 'PATCH',
            body: JSON.stringify({ id, status })
        });

        // Se o status for finalizado, disparar dedução de estoque, cupom e fidelidade
        if (status === 'finalizado') {
            // Executamos de forma assíncrona mas não bloqueante para a resposta rápida da UI
            deduzirInsumosDoPedido(id).catch(err => console.error('Falha na dedução de estoque:', err));
            
            // Incrementar uso do cupom se houver
            if (orderData.cupom_id) {
                incrementCouponUsage(orderData.cupom_id).catch(err => 
                    console.error('Falha ao incrementar uso do cupom:', err)
                );
            }
            
            // Adicionar pontos de fidelidade
            if (orderData.telefone_cliente && orderData.valor_total) {
                addPointsForOrder(
                    orderData.telefone_cliente,
                    orderData.cliente_nome || 'Cliente',
                    Number(orderData.valor_total),
                    id
                ).catch(err => console.error('Falha ao adicionar pontos:', err));
            }
            
            // Finalizar entrega e liberar entregador
            finishDelivery(id).catch(err => console.error('Falha ao finalizar entrega:', err));
        }

        // Enviar notificação WhatsApp para o cliente com link de rastreamento
        if (orderData.telefone_cliente) {
            sendOrderStatusMessage(orderData.telefone_cliente, id, status)
                .catch(err => console.error('Falha ao enviar notificação WhatsApp:', err));
        }

        // Log da ação
        await logAction('UPDATE_ORDER_STATUS', `Pedido #${id} atualizado para: ${status}`);

        // Incrementar rate limiting
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
