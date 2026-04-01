'use server';

import { cookies } from 'next/headers';
import { decrypt } from '@/lib/session';
import { HorarioSchema } from '@/lib/validations';
import { z } from 'zod';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const HORARIOS_TABLE_ID = 'm6jqxzkwfw6o4ga';

// Schema para array de horários
const HorariosArraySchema = z.array(HorarioSchema).min(1, 'Adicione pelo menos um horário');

async function nocoFetch(tableId: string, endpoint: string, options: RequestInit = {}) {
    try {
        const res = await fetch(`${NOCODB_URL}/api/v2/tables/${tableId}${endpoint}`, {
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
            console.error(`NocoDB Error: ${res.status}`, text);
            return null;
        }
        return res;
    } catch (err) {
        console.error('NocoDB Exception:', err);
        return null;
    }
}

export type HorarioItem = {
    dia_semana: number;    // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
    hora_abertura: string; // "HH:mm"
    hora_fechamento: string; // "HH:mm"
    fechado_o_dia_todo?: boolean;
};

export async function saveHorariosFuncionamento(horarios: HorarioItem[], nomeEmpresa: string) {
    try {
        const sessionValue = (await cookies()).get('session')?.value;
        if (!sessionValue) return { error: 'Não autorizado' };

        const payload = await decrypt(sessionValue);
        if (!payload) return { error: 'Sessão inválida' };

        // Validação com Zod
        const validated = HorariosArraySchema.safeParse(horarios);
        if (!validated.success) {
            const errorMsg = validated.error.issues.map((issue: any) => issue.message).join(', ');
            return { error: `Dados inválidos: ${errorMsg}` };
        }

        const empresaId = payload.empresaId;

        // Busca registros existentes para deletar
        const existing = await nocoFetch(HORARIOS_TABLE_ID, `/records?where=(empresa_id,eq,${empresaId})`);
        if (existing) {
            const data = await existing.json();

            // Deleta registros existentes
            if (data.list && data.list.length > 0) {
                const idsToDelete = data.list.map((r: { id: number }) => ({ id: r.id }));
                await nocoFetch(HORARIOS_TABLE_ID, '/records', {
                    method: 'DELETE',
                    body: JSON.stringify(idsToDelete),
                });
            }
        }

        // Insere os novos horários validados
        const records = validated.data.map(h => ({
            empresa_id: empresaId,
            nome_empresa: nomeEmpresa,
            dia_semana: h.dia_semana,
            hora_abertura: h.hora_abertura,
            hora_fechamento: h.hora_fechamento,
            fechado_o_dia_todo: h.fechado_o_dia_todo,
        }));

        const insertRes = await nocoFetch(HORARIOS_TABLE_ID, '/records', {
            method: 'POST',
            body: JSON.stringify(records),
        });

        if (!insertRes) {
            return { error: 'Erro ao inserir horários no NocoDB' };
        }

        return { success: true };
    } catch (err: any) {
        console.error('saveHorariosFuncionamento ERROR:', err);
        return { error: 'Erro ao salvar horários: ' + (err?.message || 'desconhecido') };
    }
}

export async function getHorariosFuncionamento() {
    const sessionValue = (await cookies()).get('session')?.value;
    if (!sessionValue) return { error: 'Não autorizado', horarios: [] };

    const payload = await decrypt(sessionValue);
    if (!payload) return { error: 'Sessão inválida', horarios: [] };

    const empresaId = payload.empresaId;
    const res = await nocoFetch(HORARIOS_TABLE_ID, `/records?where=(empresa_id,eq,${empresaId})&sort=dia_semana`);
    if (!res) return { error: 'Erro ao buscar horários', horarios: [] };

    const data = await res.json();
    return { horarios: data.list || [] };
}
