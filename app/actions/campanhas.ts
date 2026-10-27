'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session-server';
import { pg } from '@/lib/postgres';
import { getErrorMessage } from '@/lib/errors';

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
    cliente_nome?: string;
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

type CampanhaRow = Omit<CampanhaConfig, 'dias_semana'> & {
    dias_semana?: string | string[] | null;
};

export interface CampanhaResultado {
    detalhes?: string;
    motivo?: string;
    [key: string]: unknown;
}

function parseDiasSemana(value: CampanhaRow['dias_semana']): string[] | undefined {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    try {
        const parsed: unknown = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String) : undefined;
    } catch {
        return undefined;
    }
}

function toCampanhaConfig(row: CampanhaRow): CampanhaConfig {
    return { ...row, dias_semana: parseDiasSemana(row.dias_semana) };
}

export async function getCampanhas(): Promise<CampanhaConfig[]> {
    try {
        const user = await requireAdmin();

        const data = await pg.list<CampanhaRow>('campanhas_config', {
            where: { empresa_id: user.empresaId },
            sort: '-id',
            limit: 100,
        });

        return (data.list || []).map(toCampanhaConfig);
    } catch (error) {
        console.error('getCampanhas error:', error);
        return [];
    }
}

export async function createCampanha(data: CampanhaFormData): Promise<{ success: boolean; data?: CampanhaConfig; error?: string }> {
    try {
        const user = await requireAdmin();

        const payload = {
            empresa_id: user.empresaId,
            ...data,
            dias_semana: data.dias_semana ? JSON.stringify(data.dias_semana) : undefined,
            max_envios_semana: data.max_envios_semana || 2,
        };

        const result = await pg.create<CampanhaRow>('campanhas_config', payload);

        revalidatePath('/dashboard/marketing');
        return { success: true, data: toCampanhaConfig(result) };
    } catch (error) {
        console.error('createCampanha error:', error);
        return { success: false, error: getErrorMessage(error, 'Erro ao criar campanha') };
    }
}

export async function updateCampanha(id: number, data: Partial<CampanhaFormData>): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAdmin();

        const payload = {
            ...data,
            dias_semana: data.dias_semana ? JSON.stringify(data.dias_semana) : undefined,
        };

        await pg.update('campanhas_config', id, payload);

        revalidatePath('/dashboard/marketing');
        return { success: true };
    } catch (error) {
        console.error('updateCampanha error:', error);
        return { success: false, error: getErrorMessage(error, 'Erro ao atualizar campanha') };
    }
}

export async function deleteCampanha(id: number): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAdmin();

        await pg.delete('campanhas_config', id);

        revalidatePath('/dashboard/marketing');
        return { success: true };
    } catch (error) {
        console.error('deleteCampanha error:', error);
        return { success: false, error: getErrorMessage(error, 'Erro ao excluir campanha') };
    }
}

export async function toggleCampanha(id: number, ativo: boolean): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAdmin();

        await pg.update('campanhas_config', id, { ativo });

        revalidatePath('/dashboard/marketing');
        return { success: true };
    } catch (error) {
        console.error('toggleCampanha error:', error);
        return { success: false, error: getErrorMessage(error, 'Erro ao alternar campanha') };
    }
}

export async function getDisparos(campanhaId?: number): Promise<DisparoLog[]> {
    try {
        const user = await requireAdmin();

        // Query com JOIN para trazer nome do cliente
        let query = `
            SELECT 
                d.*,
                c.nome as cliente_nome
            FROM campanhas_disparos d
            LEFT JOIN clientes c ON c.id = d.cliente_id
            WHERE d.empresa_id = $1
        `;
        const params: unknown[] = [user.empresaId];
        
        if (campanhaId) {
            query += ` AND d.campanha_id = $2`;
            params.push(campanhaId);
        }
        
        query += ` ORDER BY d.enviado_em DESC LIMIT 100`;

        const result = await pg.query<DisparoLog>(query, params);

        return (result.rows || []).map((d) => ({
            ...d,
            cliente_nome: d.cliente_nome || undefined,
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

        const result = await pg.query<Pick<DisparoLog, 'status' | 'cliente_id'>>(
            `SELECT status, cliente_id FROM campanhas_disparos WHERE empresa_id = $1 AND enviado_em > $2`,
            [user.empresaId, dataStr]
        );

        const disparos = result.rows || [];
        const enviados = disparos.filter((d) => d.status === 'enviado');

        const total_enviados = enviados.length;
        const total_erros = disparos.filter((d) => d.status === 'erro').length;

        const uniqueClientes = new Set(enviados.map((d) => d.cliente_id));

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

        const data = await pg.query<CampanhaRow>(
            `SELECT * FROM campanhas_config WHERE empresa_id = $1 AND ativo = true LIMIT 100`,
            [empresaId]
        );

        return (data.rows || []).map(toCampanhaConfig);
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

        await pg.create('campanhas_disparos', payload);

        revalidatePath('/dashboard/marketing');
        return { success: true };
    } catch (error) {
        console.error('registrarDisparo error:', error);
        return { success: false, error: getErrorMessage(error, 'Erro ao registrar disparo') };
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
    resultados?: CampanhaResultado[];
    error?: string 
}> {
    try {
        console.log('[dispararCampanhasManual] Iniciando disparo manual...');
        
        const { executarDisparoCampanhas } = await import('@/lib/campanhas-service');
        
        // Disparo manual ignora horario (ignorarHorario = true)
        const result = await executarDisparoCampanhas(true);
        
        console.log('[dispararCampanhasManual] Resultado:', JSON.stringify(result, null, 2));
        
        revalidatePath('/dashboard/marketing');
        
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
    } catch (error) {
        console.error('[dispararCampanhasManual] Erro:', error);
        return { success: false, error: getErrorMessage(error, 'Erro ao disparar campanhas') };
    }
}
