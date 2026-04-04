'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from './auth';
import { CouponSchema } from '@/lib/validations';
import { logAction } from '@/lib/audit';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const COUPONS_TABLE_ID = 'myfkyl2km6bvp4p'; // Tabela de cupons

async function nocoFetch(endpoint: string, options: RequestInit = {}) {
    const url = `${NOCODB_URL}/api/v2/tables/${COUPONS_TABLE_ID}${endpoint}`;
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
        console.error(`NocoDB Error (Coupons): ${res.status} ${text}`);
        throw new Error(`NocoDB API Error: ${res.status}`);
    }

    return res;
}

export interface Coupon {
    id: number | string;
    codigo: string;
    tipo: 'percentual' | 'valor_fixo';
    valor: number;
    valor_minimo_pedido: number;
    limite_uso?: number;
    usos_atuais: number;
    data_inicio?: string;
    data_fim?: string;
    ativo: boolean;
    empresa_id: number | string;
}

// Buscar todos os cupons da empresa
export async function getCoupons(): Promise<Coupon[]> {
    try {
        const user = await getMe();
        if (!user?.empresaId) return [];

        const res = await nocoFetch(`/records?limit=1000&where=(empresa_id,eq,${user.empresaId})&sort=-id`);
        const data = await res.json();
        return (data.list || []).map((c: any) => ({ ...c, id: c.id || c.Id }));
    } catch (error) {
        console.error('getCoupons error:', error);
        return [];
    }
}

// Criar ou atualizar cupom
export async function upsertCoupon(couponData: any) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        // Validação com Zod
        const validated = CouponSchema.safeParse(couponData);
        if (!validated.success) {
            const errorMsg = validated.error.issues.map((issue: any) => issue.message).join(', ');
            throw new Error(`Dados inválidos: ${errorMsg}`);
        }

        // Verificar se código já existe
        const checkRes = await nocoFetch(`/records?where=(empresa_id,eq,${user.empresaId})~and(codigo,eq,${validated.data.codigo})`);
        const checkData = await checkRes.json();
        const existingCoupon = checkData.list?.[0];

        if (existingCoupon && existingCoupon.id !== couponData.id) {
            throw new Error('Já existe um cupom com este código');
        }

        const payload = {
            ...validated.data,
            empresa_id: user.empresaId,
        };

        let result;
        if (couponData.id || existingCoupon?.id) {
            const id = couponData.id || existingCoupon.id;
            const res = await nocoFetch('/records', {
                method: 'PATCH',
                body: JSON.stringify({ ...payload, id }),
            });
            result = await res.json();
            await logAction('UPDATE_CUPOM', `Cupom atualizado: ${validated.data.codigo}`);
        } else {
            payload.usos_atuais = 0;
            const res = await nocoFetch('/records', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            result = await res.json();
            await logAction('CREATE_CUPOM', `Novo cupom criado: ${validated.data.codigo}`);
        }

        revalidatePath('/dashboard/settings');
        return { success: true, data: result };
    } catch (error: any) {
        console.error('upsertCoupon error:', error);
        throw new Error(error.message || 'Erro ao salvar cupom');
    }
}

// Deletar cupom
export async function deleteCoupon(id: number | string) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        await nocoFetch('/records', {
            method: 'DELETE',
            body: JSON.stringify([{ id }]),
        });

        await logAction('DELETE_CUPOM', `Cupom ID ${id} deletado`);
        revalidatePath('/dashboard/settings');
        return { success: true };
    } catch (error: any) {
        console.error('deleteCoupon error:', error);
        throw new Error(error.message || 'Erro ao deletar cupom');
    }
}

