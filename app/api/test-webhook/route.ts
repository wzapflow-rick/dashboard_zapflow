import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const body = await req.json();
  console.log('[TEST-WEBHOOK] Recebido:', JSON.stringify(body, null, 2));
  return NextResponse.json({ received: true, data: body });
}
