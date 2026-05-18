'use server';

import { getMe } from '@/lib/session-server';
import { revalidatePath } from 'next/cache';
import { pg } from '@/lib/postgres';
import { AVALIACOES_TABLE, CLIENTES_TABLE } from '@/lib/tables';

export async function getClientByPhone(telefone: string): Promise<{ nome?: string; id?: number } | null> {
    try {
        const user = await getMe();
        if (!user?.empresaId) return null;

        const cleanPhone = telefone.replace(/\D/g, '');

        const client = await pg.findOne(CLIENTES_TABLE, {
            where: { empresa_id: user.empresaId, telefone: cleanPhone },
        }) as any;

        return client ? { nome: client.nome, id: client.id } : null;
    } catch (error) {
        console.error('getClientByPhone error:', error);
        return null;
    }
}

export interface Rating {
    id?: number;
    pedido_id: number;
    empresa_id: number;
    telefone_cliente: string;
    nota_comida: number;
    nota_entrega: number;
    comentario?: string;
    created_at?: string;
}

export async function createRating(data: {
    pedido_id: number;
    empresa_id: number;
    telefone_cliente: string;
    nota_comida: number;
    nota_entrega: number;
    comentario?: string;
}) {
    try {
        const result = await pg.create(AVALIACOES_TABLE, data);
        revalidatePath('/dashboard/customers');
        return { success: true, data: result };
    } catch (error) {
        console.error('createRating error:', error);
        return { success: false, error: 'Erro ao salvar avaliação' };
    }
}

export async function getRatingsByEmpresa(): Promise<Rating[]> {
    try {
        const user = await getMe();
        if (!user?.empresaId) return [];

        const data = await pg.list(AVALIACOES_TABLE, {
            where: { empresa_id: user.empresaId },
            sort: '-created_at',
            limit: 100,
        });

        return (data.list || []).map((r: any) => ({
            id: r.id,
            pedido_id: r.pedido_id,
            empresa_id: r.empresa_id,
            telefone_cliente: r.telefone_cliente,
            nota_comida: r.nota_comida,
            nota_entrega: r.nota_entrega,
            comentario: r.comentario,
            created_at: r.created_at
        }));
    } catch (error) {
        console.error('getRatingsByEmpresa error:', error);
        return [];
    }
}

export async function getAverageRatings(empresaId: number) {
    try {
        const data = await pg.list(AVALIACOES_TABLE, {
            where: { empresa_id: empresaId },
            limit: 500,
        });
        const ratings = data.list || [];

        if (ratings.length === 0) return null;

        const totalComida = ratings.reduce((sum: number, r: any) => sum + (r.nota_comida || 0), 0);
        const totalEntrega = ratings.reduce((sum: number, r: any) => sum + (r.nota_entrega || 0), 0);

        return {
            media_comida: (totalComida / ratings.length).toFixed(1),
            media_entrega: (totalEntrega / ratings.length).toFixed(1),
            total_avaliacoes: ratings.length,
            notas_comida: ratings.reduce((acc: any, r: any) => {
                acc[r.nota_comida] = (acc[r.nota_comida] || 0) + 1;
                return acc;
            }, {}),
            notas_entrega: ratings.reduce((acc: any, r: any) => {
                acc[r.nota_entrega] = (acc[r.nota_entrega] || 0) + 1;
                return acc;
            }, {})
        };
    } catch (error) {
        console.error('getAverageRatings error:', error);
        return null;
    }
}

export async function getRatingByOrder(orderId: number) {
    try {
        const result = await pg.findOne(AVALIACOES_TABLE, {
            where: { pedido_id: orderId },
        });
        return result || null;
    } catch (error) {
        console.error('getRatingByOrder error:', error);
        return null;
    }
}
