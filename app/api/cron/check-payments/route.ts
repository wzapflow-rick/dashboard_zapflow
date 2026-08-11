import { NextRequest, NextResponse } from 'next/server';
import { pg } from '@/lib/postgres';
import { blockCompany, updatePaymentStatus } from '@/app/actions/billing';
import { sendPaymentReminder } from '@/app/actions/whatsapp';
import { logCronRun } from '@/lib/cron-logger';

// Protege o endpoint com uma chave secreta
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Aceita autenticacao por:
 *   - header  x-cron-key: <CRON_SECRET>      (padrao usado pelo crontab da VPS)
 *   - header  Authorization: Bearer <CRON_SECRET>  (compatibilidade)
 */
function isAuthorized(request: NextRequest): boolean {
  if (!CRON_SECRET) {
    console.warn('[Cron] CRON_SECRET nao configurado — negando acesso por seguranca');
    return false;
  }
  const cronKey = request.headers.get('x-cron-key');
  const authHeader = request.headers.get('authorization');
  return cronKey === CRON_SECRET || authHeader === `Bearer ${CRON_SECRET}`;
}

async function handleCheckPayments(request: NextRequest) {
  // Verificar autorizacao
  if (!isAuthorized(request)) {
    console.log('[Cron] Acesso nao autorizado');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  console.log('[Cron] Iniciando verificacao de pagamentos...');
  const startedAt = Date.now();
  
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Numero de dias de tolerancia apos o vencimento antes de bloquear o acesso.
    const DIAS_PARA_BLOQUEIO = 2;

    // Buscar empresas com pagamento PIX ou cartao que ja passaram do vencimento.
    // A data de referencia e a `data_proxima_cobranca` da assinatura mais recente
    // (que o webhook do Mercado Pago mantem ao aprovar pagamentos, tanto PIX quanto
    // cartao). Se nao houver assinatura, cai no `data_vencimento` da empresa.
    // Assim NUNCA bloqueamos quem esta em dia.
    const result = await pg.query(`
      SELECT
        e.*,
        a.plano AS assinatura_plano,
        a.valor AS assinatura_valor,
        COALESCE(a.data_proxima_cobranca::date, e.data_vencimento::date) AS vencimento_efetivo
      FROM empresas e
      LEFT JOIN LATERAL (
        SELECT data_proxima_cobranca, plano, valor
        FROM assinaturas
        WHERE empresa_id = e.id
        ORDER BY id DESC
        LIMIT 1
      ) a ON true
      WHERE e.tipo_pagamento IN ('pix', 'cartao')
        -- Plano efetivo: prioriza o da assinatura (fonte da verdade) e cai no
        -- da empresa. IS DISTINCT FROM trata NULL corretamente (NULL entra),
        -- evitando excluir silenciosamente quem tem plano nao preenchido.
        AND COALESCE(a.plano, e.planos) IS DISTINCT FROM 'iniciante'
        AND e.bloqueado = false
        AND COALESCE(a.data_proxima_cobranca::date, e.data_vencimento::date) <= $1
      LIMIT 500
    `, [todayStr]);
    
    const empresas = result.rows || [];
    console.log(`[Cron] Encontradas ${empresas.length} empresas para verificar`);
    
    let processed = 0;
    let blocked = 0;
    let notified = 0;
    
    for (const empresa of empresas) {
      const empresaId = empresa.id as number;
      const vencimentoEfetivo = empresa.vencimento_efetivo
        ? new Date(empresa.vencimento_efetivo as string)
        : null;

      // Sem data de vencimento confiavel: pular por seguranca (nao bloquear)
      if (!vencimentoEfetivo || isNaN(vencimentoEfetivo.getTime())) {
        console.log(`[Cron] Empresa ${empresaId} sem data de vencimento valida — pulando`);
        continue;
      }

      const diasAtraso = Math.floor((today.getTime() - vencimentoEfetivo.getTime()) / (1000 * 60 * 60 * 24));
      
      // Ja esta bloqueada, pular (redundante com o WHERE, mas defensivo)
      if (empresa.bloqueado) {
        continue;
      }
      
      // Calcular dias de inadimplencia
      const diasInadimplente = Math.max(0, diasAtraso);
      const ultimoAviso = (empresa.ultimo_aviso_enviado as number) || 0;
      
      console.log(`[Cron] Empresa ${empresaId}: ${diasInadimplente} dias inadimplente (venc: ${empresa.vencimento_efetivo}), ultimo aviso: ${ultimoAviso}`);
      
      // Se passou de DIAS_PARA_BLOQUEIO, bloquear acesso total
      if (diasInadimplente >= DIAS_PARA_BLOQUEIO && !empresa.bloqueado) {
        console.log(`[Cron] Bloqueando empresa ${empresaId} (${diasInadimplente} dias de atraso)`);
        await blockCompany(empresaId);
        
        // Enviar aviso de bloqueio.
        // O telefone principal fica em `telefone_loja` (mesma coluna usada pelo
        // cron de lembrete e exibida no painel). `telefone_admin` NAO existe na
        // tabela e `telefone` e apenas fallback legado.
        const telefoneBloqueio = (empresa.telefone_loja || empresa.telefone) as string | undefined;
        if (telefoneBloqueio) {
          const nome = (empresa.nome_fantasia || empresa.nome_admin || 'Cliente') as string;
          const enviado = await sendPaymentReminder(telefoneBloqueio, nome, diasInadimplente, empresaId, { blocked: true });
          if (enviado) notified++;
          else console.warn(`[Cron] Falha ao enviar cobranca de bloqueio para empresa ${empresaId} (tel: ${telefoneBloqueio})`);
        } else {
          console.warn(`[Cron] Empresa ${empresaId} sem telefone para cobranca de bloqueio`);
        }
        
        blocked++;
        continue;
      }
      
      // Enviar aviso se ainda nao foi enviado para este dia
      if (diasInadimplente > 0 && diasInadimplente < DIAS_PARA_BLOQUEIO && ultimoAviso < diasInadimplente) {
        console.log(`[Cron] Enviando aviso ${diasInadimplente} para empresa ${empresaId}`);
        
        // Atualizar dias de inadimplencia e ultimo aviso
        await updatePaymentStatus(empresaId, {
          dias_inadimplente: diasInadimplente,
          ultimo_aviso_enviado: diasInadimplente,
        });
        
        // Enviar WhatsApp (telefone principal em `telefone_loja`).
        const telefoneAviso = (empresa.telefone_loja || empresa.telefone) as string | undefined;
        if (telefoneAviso) {
          const nome = (empresa.nome_fantasia || empresa.nome_admin || 'Cliente') as string;
          const enviado = await sendPaymentReminder(telefoneAviso, nome, diasInadimplente, empresaId);
          if (enviado) notified++;
          else console.warn(`[Cron] Falha ao enviar aviso para empresa ${empresaId} (tel: ${telefoneAviso})`);
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
    
    const summary = { processed, notified, blocked, total: empresas.length };

    await logCronRun({
      jobName: 'check-payments',
      status: 'success',
      summary,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      success: true,
      ...summary,
    });
    
  } catch (error: any) {
    console.error('[Cron] Erro:', error);
    await logCronRun({
      jobName: 'check-payments',
      status: 'error',
      summary: { error: error?.message ?? 'erro desconhecido' },
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleCheckPayments(request);
}

export async function POST(request: NextRequest) {
  return handleCheckPayments(request);
}
