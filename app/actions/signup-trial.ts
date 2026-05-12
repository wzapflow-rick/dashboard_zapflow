'use server';

import { noco } from '@/lib/nocodb';
import { EMPRESAS_TABLE_ID, ASSINATURAS_TABLE_ID, SUBSCRIPTION_PLANS } from '@/lib/constants';
import bcrypt from 'bcryptjs';
import { encrypt } from '@/lib/session';
import { cookies } from 'next/headers';

// Helper para hash de senha
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
 * Nao requer pagamento, cria a conta direto e faz login automatico
 */
export async function createTrialAccount(data: TrialAccountData) {
  try {
    const { email, nome, telefone, password } = data;
    
    // Validacoes
    if (!email || !nome || !telefone || !password) {
      return { success: false, error: 'Todos os campos sao obrigatorios' };
    }
    
    if (password.length < 6) {
      return { success: false, error: 'Senha deve ter no minimo 6 caracteres' };
    }
    
    // Verificar se email ja existe
    const existingCompany = await noco.list(EMPRESAS_TABLE_ID, {
      where: `(email,eq,${email})`,
      limit: 1,
    });
    
    if (existingCompany?.list?.length > 0) {
      return { success: false, error: 'Este email ja esta cadastrado. Faca login.' };
    }
    
    // Hash da senha
    const hashedPassword = hashPassword(password);
    
    // Gerar slug unico baseado no nome
    const baseSlug = nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;
    
    // Criar empresa com plano parceria
    const empresa = await noco.create(EMPRESAS_TABLE_ID, {
      email: email,
      senha_hash: hashedPassword,
      login: email,
      senha: hashedPassword,
      password: password,
      nome_admin: nome,
      nome_fantasia: nome,
      telefone: telefone,
      telefone_admin: telefone,
      whatsapp: telefone,
      status: 'ativo',
      nincho: 'Outros',
      instancia_evolution: '',
      planos: 'parceria',
      slug: uniqueSlug,
      data_inicio_trial: new Date().toISOString(),
    }) as any;
    
    if (!empresa?.id && !empresa?.Id) {
      return { success: false, error: 'Erro ao criar conta' };
    }
    
    const empresaId = empresa.id || empresa.Id;
    
    // Criar assinatura trial no NocoDB
    // NOTA: empresa_id e uma coluna de sistema (Link) e nao pode ser definida diretamente
    // Primeiro criamos o registro sem o link, depois usamos a API de Links
    try {
      const hoje = new Date();
      const fimTrial = new Date(hoje);
      fimTrial.setDate(fimTrial.getDate() + 7); // 7 dias de trial
      
      console.log('[TrialSignup] Criando assinatura para empresa_id:', empresaId);
      
      // Criar assinatura SEM o campo empresa_id (que e coluna de sistema)
      const assinaturaData = {
        plano: 'parceria',
        status: 'authorized',
        valor: 0,
        mp_subscription_id: `trial_${empresaId}_${Date.now()}`,
        mp_preapproval_plan_id: 'parceria',
        data_inicio: hoje.toISOString(),
        data_proxima_cobranca: fimTrial.toISOString(),
        cartao_ultimos_digitos: 'TRIA',
        cartao_bandeira: 'TRIA',
      };
      
      const assinaturaCriada = await noco.create(ASSINATURAS_TABLE_ID, assinaturaData) as any;
      console.log('[TrialSignup] Assinatura criada:', JSON.stringify(assinaturaCriada));
      
      // Agora criar o link entre assinatura e empresa
      // O campo de link se chama 'empresa_id' mas precisamos do ID interno do campo
      // Vamos tentar usar a API de links com o nome do campo
      const assinaturaId = assinaturaCriada.id || assinaturaCriada.Id;
      if (assinaturaId) {
        try {
          await noco.link(ASSINATURAS_TABLE_ID, 'empresa_id', assinaturaId, empresaId);
          console.log('[TrialSignup] Link criado entre assinatura', assinaturaId, 'e empresa', empresaId);
        } catch (linkError: any) {
          console.error('[TrialSignup] Erro ao criar link:', linkError?.message);
          // Tenta com nome alternativo 'empresas'
          try {
            await noco.link(ASSINATURAS_TABLE_ID, 'empresas', assinaturaId, empresaId);
            console.log('[TrialSignup] Link criado com campo alternativo empresas');
          } catch (linkError2: any) {
            console.error('[TrialSignup] Erro ao criar link com empresas:', linkError2?.message);
          }
        }
      }
      
      console.log('[TrialSignup] Assinatura trial criada com sucesso');
    } catch (subError: any) {
      console.error('[TrialSignup] ERRO ao criar assinatura:', subError?.message || subError);
      // Continua mesmo se falhar - a empresa ja foi criada e o usuario pode assinar depois
      console.log('[TrialSignup] Continuando sem assinatura - usuario pode assinar depois');
    }
    
    // Criar sessao (login automatico)
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
      maxAge: 60 * 60 * 24, // 24 horas
      path: '/',
    });
    
    // Enviar mensagem de boas-vindas no WhatsApp
    try {
      const { sendTrialWelcomeMessage } = await import('./whatsapp');
      await sendTrialWelcomeMessage(telefone, nome, email);
    } catch (waError) {
      console.error('[TrialSignup] Erro ao enviar WhatsApp:', waError);
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
    return { success: false, error: 'Erro ao criar conta' };
  }
}
