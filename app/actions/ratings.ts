'use server';

import { getMe } from './auth';
import { revalidatePath } from 'next/cache';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const RATINGS_TABLE_ID = 'maehg8e7on1f80k';

async function nocoFetch(endpoint: string, options: RequestInit = {}) {
    const url = `${NOCODB_URL}/api/v2/tables/${RATINGS_TABLE_ID}${endpoint}`;
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
        console.error(`NocoDB Error (Ratings): ${res.status} ${text}`);
        return null;
    }

    return res;
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
        const res = await nocoFetch('/records', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        if (!res) throw new Error('Erro ao salvar avaliação');

        const result = await res.json();
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

        const res = await nocoFetch(`/records?where=(empresa_id,eq,${user.empresaId})&sort=-created_at&limit=100`);
        if (!res) return [];

        const data = await res.json();
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
        const res = await nocoFetch(`/records?where=(empresa_id,eq,${empresaId})&limit=500`);
        if (!res) return null;

        const data = await res.json();
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
        const res = await nocoFetch(`/records?where=(pedido_id,eq,${orderId})&limit=1`);
        if (!res) return null;

        const data = await res.json();
        return data.list?.[0] || null;
    } catch (error) {
        console.error('getRatingByOrder error:', error);
        return null;
    }
}