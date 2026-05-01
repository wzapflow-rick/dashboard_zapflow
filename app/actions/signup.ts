'use server';

import { noco } from '@/lib/nocodb';
import { 
  PENDING_SIGNUPS_TABLE_ID, 
  EMPRESAS_TABLE_ID, 
  ASSINATURAS_TABLE_ID,
  SUBSCRIPTION_PLANS,
  type SubscriptionPlanId
} from '@/lib/constants';
import bcrypt from 'bcryptjs';
import { encrypt } from '@/lib/session';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

// Helper para hash de senha
function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || '';

// ============================================================
// TIPOS
// ============================================================

interface CheckoutData {
  email: string;
  nome: string;
  telefone: string;
  plano: SubscriptionPlanId;
}

interface PendingSignup {
  id: number;
  token: string;
  email: string;
  nome: string;
  telefone: string;
  plano: string;
  mp_payment_id?: string;
  mp_subscription_id?: string;
  status: 'pending' | 'completed' | 'expired';
  criado_em: string;
  expira_em: string;
}

// ============================================================
// CRIAR SESSAO DE CHECKOUT
// ============================================================

export async function createCheckoutSession(data: CheckoutData) {
  try {
    const { email, nome, telefone, plano } = data;
    
    // Validacoes
    if (!email || !nome || !telefone || !plano) {
      return { success: false, error: 'Todos os campos sao obrigatorios' };
    }
    
    // Verificar se email ja existe
    const existingCompany = await noco.list(EMPRESAS_TABLE_ID, {
      where: `(email,eq,${email})`,
      limit: 1,
    });
    
    if (existingCompany?.list?.length > 0) {
      return { success: false, error: 'Este email ja esta cadastrado. Faca login.' };
    }
    
    // Buscar dados do plano
    const planKey = plano.toUpperCase() as keyof typeof SUBSCRIPTION_PLANS;
    const planData = SUBSCRIPTION_PLANS[planKey];
    
    if (!planData || planData.id === 'iniciante') {
      return { success: false, error: 'Plano invalido' };
    }
    
    // Gerar token unico
    const token = uuidv4();
    
    // Dados para external_reference (sera usado no webhook)
    const externalReference = JSON.stringify({
      token,
      email,
      nome,
      telefone,
      plano,
    });
    
    // Criar preferencia de pagamento no Mercado Pago
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://cardapio.wzapflow.com.br';
    
    const preference = {
      reason: `ZapFlow - Plano ${planData.name}`,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: planData.price,
        currency_id: 'BRL',
      },
      back_url: `${baseUrl}/ativar/${token}`,
      external_reference: externalReference,
      payer_email: email,
      status: 'pending',
    };
    
    // Criar assinatura no MP
    const response = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Signup] Erro MP:', errorData);
      return { success: false, error: 'Erro ao criar checkout' };
    }
    
    const mpData = await response.json();
    
    return {
      success: true,
      initPoint: mpData.init_point,
      token,
    };
    
  } catch (error: any) {
    console.error('[Signup] Erro:', error);
    return { success: false, error: 'Erro interno' };
  }
}

// ============================================================
// CRIAR PENDING SIGNUP (chamado pelo webhook)
// ============================================================

export async function createPendingSignup(data: {
  token: string;
  email: string;
  nome: string;
  telefone: string;
  plano: string;
  mp_payment_id?: string;
  mp_subscription_id?: string;
}) {
  try {
    if (!PENDING_SIGNUPS_TABLE_ID) {
      console.error('[Signup] PENDING_SIGNUPS_TABLE_ID nao configurado');
      return null;
    }
    
    // Calcular expiracao (24 horas)
    const expiraEm = new Date();
    expiraEm.setHours(expiraEm.getHours() + 24);
    
    const signup = await noco.create(PENDING_SIGNUPS_TABLE_ID, {
      token: data.token,
      email: data.email,
      nome: data.nome,
      telefone: data.telefone,
      plano: data.plano,
      mp_payment_id: data.mp_payment_id || null,
      mp_subscription_id: data.mp_subscription_id || null,
      status: 'pending',
      expira_em: expiraEm.toISOString(),
    });
    
    return signup;
  } catch (error) {
    console.error('[Signup] Erro ao criar pending signup:', error);
    return null;
  }
}

