'use server';

import { pg } from '@/lib/postgres';
import db from '@/lib/db';
import { 
  SUBSCRIPTION_PLANS,
  type SubscriptionPlanId
} from '@/lib/constants';
import bcrypt from 'bcryptjs';
import { encrypt } from '@/lib/session';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { setupEvolutionInstance } from './evolution';

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
  console.log('[v0] createCheckoutSession iniciado:', JSON.stringify(data));
  
  try {
    const { email, nome, telefone, plano } = data;
    
    if (!email || !nome || !telefone || !plano) {
      console.log('[v0] Campos faltando em createCheckoutSession');
      return { success: false, error: 'Todos os campos sao obrigatorios' };
    }
    
    console.log('[v0] Verificando email existente:', email);
    
    const existingCompany = await pg.list('empresas', {
      where: { email },
      limit: 1,
    });
    
    console.log('[v0] Resultado busca email:', existingCompany?.list?.length || 0);
    
    if (existingCompany?.list?.length > 0) {
      return { success: false, error: 'Este email ja esta cadastrado. Faca login.' };
    }
    
    const planKey = plano.toUpperCase() as keyof typeof SUBSCRIPTION_PLANS;
    const planData = SUBSCRIPTION_PLANS[planKey];
    
    if (!planData || planData.id === 'iniciante') {
      return { success: false, error: 'Plano invalido' };
    }
    
    const token = uuidv4();
    
    const externalReference = JSON.stringify({
      token,
      email,
      nome,
      telefone,
      plano,
    });
    
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
    
    console.log('[v0] Criando assinatura no MP com preference:', JSON.stringify(preference));
    console.log('[v0] MP_ACCESS_TOKEN presente:', !!MP_ACCESS_TOKEN);
    
    const response = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    });
    
    console.log('[v0] Resposta MP status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[v0] Erro MP detalhado:', JSON.stringify(errorData));
      return { success: false, error: 'Erro ao criar checkout' };
    }
    
    const mpData = await response.json();
    console.log('[v0] MP Data success:', JSON.stringify(mpData));
    
    return {
      success: true,
      initPoint: mpData.init_point,
      token,
      tipo: 'cartao',
    };
    
  } catch (error: any) {
    console.error('[Signup] Erro:', error);
    return { success: false, error: 'Erro interno' };
  }
}

// ============================================================
// CRIAR CHECKOUT PIX (PAGAMENTO UNICO MENSAL)
// ============================================================

export async function createPixCheckoutSession(data: CheckoutData) {
  console.log('[v0] createPixCheckoutSession iniciado:', JSON.stringify(data));
  
  try {
    const { email, nome, telefone, plano } = data;
    
    if (!email || !nome || !telefone || !plano) {
      return { success: false, error: 'Todos os campos sao obrigatorios' };
    }
    
    const existingCompany = await pg.list('empresas', {
      where: { email },
      limit: 1,
    });
    
    if (existingCompany?.list?.length > 0) {
      return { success: false, error: 'Este email ja esta cadastrado. Faca login.' };
    }
    
    const planKey = plano.toUpperCase() as keyof typeof SUBSCRIPTION_PLANS;
    const planData = SUBSCRIPTION_PLANS[planKey];
    
    if (!planData || planData.id === 'iniciante') {
      return { success: false, error: 'Plano invalido' };
    }
    
    const token = uuidv4();
    
    const externalReference = JSON.stringify({
      token,
      email,
      nome,
      telefone,
      plano,
      tipo: 'pix',
    });
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://cardapio.wzapflow.com.br';
    
    const preference = {
      items: [
        {
          title: `ZapFlow - Plano ${planData.name}`,
          quantity: 1,
          unit_price: planData.price,
          currency_id: 'BRL',
        },
      ],
      payer: {
        email: email,
        first_name: nome,
      },
      payment_methods: {
        excluded_payment_types: [
          { id: 'credit_card' },
          { id: 'debit_card' },
          { id: 'ticket' },
        ],
        default_payment_method_id: 'pix',
      },
      external_reference: externalReference,
      back_urls: {
        success: `${baseUrl}/ativar/${token}`,
        failure: `${baseUrl}/?payment=failure`,
        pending: `${baseUrl}/?payment=pending`,
      },
      auto_return: 'approved',
      notification_url: `${baseUrl}/api/webhooks/mercadopago`,
    };
    
    console.log('[v0] Criando PIX no MP:', JSON.stringify(preference));
    
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    });
    
    console.log('[v0] Resposta MP PIX status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[v0] Erro MP PIX detalhado:', JSON.stringify(errorData));
      return { success: false, error: 'Erro ao criar checkout PIX' };
    }
    
    const mpData = await response.json();
    console.log('[v0] MP PIX Data success:', JSON.stringify(mpData));
    
    return {
      success: true,
      initPoint: mpData.init_point,
      token,
      tipo: 'pix',
    };
    
  } catch (error: any) {
    console.error('[Signup] Erro PIX:', error);
    return { success: false, error: 'Erro interno' };
  }
}

