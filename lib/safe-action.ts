import { getMe } from '@/app/actions/auth';
import { z } from 'zod';

export type ActionResponse<T> =
    | { success: true; data: T }
    | { success: false; error: string; validationErrors?: Record<string, string[]> };

/**
 * Wrapper para garantir que a action é executada por um usuário autenticado
 * e injeta o empresaId automaticamente.
 */
export async function authenticatedAction<TInput, TOutput>(
    schema: z.ZodSchema<TInput>,
    action: (data: TInput, empresaId: number) => Promise<TOutput>
): Promise<ActionResponse<TOutput>> {
    try {
        const user = await getMe();

        if (!user || !user.empresaId) {
            return { success: false, error: 'Sessão expirada ou não autorizado' };
        }

        return { success: true, data: await action({} as TInput, Number(user.empresaId)) };
    } catch (error: any) {
        console.error('Action Error:', error);
        return { success: false, error: error.message || 'Erro interno no servidor' };
    }
}

// Versão simplificada para validação de dados com esquema
export async function validateAndExecute<TInput, TOutput>(
    schema: z.ZodSchema<TInput>,
    input: unknown,
    action: (data: TInput) => Promise<TOutput>
): Promise<ActionResponse<TOutput>> {
    const result = schema.safeParse(input);

    if (!result.success) {
        const validationErrors = result.error.flatten().fieldErrors as Record<string, string[]>;
        return { success: false, error: 'Dados inválidos', validationErrors };
    }

    try {
        const data = await action(result.data);
        return { success: true, data };
    } catch (error: any) {
        console.error('Validation & Execution Error:', error);
        return { success: false, error: error.message || 'Erro ao processar requisição' };
    }
}
