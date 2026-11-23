'use server';

import { revalidatePath } from 'next/cache';
import { getMe } from '@/lib/session-server';
import { pg } from '@/lib/postgres';
import { sendWhatsAppMessageFromInstance } from '@/lib/whatsapp';

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

        const config = await pg.findOne<BotConfig>('bot_config', {
            where: { empresa_id: user.empresaId },
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

        // Verifica se ja existe configuracao
        const existing = await pg.findOne<BotConfig>('bot_config', {
            where: { empresa_id: user.empresaId },
        });

        const dataToSave = {
            ...config,
            empresa_id: user.empresaId,
        };

        if (existing?.id) {
            await pg.update('bot_config', existing.id, dataToSave);
        } else {
            await pg.create('bot_config', dataToSave);
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

        const empresa = await pg.findById<{ nome_fantasia: string }>('empresas', user.empresaId);
        if (!empresa?.nome_fantasia) return '';

        // Gera slug a partir do nome fantasia
        const slug = empresa.nome_fantasia
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        return `https://cardapio.wzapflow.com.br/menu/${slug}`;
    } catch (error) {
        console.error('[getCardapioLink] Erro:', error);
        return '';
    }
}

/**
 * Envia as mensagens configuradas do bot para um número de teste.
 * A ação é restrita ao admin e não cria/atualiza cooldown nem histórico
 * de saudação, permitindo testar novamente sem esperar o intervalo normal.
 */
export async function testBotGreeting(phone: string): Promise<{
    success: boolean;
    sent: number;
    total: number;
    error?: string;
}> {
    try {
        const user = await getMe();
        if (!user?.empresaId || user.role !== 'admin') {
            return { success: false, sent: 0, total: 0, error: 'Não autorizado' };
        }

        const digits = String(phone || '').replace(/\\D/g, '');
        if (digits.length < 10 || digits.length > 15) {
            return { success: false, sent: 0, total: 0, error: 'Informe um telefone válido com DDD.' };
        }

        const [config, empresa] = await Promise.all([
            getBotConfig(),
            pg.findById<{ id: number; nome_fantasia?: string; nome?: string; instancia_evolution?: string | null }>(
                'empresas',
                user.empresaId,
            ),
        ]);

        if (!config) {
            return { success: false, sent: 0, total: 0, error: 'Não foi possível carregar a configuração do bot.' };
        }
        if (!config.bot_ativo) {
            return { success: false, sent: 0, total: 0, error: 'Ative o bot antes de testar a saudação.' };
        }
        if (!empresa) {
            return { success: false, sent: 0, total: 0, error: 'Empresa não encontrada.' };
        }

        const instanceName = empresa.instancia_evolution || `zapflow_${user.empresaId}`;
        const slug = (empresa.nome_fantasia || empresa.nome || 'loja')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\\u0300-\\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        const menuUrl = `https://cardapio.wzapflow.com.br/menu/${slug}`;
        const processMessage = (text: string) => text
            .replace('{LINK_CARDAPIO}', menuUrl)
            .replace(/\\/loja\\//g, '/menu/');

        const messages = [
            config.mensagem_1_ativa && config.mensagem_1_texto ? processMessage(config.mensagem_1_texto) : '',
            config.mensagem_2_ativa && config.mensagem_2_texto ? processMessage(config.mensagem_2_texto) : '',
            config.mensagem_3_ativa && config.mensagem_3_texto ? processMessage(config.mensagem_3_texto) : '',
        ].filter(Boolean);

        if (messages.length === 0) {
            return { success: false, sent: 0, total: 0, error: 'Não há mensagens ativas configuradas para testar.' };
        }

        let sent = 0;
        let lastError: string | undefined;
        for (let index = 0; index < messages.length; index++) {
            const result = await sendWhatsAppMessageFromInstance(phone, messages[index], instanceName);
            if (result.success) {
                sent++;
            } else {
                lastError = result.error || 'Falha ao enviar mensagem de teste.';
                console.error(`[Bot Test] Falha na mensagem ${index + 1}/${messages.length} via ${instanceName}:`, lastError);
            }

            const delayMs = Math.min(Math.max(Number(config.delay_entre_mensagens) || 2, 1), 10) * 1000;
            if (index < messages.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }

        return sent === messages.length
            ? { success: true, sent, total: messages.length }
            : { success: false, sent, total: messages.length, error: lastError || 'Uma ou mais mensagens não foram enviadas.' };
    } catch (error: any) {
        console.error('[testBotGreeting] Erro:', error);
        return { success: false, sent: 0, total: 0, error: error.message || 'Erro ao testar a saudação.' };
    }
}

// ============================================================
// FUNCOES EXISTENTES (MODO ROBO POR CLIENTE)
// ============================================================

export async function toggleBotStatus(phone: string, botActive: boolean) {
    try {
        const user = await getMe();
        if (!user?.empresaId) throw new Error('Não autorizado');

        const client = await pg.findOne('clientes', {
            where: { empresa_id: user.empresaId, telefone: phone },
        }) as any;

        if (!client) throw new Error('Cliente não encontrado');

        await pg.update('clientes', client.id, {
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

        const client = await pg.findOne('clientes', {
            where: { empresa_id: user.empresaId, telefone: phone },
        }) as any;

        return {
            botActive: client ? !!client.modo_robo : true
        };
    } catch (error) {
        console.error('Error getting bot status:', error);
        return { botActive: true };
    }
}
