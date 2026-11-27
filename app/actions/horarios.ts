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
        const empresaId = Number(user?.empresaId);
        if (!Number.isSafeInteger(empresaId) || empresaId <= 0) {
            return { error: 'Não autorizado' };
        }

        const validated = HorariosArraySchema.safeParse(horarios);
        if (!validated.success) {
            const errorMsg = validated.error.issues.map((issue: any) => issue.message).join(', ');
            return { error: `Dados inválidos: ${errorMsg}` };
        }

        const client = await pg.getClient();
        try {
            await client.query('BEGIN');
            // Serializa atualizações concorrentes da mesma loja para não misturar
            // horários de duas gravações simultâneas.
            await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [empresaId]);
            await client.query('DELETE FROM horarios WHERE empresa_id = $1', [empresaId]);

            const values: unknown[] = [];
            const rows = validated.data.map((h, index) => {
                const offset = index * 6;
                values.push(
                    empresaId,
                    nomeEmpresa,
                    h.dia_semana,
                    h.hora_abertura,
                    h.hora_fechamento,
                    h.fechado_o_dia_todo ?? false,
                );
                return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`;
            });

            await client.query(
                `INSERT INTO horarios (
                    empresa_id, nome_empresa, dia_semana, hora_abertura,
                    hora_fechamento, fechado_o_dia_todo
                ) VALUES ${rows.join(', ')}`,
                values,
            );
            await client.query('COMMIT');
            return { success: true };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
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
