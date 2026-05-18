'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session-server';
import { pg } from '@/lib/postgres';

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

        const data = await pg.list('campanhas', {
            where: { empresa_id: user.empresaId },
            sort: '-id',
            limit: 100,
        });

        return (data.list || []).map((c: any) => ({
            ...c,
            id: c.id,
            dias_semana: c.dias_semana ? (typeof c.dias_semana === 'string' ? JSON.parse(c.dias_semana) : c.dias_semana) : undefined
        }));
    } catch (error) {
        console.error('getCampanhas error:', error);
        return [];
    }
}

export async function createCampanha(data: CampanhaFormData): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
        const user = await requireAdmin();

        const payload = {
            empresa_id: user.empresaId,
            ...data,
            dias_semana: data.dias_semana ? JSON.stringify(data.dias_semana) : undefined,
            max_envios_semana: data.max_envios_semana || 2,
        };

        const result = await pg.create('campanhas', payload);

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

        const payload = {
            ...data,
            dias_semana: data.dias_semana ? JSON.stringify(data.dias_semana) : undefined,
        };

        await pg.update('campanhas', id, payload);

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

        await pg.delete('campanhas', id);

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

        await pg.update('campanhas', id, { ativo });

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

        const where: any = { empresa_id: user.empresaId };
        if (campanhaId) {
            where.campanha_id = campanhaId;
        }

        const data = await pg.list('disparos', {
            where,
            sort: '-enviado_em',
            limit: 100,
        });

        return (data.list || []).map((d: any) => ({
            ...d,
            id: d.id
        }));
    } catch (error) {
        console.error('getDisparos error:', error);
        return [];
    }
}

export async function getDisparosStats(): Promise<DisparoStats> {
    try {
        const user = await requireAdmin();

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dataStr = thirtyDaysAgo.toISOString();

        const result = await pg.query(
            `SELECT * FROM disparos WHERE empresa_id = $1 AND enviado_em > $2`,
            [user.empresaId, dataStr]
        );

        const disparos = result.rows || [];

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

        const data = await pg.query(
            `SELECT * FROM campanhas WHERE empresa_id = $1 AND ativo = true LIMIT 100`,
            [empresaId]
        );

        return (data.rows || []).map((c: any) => ({
            ...c,
            id: c.id,
            dias_semana: c.dias_semana ? (typeof c.dias_semana === 'string' ? JSON.parse(c.dias_semana) : c.dias_semana) : undefined
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

        await pg.create('disparos', payload);

        revalidatePath('/dashboard/campanhas');
        return { success: true };
    } catch (error: any) {
        console.error('registrarDisparo error:', error);
        return { success: false, error: error.message || 'Erro ao registrar disparo' };
    }
}

/**
 * Disparo manual de campanhas (executa a logica diretamente)
 */
export async function dispararCampanhasManual(): Promise<{ 
    success: boolean; 
    enviados?: number; 
    erros?: number;
    campanhas_processadas?: number;
    resultados?: any[];
    error?: string 
}> {
    try {
        console.log('[dispararCampanhasManual] Iniciando disparo manual...');
        
        const { executarDisparoCampanhas } = await import('@/lib/campanhas-service');
        
        // Disparo manual ignora horario (ignorarHorario = true)
        const result = await executarDisparoCampanhas(true);
        
        console.log('[dispararCampanhasManual] Resultado:', JSON.stringify(result, null, 2));
        
        revalidatePath('/dashboard/campanhas');
        
        if (!result.success) {
            return { 
                success: false, 
                error: result.error || 'Erro desconhecido no processamento'
            };
        }
        
        return { 
            success: true, 
            enviados: result.total_enviados || 0,
            erros: result.total_erros || 0,
            campanhas_processadas: result.campanhas_processadas || 0,
            resultados: result.resultados || []
        };
    } catch (error: any) {
        console.error('[dispararCampanhasManual] Erro:', error);
        return { success: false, error: error.message || 'Erro ao disparar campanhas' };
    }
}
