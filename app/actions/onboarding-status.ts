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
        endereco, 
        telefone_loja,
        instancia_evolution,
        pagamento_integrado
      FROM empresas WHERE id = $1`,
      [empresaId]
    );
    
    const empresa = empresaResult?.rows?.[0] || empresaResult?.[0];
    if (!empresa) {
      return null;
    }

    // Verificar dados da loja (nome e endereco preenchidos)
    const hasCompanyData = !!(
      empresa.nome_fantasia && 
      empresa.endereco && 
      empresa.telefone_loja
    );

    // Produtos e config de pagamento são independentes: rodam em paralelo.
    const [produtosResult, mpResult] = await Promise.all([
      pg.query(
        'SELECT COUNT(*) as count FROM produtos WHERE empresa_id = $1 AND disponivel = true',
        [empresaId]
      ) as Promise<any>,
      pg.query(
        'SELECT mp_access_token FROM pagamentos_config WHERE empresa_id = $1',
        [empresaId]
      ) as Promise<any>,
    ]);

    const produtosCount = parseInt(produtosResult?.rows?.[0]?.count || produtosResult?.[0]?.count || '0');
    const hasProducts = produtosCount > 0;

    const mpConfig = mpResult?.rows?.[0] || mpResult?.[0];
    // Se o pagamento integrado estiver desativado, a etapa do Mercado Pago e
    // considerada concluida automaticamente (a loja nao recebe pagamentos online).
    const pagamentoIntegrado = empresa.pagamento_integrado !== false;
    const hasMercadoPago = !pagamentoIntegrado || !!(mpConfig?.mp_access_token);

    // Verificar WhatsApp (instancia Evolution)
    let hasWhatsApp = false;
    let whatsAppStatus: 'connected' | 'disconnected' | 'not_configured' = 'not_configured';
    
    if (empresa.instancia_evolution) {
      // Tem instancia configurada, verificar status
      try {
        const EVO_API_URL = process.env.EVOLUTION_API_URL || 'https://evo.wzapflow.com.br';
        const EVO_API_KEY = process.env.EVOLUTION_API_KEY || '';

        // Timeout de 3s: sem isso, uma Evolution API lenta/fora do ar travava
        // todo o carregamento do dashboard (esta chamada faz parte do bundle).
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const statusResponse = await fetch(
          `${EVO_API_URL}/instance/connectionState/${empresa.instancia_evolution}`,
          {
            headers: {
              'apikey': EVO_API_KEY,
            },
            signal: controller.signal,
          }
        ).finally(() => clearTimeout(timeoutId));
        
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
      companyName: empresa.nome_fantasia || 'Sua Loja',
    };
  } catch (error) {
    console.error('[OnboardingStatus] Erro:', error);
    return null;
  }
}