// ============================================================
// CRIAR CONTA TRIAL (PARCERIA - 7 dias gratis)
// ============================================================

export async function createTrialAccount(data: {
  email: string;
  nome: string;
  telefone: string;
  senha: string;
}) {
  console.log('[v0] createTrialAccount iniciado:', data.email);
  
  try {
    const { email, nome, telefone, senha } = data;
    
    if (!email || !nome || !telefone || !senha) {
      return { success: false, error: 'Todos os campos sao obrigatorios' };
    }
    
    if (senha.length < 6) {
      return { success: false, error: 'Senha deve ter no minimo 6 caracteres' };
    }
    
    const existingCompany = await pg.list('empresas', {
      where: { email },
      limit: 1,
    });
    
    if (existingCompany?.list?.length > 0) {
      return { success: false, error: 'Este email ja esta cadastrado. Faca login.' };
    }
    
    const hashedPassword = hashPassword(senha);
    
    const cleanPhone = telefone.replace(/\D/g, '');
    
    const empresa = await pg.create('empresas', {
      email: email,
      senha_hash: hashedPassword,
      login: email,
      nome_admin: nome,
      nome_fantasia: nome,
      telefone_loja: cleanPhone,
      nincho: 'Outros',
      instancia_evolution: '',
      planos: 'start',
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
      
      const proximaCobranca = new Date(fimTrial);
      
      await db.query(`
        INSERT INTO assinaturas (
          empresa_id, plano, status, valor, 
          mp_subscription_id, mp_preapproval_plan_id,
          data_inicio, data_proxima_cobranca,
          trial_end_date,
          cartao_ultimos_digitos, cartao_bandeira,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      `, [
        empresaId,
        'start',
        'trialing',
        29.90,
        'trial_' + Date.now(),
        'start',
        hoje.toISOString(),
        proximaCobranca.toISOString(),
        fimTrial.toISOString(),
        'TRIAL',
        'TRIAL'
      ]);
      
      console.log('[v0] Assinatura trial criada com sucesso');
    } catch (subError) {
      console.error('[v0] Erro ao criar assinatura trial:', subError);
    }
    
    // Criar instancia Evolution automaticamente
    try {
      console.log('[Signup] Criando instancia Evolution para empresa:', empresaId);
      const evolutionResult = await setupEvolutionInstance(empresaId);
      
      if (evolutionResult.error) {
        console.error('[Signup] Erro ao criar instancia Evolution:', evolutionResult.error);
      } else {
        // Atualizar empresa com o nome da instancia
        await pg.update('empresas', empresaId, {
          instancia_evolution: evolutionResult.instanceName
        });
        console.log('[Signup] Instancia Evolution criada:', evolutionResult.instanceName, 
          'webhook:', evolutionResult.webhookConfigured ? 'configurado' : 'pendente');
      }
    } catch (evoError) {
      console.error('[Signup] Erro ao configurar Evolution:', evoError);
      // Nao bloqueia o cadastro se falhar
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
      const { sendWelcomeMessage } = await import('./whatsapp');
      await sendWelcomeMessage(cleanPhone, nome, email, 'start', senha);
    } catch (waError) {
      console.error('[Signup] Erro ao enviar WhatsApp:', waError);
    }
    
    console.log('[v0] Conta trial criada com sucesso:', empresaId);
    
    return {
      success: true,
      empresaId,
      email,
      nome,
      plano: 'start',
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    
  } catch (error: any) {
    console.error('[Signup] Erro ao criar conta trial:', error);
    return { success: false, error: 'Erro interno ao criar conta' };
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
    const expiraEm = new Date();
    expiraEm.setHours(expiraEm.getHours() + 24);
    
    const signup = await pg.create('pending_signups', {
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
    if (!token) {
      return null;
    }
    
    const result = await pg.list('pending_signups', {
      where: { token },
      limit: 1,
    });
    
    const signup = result?.list?.[0];
    
    if (!signup) {
      return null;
    }
    
    const expiraEm = new Date(signup.expira_em as string);
    const signupId = signup.id as number;
    
    if (expiraEm < new Date()) {
      await pg.update('pending_signups', signupId, {
        status: 'expired',
      });
      return null;
    }
    
    if (signup.status === 'completed') {
      return null;
    }
    
    return signup as unknown as PendingSignup;
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
    const signup = await getPendingSignup(token);
    
    if (!signup) {
      return { success: false, error: 'Link invalido ou expirado' };
    }
    
    if (!password || password.length < 6) {
      return { success: false, error: 'Senha deve ter no minimo 6 caracteres' };
    }
    
    const hashedPassword = hashPassword(password);
    
    const empresa = await pg.create('empresas', {
      email: signup.email,
      senha_hash: hashedPassword,
      login: signup.email,
      nome_admin: signup.nome,
      nome_fantasia: signup.nome,
      telefone_loja: signup.telefone,
      nincho: 'Outros',
      instancia_evolution: '',
      planos: signup.plano,
      ativo: true,
    }) as any;
    
    if (!empresa?.id) {
      return { success: false, error: 'Erro ao criar conta' };
    }
    
    const empresaId = empresa.id;
    
    try {
        const planKey = signup.plano.toUpperCase() as keyof typeof SUBSCRIPTION_PLANS;
        const planData = SUBSCRIPTION_PLANS[planKey];
        
        const hoje = new Date();
        const proximaCobranca = new Date(hoje);
        proximaCobranca.setDate(proximaCobranca.getDate() + 30);
        
        console.log('[v0] Criando assinatura via SQL direto para empresa:', empresaId);
        
        const plano = signup.plano || 'start';
        const valor = planData?.price || 0;
        const mpSubscriptionId = signup.mp_payment_id || signup.mp_subscription_id || 'pix_' + Date.now();
        
        await db.query(`
          INSERT INTO assinaturas (
            empresa_id, plano, status, valor, 
            mp_subscription_id, mp_preapproval_plan_id,
            data_inicio, data_proxima_cobranca,
            cartao_ultimos_digitos, cartao_bandeira,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        `, [
          empresaId,
          plano,
          'authorized',
          valor,
          mpSubscriptionId,
          plano,
          hoje.toISOString(),
          proximaCobranca.toISOString(),
          'PIX',
          'PIX'
        ]);
        
        console.log('[v0] Assinatura criada com sucesso via SQL');
    } catch (subError) {
      console.error('[v0] Erro ao criar assinatura (nao bloqueante):', subError);
    }
    
    // Criar instancia Evolution automaticamente
    try {
      console.log('[Signup] Criando instancia Evolution para empresa:', empresaId);
      const evolutionResult = await setupEvolutionInstance(empresaId);
      
      if (evolutionResult.error) {
        console.error('[Signup] Erro ao criar instancia Evolution:', evolutionResult.error);
      } else {
        // Atualizar empresa com o nome da instancia
        await pg.update('empresas', empresaId, {
          instancia_evolution: evolutionResult.instanceName
        });
        console.log('[Signup] Instancia Evolution criada:', evolutionResult.instanceName, 
          'webhook:', evolutionResult.webhookConfigured ? 'configurado' : 'pendente');
      }
    } catch (evoError) {
      console.error('[Signup] Erro ao configurar Evolution:', evoError);
      // Nao bloqueia o cadastro se falhar
    }
    
    await pg.update('pending_signups', signup.id, {
      status: 'completed',
    });
    
    const session = await encrypt({
      userId: empresaId,
      email: signup.email,
      empresaId,
      nome: signup.nome,
      onboarded: false,
      controle_estoque: false,
      role: 'admin',
      source: 'empresa',
      bloqueado: false,
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
      const { sendWelcomeMessage } = await import('./whatsapp');
      await sendWelcomeMessage(signup.telefone, signup.nome, signup.email, signup.plano, password);
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
