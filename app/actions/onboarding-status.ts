'use server';

import { pg } from '@/lib/postgres';
import { getMe } from '@/lib/session-server';

export interface OnboardingStatus {
  hasCompanyData: boolean;
  hasProducts: boolean;
  hasMercadoPago: boolean;
  hasWhatsApp: boolean;
  whatsAppStatus: 'connected' | 'disconnected' | 'not_configured';
  completedSteps: number;
  totalSteps: number;
  companyName: string;
}

export async function getOnboardingStatus(): Promise<OnboardingStatus | null> {
  try {
    const user = await getMe();
    if (!user?.empresaId) {
      return null;
    }

    const empresaId = user.empresaId;

    // Buscar dados da empresa
    const empresaResult: any = await pg.query(
      `SELECT 
        nome_fantasia, 
        nome, 
        endereco, 
        telefone_loja,
        instancia_evolution
      FROM empresas WHERE id = $1`,
      [empresaId]
    );
    
    const empresa = empresaResult?.rows?.[0] || empresaResult?.[0];
    if (!empresa) {
      return null;
    }

    // Verificar dados da loja (nome e endereco preenchidos)
    const hasCompanyData = !!(
      (empresa.nome_fantasia || empresa.nome) && 
      empresa.endereco && 
      empresa.telefone_loja
    );

    // Verificar se tem produtos cadastrados
    const produtosResult: any = await pg.query(
      'SELECT COUNT(*) as count FROM produtos WHERE empresa_id = $1 AND ativo = true',
      [empresaId]
    );
    const produtosCount = parseInt(produtosResult?.rows?.[0]?.count || produtosResult?.[0]?.count || '0');
    const hasProducts = produtosCount > 0;

    // Verificar Mercado Pago conectado
    const mpResult: any = await pg.query(
      'SELECT mp_access_token FROM pagamentos_config WHERE empresa_id = $1',
      [empresaId]
    );
    const mpConfig = mpResult?.rows?.[0] || mpResult?.[0];
    const hasMercadoPago = !!(mpConfig?.mp_access_token);

    // Verificar WhatsApp (instancia Evolution)
    let hasWhatsApp = false;
    let whatsAppStatus: 'connected' | 'disconnected' | 'not_configured' = 'not_configured';
    
    if (empresa.instancia_evolution) {
      // Tem instancia configurada, verificar status
      try {
        const EVO_API_URL = process.env.EVOLUTION_API_URL || 'https://evo.wzapflow.com.br';
        const EVO_API_KEY = process.env.EVOLUTION_API_KEY || '';
        
        const statusResponse = await fetch(
          `${EVO_API_URL}/instance/connectionState/${empresa.instancia_evolution}`,
          {
            headers: {
              'apikey': EVO_API_KEY,
            },
          }
        );
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          const state = statusData?.instance?.state || statusData?.state;
          
          if (state === 'open' || state === 'connected') {
            hasWhatsApp = true;
            whatsAppStatus = 'connected';
          } else {
            whatsAppStatus = 'disconnected';
          }
        } else {
          whatsAppStatus = 'disconnected';
        }
      } catch (error) {
        console.error('[OnboardingStatus] Erro ao verificar WhatsApp:', error);
        whatsAppStatus = 'disconnected';
      }
    }

    // Calcular progresso
    const steps = [hasCompanyData, hasProducts, hasMercadoPago, hasWhatsApp];
    const completedSteps = steps.filter(Boolean).length;
    const totalSteps = steps.length;

    return {
      hasCompanyData,
      hasProducts,
      hasMercadoPago,
      hasWhatsApp,
      whatsAppStatus,
      completedSteps,
      totalSteps,
      companyName: empresa.nome_fantasia || empresa.nome || 'Sua Loja',
    };
  } catch (error) {
    console.error('[OnboardingStatus] Erro:', error);
    return null;
  }
}
