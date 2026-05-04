import { NextRequest, NextResponse } from 'next/server';
import { noco } from '@/lib/nocodb';
import { ASSINATURAS_TABLE_ID } from '@/lib/constants';

// APENAS PARA TESTE - Remover em producao
export async function POST(req: NextRequest) {
  // Verificar se estamos em ambiente de desenvolvimento ou se tem a chave secreta
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  
  if (secret !== 'zapflow_test_2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const body = await req.json();
    const { empresa_id, plano = 'start' } = body;
    
    if (!empresa_id) {
      return NextResponse.json({ error: 'empresa_id é obrigatório' }, { status: 400 });
    }
    
    const hoje = new Date();
    const proximaCobranca = new Date(hoje);
    proximaCobranca.setDate(proximaCobranca.getDate() + 30);
    
    const assinaturaData = {
      empresa_id: empresa_id,
      plano: plano,
      status: 'authorized',
      valor: 5,
      mp_subscription_id: 'test_' + Date.now(),
      mp_preapproval_plan_id: plano,
      data_inicio: hoje.toISOString(),
      data_proxima_cobranca: proximaCobranca.toISOString(),
      cartao_ultimos_digitos: 'TEST',
      cartao_bandeira: 'TEST',
    };
    
    console.log('[TEST] Criando assinatura:', JSON.stringify(assinaturaData));
    
    const result = await noco.create(ASSINATURAS_TABLE_ID, assinaturaData);
    
    console.log('[TEST] Assinatura criada:', result);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Assinatura criada com sucesso',
      data: result 
    });
    
  } catch (error: any) {
    console.error('[TEST] Erro ao criar assinatura:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      details: error.response?.data || error.toString()
    }, { status: 500 });
  }
}
