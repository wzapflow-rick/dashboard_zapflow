'use server';

import { getMe } from '@/lib/session-server';
import { HorarioSchema } from '@/lib/validations';
import { z } from 'zod';
import { noco } from '@/lib/nocodb';
import { HORARIOS_TABLE_ID } from '@/lib/constants';

const HorariosArraySchema = z.array(HorarioSchema).min(1, 'Adicione pelo menos um horário');

export type HorarioItem = {
    dia_semana: number;
    hora_abertura: string;
    hora_fechamento: string;
    fechado_o_dia_todo?: boolean;
};

export async function saveHorariosFuncionamento(horarios: HorarioItem[], nomeEmpresa: string) {
    try {
        const user = await getMe();
        if (!user) return { error: 'Não autorizado' };

        const validated = HorariosArraySchema.safeParse(horarios);
        if (!validated.success) {
            const errorMsg = validated.error.issues.map((issue: any) => issue.message).join(', ');
            return { error: `Dados inválidos: ${errorMsg}` };
        }

        const empresaId = user.empresaId;

        // Deletar registros existentes
        const existing = await noco.list(HORARIOS_TABLE_ID, {
            where: `(empresa_id,eq,${empresaId})`,
        });

        if (existing.list && existing.list.length > 0) {
            for (const r of existing.list) {
                await noco.delete(HORARIOS_TABLE_ID, (r as any).id || (r as any).Id);
            }
        }

        // Inserir novos horários
        for (const h of validated.data) {
            await noco.create(HORARIOS_TABLE_ID, {
                empresa_id: empresaId,
                nome_empresa: nomeEmpresa,
                dia_semana: h.dia_semana,
                hora_abertura: h.hora_abertura,
                hora_fechamento: h.hora_fechamento,
                fechado_o_dia_todo: h.fechado_o_dia_todo,
            });
        }

        return { success: true };
    } catch (err: any) {
        console.error('saveHorariosFuncionamento ERROR:', err);
        return { error: 'Erro ao salvar horários: ' + (err?.message || 'desconhecido') };
    }
}

export async function getHorariosFuncionamento() {
    const user = await getMe();
    if (!user) return { error: 'Não autorizado', horarios: [] };

    try {
        const data = await noco.list(HORARIOS_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})`,
            sort: 'dia_semana',
        });
        return { horarios: data.list || [] };
    } catch {
        return { error: 'Erro ao buscar horários', horarios: [] };
    }
}
