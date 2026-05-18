'use server';

import { getMe } from '@/lib/session-server';
import { HorarioSchema } from '@/lib/validations';
import { z } from 'zod';
import { pg } from '@/lib/postgres';

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
        const existing = await pg.list('horarios', {
            where: { empresa_id: empresaId },
        });

        if (existing.list && existing.list.length > 0) {
            for (const r of existing.list) {
                await pg.delete('horarios', (r as any).id);
            }
        }

        // Inserir novos horários
        for (const h of validated.data) {
            await pg.create('horarios', {
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
        const data = await pg.list('horarios', {
            where: { empresa_id: user.empresaId },
            sort: 'dia_semana',
        });
        return { horarios: data.list || [] };
    } catch {
        return { error: 'Erro ao buscar horários', horarios: [] };
    }
}
