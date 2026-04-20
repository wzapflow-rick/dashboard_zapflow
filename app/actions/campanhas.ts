'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session-server';
import { noco } from '@/lib/nocodb';
import { CAMPANHAS_TABLE_ID, DISPAROS_TABLE_ID } from '@/lib/constants';

export type CampanhaTipo = 'reengajamento' | 'cupom' | 'pos_pedido' | 'horario' | 'data_especial' | 'produto_destaque';

export interface CampanhaConfig {
    id: number;
    empresa_id: string;
    tipo: CampanhaTipo;
    ativo: boolean;
    nome: string;
    gatilho_dias?: number;
    horario_envio?: string;
    dias_semana?: string[];
    desconto_percentual?: number;
    variante_1: string;
    variante_2?: string;
    variante_3?: string;
    variante_4?: string;
    max_envios_semana: number;
    criado_em: string;
    atualizado_em: string;
}

export interface CampanhaFormData {
    tipo: CampanhaTipo;
    ativo: boolean;
    nome: string;
    gatilho_dias?: number;
    horario_envio?: string;
    dias_semana?: string[];
    desconto_percentual?: number;
    variante_1: string;
    variante_2?: string;
    variante_3?: string;
    variante_4?: string;
    max_envios_semana: number;
}

export interface DisparoLog {
    id: number;
    empresa_id: string;
    campanha_id: number;
    cliente_id: number;
    telefone: string;
    variante_usada: number;
    mensagem_enviada: string;
    status: 'enviado' | 'erro' | 'ignorado';
    erro_detalhe?: string;
    enviado_em: string;
}

export interface DisparoStats {
    total_enviados: number;
    total_erros: number;
    total_clientes_alcancados: number;
}

export async function getCampanhas(): Promise<CampanhaConfig[]> {
    try {
        const user = await requireAdmin();

        if (!CAMPANHAS_TABLE_ID) {
            console.warn('NOCODB_TABLE_CAMPANHAS não configurado');
            return [];
        }

        const data = await noco.list(CAMPANHAS_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})`,
            sort: '-id',
            limit: 100,
        });

        return (data.list || []).map((c: any) => ({
            ...c,
            id: c.id || c.Id,
            dias_semana: c.dias_semana ? JSON.parse(c.dias_semana) : undefined
        }));
    } catch (error) {
        console.error('getCampanhas error:', error);
        return [];
    }
}

export async function createCampanha(data: CampanhaFormData): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
        const user = await requireAdmin();

        if (!CAMPANHAS_TABLE_ID) throw new Error('NOCODB_TABLE_CAMPANHAS não configurado');

        const payload = {
            empresa_id: user.empresaId,
            ...data,
            dias_semana: data.dias_semana ? JSON.stringify(data.dias_semana) : undefined,
            max_envios_semana: data.max_envios_semana || 2,
        };

        const result = await noco.create(CAMPANHAS_TABLE_ID, payload);

        revalidatePath('/dashboard/campanhas');
        return { success: true, data: result };
    } catch (error: any) {
        console.error('createCampanha error:', error);
        return { success: false, error: error.message || 'Erro ao criar campanha' };
    }
}

export async function updateCampanha(id: number, data: Partial<CampanhaFormData>): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAdmin();

        if (!CAMPANHAS_TABLE_ID) throw new Error('NOCODB_TABLE_CAMPANHAS não configurado');

        const payload = {
            ...data,
            dias_semana: data.dias_semana ? JSON.stringify(data.dias_semana) : undefined,
        };

        await noco.update(CAMPANHAS_TABLE_ID, { ...payload, id });

        revalidatePath('/dashboard/campanhas');
        return { success: true };
    } catch (error: any) {
        console.error('updateCampanha error:', error);
        return { success: false, error: error.message || 'Erro ao atualizar campanha' };
    }
}

export async function deleteCampanha(id: number): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAdmin();

        if (!CAMPANHAS_TABLE_ID) throw new Error('NOCODB_TABLE_CAMPANHAS não configurado');

        await noco.delete(CAMPANHAS_TABLE_ID, id);

        revalidatePath('/dashboard/campanhas');
        return { success: true };
    } catch (error: any) {
        console.error('deleteCampanha error:', error);
        return { success: false, error: error.message || 'Erro ao excluir campanha' };
    }
}

export async function toggleCampanha(id: number, ativo: boolean): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAdmin();

        if (!CAMPANHAS_TABLE_ID) throw new Error('NOCODB_TABLE_CAMPANHAS não configurado');

        await noco.update(CAMPANHAS_TABLE_ID, { id, ativo });

        revalidatePath('/dashboard/campanhas');
        return { success: true };
    } catch (error: any) {
        console.error('toggleCampanha error:', error);
        return { success: false, error: error.message || 'Erro ao alternar campanha' };
    }
}

export async function getDisparos(campanhaId?: number): Promise<DisparoLog[]> {
    try {
        const user = await requireAdmin();

        if (!DISPAROS_TABLE_ID) {
            console.warn('NOCODB_TABLE_DISPAROS não configurado');
            return [];
        }

        let where = `(empresa_id,eq,${user.empresaId})`;
        if (campanhaId) {
            where += `~and(campanha_id,eq,${campanhaId})`;
        }

        const data = await noco.list(DISPAROS_TABLE_ID, {
            where,
            sort: '-enviado_em',
            limit: 100,
        });

        return (data.list || []).map((d: any) => ({
            ...d,
            id: d.id || d.Id
        }));
    } catch (error) {
        console.error('getDisparos error:', error);
        return [];
    }
}

export async function getDisparosStats(): Promise<DisparoStats> {
    try {
        const user = await requireAdmin();

        if (!DISPAROS_TABLE_ID) {
            return { total_enviados: 0, total_erros: 0, total_clientes_alcancados: 0 };
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const data = await noco.list(DISPAROS_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})~and(enviado_em,gt,${thirtyDaysAgo.toISOString()})`,
        });

        const disparos = data.list || [];

        const total_enviados = disparos.filter((d: any) => d.status === 'enviado').length;
        const total_erros = disparos.filter((d: any) => d.status === 'erro').length;

        const uniqueClientes = new Set(
            disparos
                .filter((d: any) => d.status === 'enviado')
                .map((d: any) => d.cliente_id)
        );

        return {
            total_enviados,
            total_erros,
            total_clientes_alcancados: uniqueClientes.size
        };
    } catch (error) {
        console.error('getDisparosStats error:', error);
        return { total_enviados: 0, total_erros: 0, total_clientes_alcancados: 0 };
    }
}

