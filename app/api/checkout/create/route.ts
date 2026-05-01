import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/app/actions/signup';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://www.wzapflow.com.br',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { email, nome, telefone, plano } = body;
    
    // Validacoes basicas
    if (!email || !nome || !telefone || !plano) {
      return NextResponse.json(
        { success: false, error: 'Todos os campos sao obrigatorios' },
        { status: 400 }
      );
    }
    
    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Email invalido' },
        { status: 400 }
      );
    }
    
    // Validar telefone (minimo 10 digitos)
    const telefoneClean = telefone.replace(/\D/g, '');
    if (telefoneClean.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Telefone invalido' },
        { status: 400 }
      );
    }
    
    // Validar plano
    const planosValidos = ['start', 'pro', 'elite'];
    if (!planosValidos.includes(plano.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: 'Plano invalido' },
        { status: 400 }
      );
    }
    
    // Criar sessao de checkout
    const result = await createCheckoutSession({
      email: email.toLowerCase().trim(),
      nome: nome.trim(),
      telefone: telefoneClean,
      plano: plano.toLowerCase() as 'start' | 'pro' | 'elite',
    });
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400, headers: CORS_HEADERS }
      );
    }
    
    return NextResponse.json({
      success: true,
      initPoint: result.initPoint,
      token: result.token,
    }, { headers: CORS_HEADERS });
    
  } catch (error: any) {
    console.error('[Checkout API] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// Permitir CORS para a landing page (preflight)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}
