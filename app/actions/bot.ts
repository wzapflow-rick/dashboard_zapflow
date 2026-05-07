'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from '@/lib/session-server';
import { noco } from '@/lib/nocodb';
import { CLIENTES_TABLE_ID, BOT_CONFIG_TABLE_ID, EMPRESAS_TABLE_ID } from '@/lib/constants';

// ============================================================
// TIPOS PARA CONFIGURACAO DO BOT DE SAUDACAO
// ============================================================

export interface BotConfig {
    id?: number;
    empresa_id: number;
    bot_ativo: boolean;
    mensagem_1_ativa: boolean;
    mensagem_1_texto: string;
    mensagem_2_ativa: boolean;
    mensagem_2_texto: string;
    mensagem_3_ativa: boolean;
    mensagem_3_texto: string;
    delay_entre_mensagens: number;
    respeitar_horario_funcionamento: boolean;
    mensagem_fora_horario: string;
}

const DEFAULT_BOT_CONFIG: Omit<BotConfig, 'empresa_id'> = {
    bot_ativo: true,
    mensagem_1_ativa: true,
    mensagem_1_texto: 'Ola! Bem-vindo(a) ao nosso estabelecimento! Como posso ajudar voce hoje?',
    mensagem_2_ativa: true,
    mensagem_2_texto: 'Temos um cardapio digital completo para voce!',
    mensagem_3_ativa: true,
    mensagem_3_texto: 'Acesse nosso cardapio e faca seu pedido: {LINK_CARDAPIO}',
    delay_entre_mensagens: 2,
    respeitar_horario_funcionamento: false,
    mensagem_fora_horario: 'Ola! No momento estamos fechados. Confira nosso horario de funcionamento e acesse nosso cardapio: {LINK_CARDAPIO}',
};

// ============================================================
// FUNCOES DE CONFIGURACAO DO BOT DE SAUDACAO
// ============================================================

/**
 * Busca a configuracao do bot de saudacao da empresa logada
 */
export async function getBotConfig(): Promise<BotConfig | null> {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Nao autorizado');

        if (!BOT_CONFIG_TABLE_ID) {
            console.warn('[getBotConfig] BOT_CONFIG_TABLE_ID nao configurado');
            return { ...DEFAULT_BOT_CONFIG, empresa_id: user.empresaId };
        }

        const config = await noco.findOne<BotConfig>(BOT_CONFIG_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})`,
        });

        if (!config) {
            return { ...DEFAULT_BOT_CONFIG, empresa_id: user.empresaId };
        }

        return config;
    } catch (error) {
        console.error('[getBotConfig] Erro:', error);
        return null;
    }
}

/**
 * Salva a configuracao do bot de saudacao
 */
export async function saveBotConfig(config: Partial<BotConfig>): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Nao autorizado');

        if (!BOT_CONFIG_TABLE_ID) {
            return { success: false, error: 'BOT_CONFIG_TABLE_ID nao configurado. Adicione o ID da tabela nas variaveis de ambiente.' };
        }

        // Verifica se ja existe configuracao
        const existing = await noco.findOne<BotConfig>(BOT_CONFIG_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})`,
        });

        const dataToSave = {
            ...config,
            empresa_id: user.empresaId,
        };

        if (existing?.id) {
            await noco.update(BOT_CONFIG_TABLE_ID, {
                id: existing.id,
                ...dataToSave,
            });
        } else {
            await noco.create(BOT_CONFIG_TABLE_ID, dataToSave);
        }

        revalidatePath('/dashboard/settings');
        return { success: true };
    } catch (error: any) {
        console.error('[saveBotConfig] Erro:', error);
        return { success: false, error: error.message || 'Erro ao salvar configuracoes do bot' };
    }
}

/**
 * Busca o link do cardapio da empresa para substituir o placeholder
 */
export async function getCardapioLink(): Promise<string> {
    try {
        const user = await getMe();
        if (!user?.empresaId) return '';

        const empresa = await noco.findById<{ nome_fantasia: string }>(EMPRESAS_TABLE_ID, user.empresaId);
        if (!empresa?.nome_fantasia) return '';

        // Gera slug a partir do nome fantasia
        const slug = empresa.nome_fantasia
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        return `https://cardapio.wzapflow.com.br/loja/${slug}`;
    } catch (error) {
        console.error('[getCardapioLink] Erro:', error);
        return '';
    }
}

// ============================================================
// FUNCOES EXISTENTES (MODO ROBO POR CLIENTE)
// ============================================================

export async function toggleBotStatus(phone: string, botActive: boolean) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const client = await noco.findOne(CLIENTES_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})~and(telefone,eq,${phone})`,
        }) as any;

        if (!client) throw new Error('Cliente não encontrado');

        await noco.update(CLIENTES_TABLE_ID, {
            id: client.id,
            modo_robo: botActive
        });

        revalidatePath('/dashboard/customers');
        revalidatePath('/dashboard/customers/' + phone);

        return { success: true, botActive };
    } catch (error) {
        console.error('Error toggling bot status:', error);
        return { error: 'Falha ao alterar status do bot' };
    }
}

export async function getBotStatus(phone: string) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const client = await noco.findOne(CLIENTES_TABLE_ID, {
            where: `(empresa_id,eq,${user.empresaId})~and(telefone,eq,${phone})`,
        }) as any;

        return {
            botActive: client ? !!client.modo_robo : true
        };
    } catch (error) {
        console.error('Error getting bot status:', error);
        return { botActive: true };
    }
}