export async function getCampanhasParaN8N(empresaId: string, apiKey: string): Promise<CampanhaConfig[]> {
    try {
        if (apiKey !== process.env.N8N_WEBHOOK_SECRET) {
            throw new Error('API key inválida');
        }

        if (!CAMPANHAS_TABLE_ID) return [];

        const data = await noco.list(CAMPANHAS_TABLE_ID, {
            where: `(empresa_id,eq,${empresaId})~and(ativo,eq,true)`,
            limit: 100,
        });

        return (data.list || []).map((c: any) => ({
            ...c,
            id: c.id || c.Id,
            dias_semana: c.dias_semana ? JSON.parse(c.dias_semana) : undefined
        }));
    } catch (error) {
        console.error('getCampanhasParaN8N error:', error);
        return [];
    }
}

export async function registrarDisparo(data: {
    empresaId: string;
    campanhaId: number;
    clienteId: number;
    telefone: string;
    varianteUsada: number;
    mensagemEnviada: string;
    status: 'enviado' | 'erro' | 'ignorado';
    erroDetalhe?: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        if (!DISPAROS_TABLE_ID) throw new Error('NOCODB_TABLE_DISPAROS não configurado');

        const payload = {
            empresa_id: data.empresaId,
            campanha_id: data.campanhaId,
            cliente_id: data.clienteId,
            telefone: data.telefone,
            variante_usada: data.varianteUsada,
            mensagem_enviada: data.mensagemEnviada,
            status: data.status,
            erro_detalhe: data.erroDetalhe || null,
            enviado_em: new Date().toISOString(),
        };

        await noco.create(DISPAROS_TABLE_ID, payload);

        revalidatePath('/dashboard/campanhas');
        return { success: true };
    } catch (error: any) {
        console.error('registrarDisparo error:', error);
        return { success: false, error: error.message || 'Erro ao registrar disparo' };
    }
}
