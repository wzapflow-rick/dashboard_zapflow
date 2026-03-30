'use server';

import { cookies } from 'next/headers';
import { decrypt } from '@/lib/session';

const NOCODB_URL = process.env.NOCODB_URL || '';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || '';
const HORARIOS_TABLE_ID = 'm6jqxzkwfw6o4ga';

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

        const empresaId = payload.empresaId;
        console.log('=== saveHorariosFuncionamento ===');
        console.log('empresaId:', empresaId);
        console.log('nomeEmpresa:', nomeEmpresa);

        // Busca registros existentes para deletar
        // Filtra por empresa_id (campo que criamos no banco) ou nome_empresa (backup)
        const existing = await nocoFetch(HORARIOS_TABLE_ID, `/records?where=(empresa_id,eq,${empresaId})`);
        if (existing) {
            const data = await existing.json();
            console.log('Registros existentes:', data.list?.length || 0);

            // Deleta registros existentes
            if (data.list && data.list.length > 0) {
                const idsToDelete = data.list.map((r: { id: number }) => ({ id: r.id }));
                const delRes = await nocoFetch(HORARIOS_TABLE_ID, '/records', {
                    method: 'DELETE',
                    body: JSON.stringify(idsToDelete),
                });
                console.log('Delete status:', delRes?.status);
            }
        }

        // Insere os novos horários
        const records = horarios.map(h => ({
            empresa_id: empresaId,
            nome_empresa: nomeEmpresa,
            dia_semana: h.dia_semana,
            hora_abertura: h.hora_abertura,
            hora_fechamento: h.hora_fechamento,
            fechado_o_dia_todo: !!h.fechado_o_dia_todo,
        }));

        console.log('Inserindo', records.length, 'registros...');
        const insertRes = await nocoFetch(HORARIOS_TABLE_ID, '/records', {
            method: 'POST',
            body: JSON.stringify(records),
        });

        console.log('Insert status:', insertRes?.status);
        if (insertRes && !insertRes.ok) {
            console.log('Erro detalhado:', await insertRes.text());
        }

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
