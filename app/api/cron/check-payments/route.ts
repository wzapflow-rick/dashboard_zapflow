import { NextRequest, NextResponse } from 'next/server';
import { noco } from '@/lib/nocodb';
import { EMPRESAS_TABLE_ID } from '@/lib/constants';
import { blockCompany, updatePaymentStatus } from '@/app/actions/billing';
import { sendPaymentReminder } from '@/app/actions/whatsapp';

// Protege o endpoint com uma chave secreta
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  // Verificar autorizacao
  const authHeader = request.headers.get('authorization');
  
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    console.log('[Cron] Acesso nao autorizado');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  console.log('[Cron] Iniciando verificacao de pagamentos...');
  
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Buscar empresas com pagamento PIX que tem vencimento
    const result = await noco.list(EMPRESAS_TABLE_ID, {
      where: `(tipo_pagamento,eq,pix)~and(data_vencimento,le,${todayStr})~and(planos,ne,iniciante)`,
      limit: 500,
    });
    
    const empresas = result?.list || [];
    console.log(`[Cron] Encontradas ${empresas.length} empresas para verificar`);
    
    let processed = 0;
    let blocked = 0;
    let notified = 0;
    
    for (const empresa of empresas) {
      const empresaId = (empresa.id || empresa.Id) as number;
      const dataVencimento = new Date(empresa.data_vencimento as string);
      const diasAtraso = Math.floor((today.getTime() - dataVencimento.getTime()) / (1000 * 60 * 60 * 24));
      
      // Ja esta bloqueada, pular
      if (empresa.bloqueado) {
        continue;
      }
      
      // Calcular dias de inadimplencia
      const diasInadimplente = Math.max(0, diasAtraso);
      const ultimoAviso = empresa.ultimo_aviso_enviado || 0;
      
      console.log(`[Cron] Empresa ${empresaId}: ${diasInadimplente} dias inadimplente, ultimo aviso: ${ultimoAviso}`);
      
      // Se passou de 5 dias, bloquear
      if (diasInadimplente >= 5 && !empresa.bloqueado) {
        console.log(`[Cron] Bloqueando empresa ${empresaId}`);
        await blockCompany(empresaId);
        
        // Enviar aviso de bloqueio
        if (empresa.telefone_admin || empresa.telefone) {
          const telefone = (empresa.telefone_admin || empresa.telefone) as string;
          const nome = (empresa.nome_fantasia || empresa.nome_admin || 'Cliente') as string;
          await sendPaymentReminder(telefone, nome, 5, empresaId);
        }
        
        blocked++;
        continue;
      }
      
      // Enviar aviso se ainda nao foi enviado para este dia
      if (diasInadimplente > 0 && diasInadimplente <= 5 && ultimoAviso < diasInadimplente) {
        console.log(`[Cron] Enviando aviso ${diasInadimplente} para empresa ${empresaId}`);
        
        // Atualizar dias de inadimplencia e ultimo aviso
        await updatePaymentStatus(empresaId, {
          dias_inadimplente: diasInadimplente,
          ultimo_aviso_enviado: diasInadimplente,
        });
        
        // Enviar WhatsApp
        if (empresa.telefone_admin || empresa.telefone) {
          const telefone = (empresa.telefone_admin || empresa.telefone) as string;
          const nome = (empresa.nome_fantasia || empresa.nome_admin || 'Cliente') as string;
          await sendPaymentReminder(telefone, nome, diasInadimplente, empresaId);
          notified++;
        }
      } else if (diasInadimplente > 0) {
        // Apenas atualizar contador
        await updatePaymentStatus(empresaId, {
          dias_inadimplente: diasInadimplente,
        });
      }
      
      processed++;
    }
    
    console.log(`[Cron] Finalizado: ${processed} processadas, ${notified} notificadas, ${blocked} bloqueadas`);
    
    return NextResponse.json({
      success: true,
      processed,
      notified,
      blocked,
      total: empresas.length,
    });
    
  } catch (error: any) {
    console.error('[Cron] Erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
