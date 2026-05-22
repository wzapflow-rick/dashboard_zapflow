'use server';

import { pg } from '@/lib/postgres';
import bcrypt from 'bcryptjs';
import { encrypt } from '@/lib/session';
import { cookies } from 'next/headers';
import { createAssinatura } from '@/lib/assinaturas';
import { notifyNewCompany, notifyError } from '@/lib/discord';

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

interface TrialAccountData {
  email: string;
  nome: string;
  telefone: string;
  password: string;
}

/**
 * Cria conta trial gratuita (Plano Parceria - 7 dias)
 */
export async function createTrialAccount(data: TrialAccountData) {
  try {
    const { email, nome, telefone, password } = data;
    
    if (!email || !nome || !telefone || !password) {
      return { success: false, error: 'Todos os campos sao obrigatorios' };
    }
    
    if (password.length < 6) {
      return { success: false, error: 'Senha deve ter no minimo 6 caracteres' };
    }
    
    const existingCompany = await pg.list('empresas', {
      where: { email },
      limit: 1,
    });
    
    if (existingCompany?.list?.length > 0) {
      return { success: false, error: 'Este email ja esta cadastrado. Faca login.' };
    }
    
    const hashedPassword = hashPassword(password);
    
    // Usar apenas colunas que existem na tabela empresas
    const empresa = await pg.create('empresas', {
      email: email,
      senha_hash: hashedPassword,
      login: email,
      nome_admin: nome,
      nome_fantasia: nome,
      telefone_loja: telefone,
      nincho: 'Outros',
      instancia_evolution: '',
      planos: 'parceria',
      ativo: true,
    }) as any;
    
    if (!empresa?.id) {
      return { success: false, error: 'Erro ao criar conta' };
    }
    
    const empresaId = empresa.id;
    
    try {
      const hoje = new Date();
      const fimTrial = new Date(hoje);
      fimTrial.setDate(fimTrial.getDate() + 7);
      
      console.log('[TrialSignup] Criando assinatura para empresa_id:', empresaId);
      
      await createAssinatura({
        empresa_id: empresaId,
        plano: 'start',
        status: 'authorized',
        valor: 0,
        mp_subscription_id: `trial_${empresaId}_${Date.now()}`,
        mp_preapproval_plan_id: 'start',
        data_inicio: hoje.toISOString(),
        data_proxima_cobranca: fimTrial.toISOString(),
        cartao_ultimos_digitos: 'TRIA',
        cartao_bandeira: 'TRIA',
      });
      
      console.log('[TrialSignup] Assinatura trial criada com sucesso');
    } catch (subError: any) {
      console.error('[TrialSignup] ERRO ao criar assinatura:', subError?.message || subError);
      console.log('[TrialSignup] Continuando sem assinatura - usuario pode assinar depois');
    }
    
    const session = await encrypt({
      userId: empresaId,
      email: email,
      empresaId,
      nome: nome,
      onboarded: false,
      controle_estoque: false,
      role: 'admin',
      source: 'empresa',
      bloqueado: false,
      plano: 'parceria',
    });
    
    const cookieStore = await cookies();
    const isProduction = process.env.NODE_ENV === 'production';
    cookieStore.set('session', session, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    });
    
    try {
      const { sendTrialWelcomeMessage } = await import('./whatsapp');
      await sendTrialWelcomeMessage(telefone, nome, email, password);
    } catch (waError) {
      console.error('[TrialSignup] Erro ao enviar WhatsApp:', waError);
    }
    
    // Notificar no Discord
    console.log('[TrialSignup] Notificando Discord sobre nova empresa...');
    try {
      await notifyNewCompany({
        empresaId,
        nomeFantasia: nome,
        email,
        telefone,
        plano: 'Trial - Parceria',
      });
      console.log('[TrialSignup] Notificacao Discord enviada!');
    } catch (discordError) {
      console.error('[TrialSignup] Erro ao notificar Discord:', discordError);
    }
    
    return {
      success: true,
      empresaId,
      email,
      nome,
      plano: 'parceria',
    };
    
  } catch (error: any) {
    console.error('[TrialSignup] Erro:', error);
    
    // Notificar erro no Discord
    await notifyError({
      titulo: 'Erro ao Criar Conta Trial',
      erro: error.message || String(error),
      local: 'createTrialAccount (signup-trial.ts)',
      detalhes: `Email: ${data.email}`,
    });
    
    return { success: false, error: 'Erro ao criar conta' };
  }
}