// ============================================================
// BUSCAR PENDING SIGNUP
// ============================================================

export async function getPendingSignup(token: string): Promise<PendingSignup | null> {
  try {
    if (!PENDING_SIGNUPS_TABLE_ID || !token) {
      return null;
    }
    
    const result = await noco.list(PENDING_SIGNUPS_TABLE_ID, {
      where: `(token,eq,${token})`,
      limit: 1,
    });
    
    const signup = result?.list?.[0];
    
    if (!signup) {
      return null;
    }
    
    // Verificar se expirou
    const expiraEm = new Date(signup.expira_em as string);
    if (expiraEm < new Date()) {
      // Marcar como expirado
      await noco.update(PENDING_SIGNUPS_TABLE_ID, {
        id: signup.id || signup.Id,
        status: 'expired',
      });
      return null;
    }
    
    // Verificar se ja foi usado
    if (signup.status === 'completed') {
      return null;
    }
    
    return signup as PendingSignup;
  } catch (error) {
    console.error('[Signup] Erro ao buscar pending signup:', error);
    return null;
  }
}

// ============================================================
// COMPLETAR SIGNUP (criar conta)
// ============================================================

export async function completeSignup(token: string, password: string) {
  try {
    // Buscar pending signup
    const signup = await getPendingSignup(token);
    
    if (!signup) {
      return { success: false, error: 'Link invalido ou expirado' };
    }
    
    // Validar senha
    if (!password || password.length < 6) {
      return { success: false, error: 'Senha deve ter no minimo 6 caracteres' };
    }
    
    // Hash da senha
    const hashedPassword = await hashPassword(password);
    
    // Criar empresa
    const empresa = await noco.create(EMPRESAS_TABLE_ID, {
      email: signup.email,
      senha_hash: hashedPassword,
      login: signup.email,
      senha: hashedPassword,
      password: password,
      nome_admin: signup.nome,
      nome_fantasia: signup.nome,
      telefone: signup.telefone,
      whatsapp: signup.telefone,
      status: 'ativo',
      nincho: 'Outros',
      instancia_evolution: '',
      planos: signup.plano,
    }) as any;
    
    if (!empresa?.id && !empresa?.Id) {
      return { success: false, error: 'Erro ao criar conta' };
    }
    
    const empresaId = empresa.id || empresa.Id;
    
    // Criar assinatura
    if (ASSINATURAS_TABLE_ID) {
      const planKey = signup.plano.toUpperCase() as keyof typeof SUBSCRIPTION_PLANS;
      const planData = SUBSCRIPTION_PLANS[planKey];
      
      await noco.create(ASSINATURAS_TABLE_ID, {
        empresa_id: empresaId,
        plano: signup.plano,
        status: 'authorized',
        valor: planData?.price || 0,
        mp_subscription_id: signup.mp_subscription_id || null,
        data_inicio: new Date().toISOString().split('T')[0],
      });
    }
    
    // Marcar pending signup como completo
    if (PENDING_SIGNUPS_TABLE_ID) {
      await noco.update(PENDING_SIGNUPS_TABLE_ID, {
        id: signup.id,
        status: 'completed',
      });
    }
    
    // Criar sessao (login automatico)
    const session = await encrypt({
      empresaId,
      email: signup.email,
      nome: signup.nome,
    });
    
    const cookieStore = await cookies();
    cookieStore.set('session', session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24, // 24 horas
      path: '/',
    });
    
    // Enviar mensagem de boas-vindas no WhatsApp
    try {
      const { sendWelcomeMessage } = await import('./whatsapp');
      await sendWelcomeMessage(signup.telefone, signup.nome, signup.email, signup.plano);
    } catch (waError) {
      console.error('[Signup] Erro ao enviar WhatsApp de boas-vindas:', waError);
    }
    
    return {
      success: true,
      empresaId,
      email: signup.email,
      nome: signup.nome,
      plano: signup.plano,
    };
    
  } catch (error: any) {
    console.error('[Signup] Erro ao completar:', error);
    return { success: false, error: 'Erro ao criar conta' };
  }
}