// Validar cupom (usado no fluxo de pedido)
export async function validateCoupon(codigo: string, valorPedido: number) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const res = await nocoFetch(`/records?where=(empresa_id,eq,${user.empresaId})~and(codigo,eq,${codigo.toUpperCase()})~and(ativo,eq,true)`);
        const data = await res.json();
        const cupom = data.list?.[0];

        if (!cupom) {
            return { valid: false, error: 'Cupom não encontrado' };
        }

        // Debug: ver o que veio do banco
        console.log('[Cupom DEBUG] Dados recebidos:', {
            id: cupom.id,
            codigo: cupom.codigo,
            ativo: cupom.ativo,
            data_inicio: cupom.data_inicio,
            data_fim: cupom.data_fim,
            usos_atuais: cupom.usos_atuais,
            limite_uso: cupom.limite_uso
        });

        // Verificar limite de uso
        if (cupom.limite_uso && cupom.usos_atuais >= cupom.limite_uso) {
            return { valid: false, error: 'Limite de uso do cupom atingido' };
        }

        // Verificar data de validade
        const agora = new Date();
        const rawDataFim = cupom.data_fim;
        const rawDataInicio = cupom.data_inicio;
        
        // Tratar datas - são strings ISO (ex: "2026-04-02")
        // Para data_fim: considerar válido ATÉ o fim do dia (até 23:59:59)
        // Para data_inicio: considerar válido A PARTIR do início do dia (00:00:00)
        
        let dataFimValida = false;
        let dataInicioValida = false;
        
        if (rawDataFim && rawDataFim.trim() !== '') {
            const parts = rawDataFim.split('T')[0].split('-');
            if (parts.length === 3) {
                const ano = parseInt(parts[0]);
                const mes = parseInt(parts[1]) - 1;
                const dia = parseInt(parts[2]);
                // Data fim válida ATÉ o fim do dia (23:59:59)
                const dataFimFimDia = new Date(ano, mes, dia, 23, 59, 59);
                dataFimValida = dataFimFimDia > agora;
            }
        } else {
            dataFimValida = true; // Sem data fim = válido para sempre
        }
        
        if (rawDataInicio && rawDataInicio.trim() !== '') {
            const parts = rawDataInicio.split('T')[0].split('-');
            if (parts.length === 3) {
                const ano = parseInt(parts[0]);
                const mes = parseInt(parts[1]) - 1;
                const dia = parseInt(parts[2]);
                // Data início válida a partir do início do dia
                const dataInicioInicioDia = new Date(ano, mes, dia, 0, 0, 0);
                dataInicioValida = agora >= dataInicioInicioDia;
            }
        } else {
            dataInicioValida = true; // Sem data início = válido já
        }
        
        if (!dataFimValida) {
            return { valid: false, error: 'Cupom expirado' };
        }
        
        if (!dataInicioValida) {
            return { valid: false, error: 'Cupom ainda não está válido' };
        }

        // Verificar valor mínimo
        if (cupom.valor_minimo_pedido && valorPedido < cupom.valor_minimo_pedido) {
            return { 
                valid: false, 
                error: `Valor mínimo do pedido: R$ ${cupom.valor_minimo_pedido.toFixed(2).replace('.', ',')}` 
            };
        }

        // Calcular desconto
        let desconto = 0;
        if (cupom.tipo === 'percentual') {
            desconto = valorPedido * (cupom.valor / 100);
        } else {
            desconto = cupom.valor;
        }

        // SECURITY: Cap discount to prevent negative/zero totals
        // The minimum order value after discount should be at least R$ 1.00
        const maxDescontoPermitido = valorPedido - 100; // Allow max R$ 1.00 minimum (cents)
        const descontoFinal = Math.min(desconto, maxDescontoPermitido);

        return {
            valid: true,
            cupom: {
                id: cupom.id,
                codigo: cupom.codigo,
                tipo: cupom.tipo,
                valor: cupom.valor,
                desconto: Math.max(descontoFinal, 0),
            }
        };
    } catch (error: any) {
        return { valid: false, error: 'Erro ao validar cupom' };
    }
}

// Incrementar uso do cupom (após pedido finalizado)
export async function incrementCouponUsage(couponId: number | string) {
    try {
        const res = await nocoFetch(`/records/${couponId}`);
        const cupom = await res.json();
        const novosUsos = (cupom.usos_atuais || 0) + 1;
        
        // Verificar se atingiu o limite para desativar
        const shouldDeactivate = cupom.limite_uso && novosUsos >= cupom.limite_uso;
        
        await nocoFetch('/records', {
            method: 'PATCH',
            body: JSON.stringify({
                id: couponId,
                usos_atuais: novosUsos,
                ativo: shouldDeactivate ? false : cupom.ativo
            }),
        });

        return { success: true };
    } catch (error) {
        console.error('incrementCouponUsage error:', error);
        return { success: false };
    }
}

// Estatísticas de cupons
export async function getCouponStats() {
    try {
        const user = await getMe();
        if (!user?.empresaId) return null;

        const coupons = await getCoupons();
        
        const totalCoupons = coupons.length;
        const activeCoupons = coupons.filter(c => c.ativo).length;
        const totalUsage = coupons.reduce((sum, c) => sum + (c.usos_atuais || 0), 0);

        return {
            totalCoupons,
            activeCoupons,
            totalUsage,
            coupons: coupons.slice(0, 5) // Top 5 para dashboard
        };
    } catch (error) {
        console.error('getCouponStats error:', error);
        return null;
    }
}
