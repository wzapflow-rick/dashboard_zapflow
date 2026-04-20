'use server';

import { getMe } from '@/lib/session-server';
import { revalidatePath } from 'next/cache';
import { noco } from '@/lib/nocodb';
import { AVALIACOES_TABLE_ID, CLIENTES_TABLE_ID } from '@/lib/constants';

export async function getClientByPhone(telefone: string): Promise<{ nome?: string; id?: number } | null> {
    try {
        const user = await getMe();
        if (!user?.empresaId) return null;

        const cleanPhone = telefone.replace(/\D/g, '');

        const client = await noco.findOne(CLIENTES_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})~and(telefone,eq,${cleanPhone})`,
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
        const result = await noco.create(AVALIACOES_TABLE_ID, data);
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

        const data = await noco.list(AVALIACOES_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})`,
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
        const data = await noco.list(AVALIACOES_TABLE_ID, {
            where: `(empresa_id,eq,${empresaId})`,
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
        const result = await noco.findOne(AVALIACOES_TABLE_ID, {
            where: `(pedido_id,eq,${orderId})`,
        });
        return result || null;
    } catch (error) {
        console.error('getRatingByOrder error:', error);
        return null;
    }
}
