'use server';

import { noco } from '@/lib/nocodb';
import db from '@/lib/db';
import { 
  PENDING_SIGNUPS_TABLE_ID, 
  EMPRESAS_TABLE_ID, 
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
  console.log('[v0] createCheckoutSession iniciado:', JSON.stringify(data));
  
  try {
    const { email, nome, telefone, plano } = data;
    
    // Validacoes
    if (!email || !nome || !telefone || !plano) {
      console.log('[v0] Campos faltando em createCheckoutSession');
      return { success: false, error: 'Todos os campos sao obrigatorios' };
    }
    
    console.log('[v0] Verificando email existente:', email);
    
    // Verificar se email ja existe
    const existingCompany = await noco.list(EMPRESAS_TABLE_ID, {
      where: `(email,eq,${email})`,
      limit: 1,
    });
    
    console.log('[v0] Resultado busca email:', existingCompany?.list?.length || 0);
    
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
    
    console.log('[v0] Criando assinatura no MP com preference:', JSON.stringify(preference));
    console.log('[v0] MP_ACCESS_TOKEN presente:', !!MP_ACCESS_TOKEN);
    
    // Criar assinatura no MP
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
      tipo: 'pix',
    });
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://cardapio.wzapflow.com.br';
    
    // Criar preferencia de pagamento PIX no Mercado Pago
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
    const signupId = (signup.id || signup.Id) as number;
    
    if (expiraEm < new Date()) {
      // Marcar como expirado
      await noco.update(PENDING_SIGNUPS_TABLE_ID, {
        id: signupId,
        status: 'expired',
      });
      return null;
    }
    
    // Verificar se ja foi usado
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
    
    // Gerar slug unico baseado no nome
    const baseSlug = signup.nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;
    
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
      telefone_admin: signup.telefone,
      whatsapp: signup.telefone,
      status: 'ativo',
      nincho: 'Outros',
      instancia_evolution: '',
      planos: signup.plano,
      slug: uniqueSlug,
    }) as any;
    
    if (!empresa?.id && !empresa?.Id) {
      return { success: false, error: 'Erro ao criar conta' };
    }
    
    const empresaId = empresa.id || empresa.Id;
    
    // Criar assinatura (em try/catch separado para nao bloquear criacao da conta)
    if (ASSINATURAS_TABLE_ID) {
      try {
        const planKey = signup.plano.toUpperCase() as keyof typeof SUBSCRIPTION_PLANS;
        const planData = SUBSCRIPTION_PLANS[planKey];
        
        // Calcular proxima data de cobranca (30 dias a partir de hoje)
        const hoje = new Date();
        const proximaCobranca = new Date(hoje);
        proximaCobranca.setDate(proximaCobranca.getDate() + 30);
        
        console.log('[v0] Criando assinatura via SQL direto para empresa:', empresaId);
        
        // Usar SQL direto para contornar restricao de Link field do NocoDB
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
        // Continua mesmo se falhar a criacao da assinatura
      }
    }
    
    // Marcar pending signup como completo
    if (PENDING_SIGNUPS_TABLE_ID) {
      await noco.update(PENDING_SIGNUPS_TABLE_ID, {
        id: signup.id,
        status: 'completed',
      });
    }
    
    // Criar sessao (login automatico) - TODOS os campos necessarios
    const session = await encrypt({
      userId: empresaId,
      email: signup.email,
      empresaId,
      nome: signup.nome,
      onboarded: false, // Usuario novo precisa fazer onboarding
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
      sameSite: 'lax', // 'lax' permite navegacao cross-site (links externos)
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
