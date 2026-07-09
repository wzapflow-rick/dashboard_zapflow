'use server';

import { revalidatePath } from 'next/cache';
import { getMe, requireAdmin } from '@/lib/session-server';
import { CouponSchema } from '@/lib/validations';
import { logAction } from '@/lib/audit';
import { pg } from '@/lib/postgres';
import { CUPONS_TABLE } from '@/lib/tables';

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

export async function getCoupons(): Promise<Coupon[]> {
    try {
        const user = await getMe();
        if (!user?.empresaId) return [];

        const data = await pg.list(CUPONS_TABLE, {
            where: { empresa_id: user.empresaId },
            sort: '-id',
            limit: 1000,
        });
        return (data.list || []).map((c: any) => ({ ...c, id: c.id }));
    } catch (error) {
        console.error('getCoupons error:', error);
        return [];
    }
}

export async function upsertCoupon(couponData: any) {
    try {
        const user = await requireAdmin();

        const validated = CouponSchema.safeParse(couponData);
        if (!validated.success) {
            const errorMsg = validated.error.issues.map((issue: any) => issue.message).join(', ');
            throw new Error(`Dados inválidos: ${errorMsg}`);
        }

        const existingCoupon = await pg.findOne(CUPONS_TABLE, {
            where: { empresa_id: user.empresaId, codigo: validated.data.codigo },
        }) as any;

        if (existingCoupon && existingCoupon.id !== couponData.id) {
            throw new Error('Já existe um cupom com este código');
        }

        const payload: any = {
            ...validated.data,
            empresa_id: user.empresaId,
        };

        // Datas vazias ('') quebram colunas DATE no Postgres
        // (invalid input syntax for type date: ""). Converte para null.
        if (!payload.data_inicio || String(payload.data_inicio).trim() === '') {
            payload.data_inicio = null;
        }
        if (!payload.data_fim || String(payload.data_fim).trim() === '') {
            payload.data_fim = null;
        }
        // limite_uso vazio/indefinido tambem vira null (coluna INTEGER).
        if (payload.limite_uso === undefined || payload.limite_uso === '' || payload.limite_uso === null) {
            payload.limite_uso = null;
        }

        let result;
        if (couponData.id || existingCoupon?.id) {
            const id = couponData.id || existingCoupon.id;
            result = await pg.update(CUPONS_TABLE, { ...payload, id });
            await logAction('UPDATE_CUPOM', `Cupom atualizado: ${validated.data.codigo}`);
        } else {
            payload.usos_atuais = 0;
            result = await pg.create(CUPONS_TABLE, payload);
            await logAction('CREATE_CUPOM', `Novo cupom criado: ${validated.data.codigo}`);
        }

        revalidatePath('/dashboard/settings');
        return { success: true, data: result };
    } catch (error: any) {
        console.error('upsertCoupon error:', error);
        // Retorna o erro (em vez de lancar) para a mensagem real chegar a UI,
        // ja que em producao o Next.js oculta erros lancados em server actions.
        return { success: false, error: error.message || 'Erro ao salvar cupom' };
    }
}

export async function deleteCoupon(id: number | string) {
    try {
        await requireAdmin();

        await pg.delete(CUPONS_TABLE, id);

        await logAction('DELETE_CUPOM', `Cupom ID ${id} deletado`);
        revalidatePath('/dashboard/settings');
        return { success: true };
    } catch (error: any) {
        console.error('deleteCoupon error:', error);
        throw new Error(error.message || 'Erro ao deletar cupom');
    }
}

export async function validateCoupon(codigo: string, valorPedido: number) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        // Busca cupom ativo com o código
        const allCoupons = await pg.list(CUPONS_TABLE, {
            where: { empresa_id: user.empresaId, ativo: true },
            limit: 1000,
        });
        
        const cupom = (allCoupons.list || []).find((c: any) => 
            c.codigo?.toUpperCase() === codigo.toUpperCase()
        ) as any;

        if (!cupom) {
            return { valid: false, error: 'Cupom não encontrado' };
        }

        console.log('[Cupom DEBUG] Dados recebidos:', {
            id: cupom.id, codigo: cupom.codigo, ativo: cupom.ativo,
            data_inicio: cupom.data_inicio, data_fim: cupom.data_fim,
            usos_atuais: cupom.usos_atuais, limite_uso: cupom.limite_uso
        });

        if (cupom.limite_uso && cupom.usos_atuais >= cupom.limite_uso) {
            return { valid: false, error: 'Limite de uso do cupom atingido' };
        }

        const agora = new Date();

        let dataFimValida = true;
        let dataInicioValida = true;

        if (cupom.data_fim && cupom.data_fim.trim() !== '') {
            const parts = cupom.data_fim.split('T')[0].split('-');
            if (parts.length === 3) {
                const dataFimFimDia = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 23, 59, 59);
                dataFimValida = dataFimFimDia > agora;
            }
        }

        if (cupom.data_inicio && cupom.data_inicio.trim() !== '') {
            const parts = cupom.data_inicio.split('T')[0].split('-');
            if (parts.length === 3) {
                const dataInicioInicioDia = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0);
                dataInicioValida = agora >= dataInicioInicioDia;
            }
        }

        if (!dataFimValida) return { valid: false, error: 'Cupom expirado' };
        if (!dataInicioValida) {
            if (cupom.data_inicio) {
                const parts = cupom.data_inicio.split('T')[0].split('-');
                if (parts.length === 3) {
                    const dia = String(parseInt(parts[2])).padStart(2, '0');
                    const mes = String(parseInt(parts[1])).padStart(2, '0');
                    const ano = parts[0];
                    return { valid: false, error: `Cupom válido a partir de ${dia}/${mes}/${ano}` };
                }
            }
            return { valid: false, error: 'Cupom ainda não está válido' };
        }

        if (cupom.valor_minimo_pedido && valorPedido < cupom.valor_minimo_pedido) {
            return {
                valid: false,
                error: `Valor mínimo do pedido: R$ ${cupom.valor_minimo_pedido.toFixed(2).replace('.', ',')}`
            };
        }

        let desconto = 0;
        if (cupom.tipo === 'percentual') {
            desconto = valorPedido * (cupom.valor / 100);
        } else {
            desconto = cupom.valor;
        }

        const maxDescontoPermitido = valorPedido - 100;
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

export async function incrementCouponUsage(couponId: number | string) {
    try {
        const cupom = await pg.findById(CUPONS_TABLE, couponId) as any;
        const novosUsos = (cupom?.usos_atuais || 0) + 1;

        const shouldDeactivate = cupom?.limite_uso && novosUsos >= cupom.limite_uso;

        await pg.update(CUPONS_TABLE, {
            id: couponId,
            usos_atuais: novosUsos,
            ativo: shouldDeactivate ? false : cupom?.ativo
        });

        return { success: true };
    } catch (error) {
        console.error('incrementCouponUsage error:', error);
        return { success: false };
    }
}

export async function getCouponStats() {
    try {
        const user = await getMe();
        if (!user?.empresaId) return null;

        const coupons = await getCoupons();

        return {
            totalCoupons: coupons.length,
            activeCoupons: coupons.filter(c => c.ativo).length,
            totalUsage: coupons.reduce((sum, c) => sum + (c.usos_atuais || 0), 0),
            coupons: coupons.slice(0, 5)
        };
    } catch (error) {
        console.error('getCouponStats error:', error);
        return null;
    }
}
