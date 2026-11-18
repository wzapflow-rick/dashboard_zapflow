import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getMe } from '@/lib/session-server';
import { removeSubscription, saveSubscription } from '@/lib/push';

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

export async function POST(req: NextRequest) {
  const user = await getMe();
  if (!user?.empresaId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const parsed = subscriptionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Inscrição inválida' }, { status: 400 });
  }

  try {
    await saveSubscription(user.empresaId, user.userId ?? null, parsed.data, req.headers.get('user-agent'));
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[Push] Erro ao salvar inscrição:', error?.message);
    return NextResponse.json({ error: 'Erro ao salvar inscrição' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getMe();
  if (!user?.empresaId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : null;
  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint obrigatório' }, { status: 400 });
  }

  try {
    await removeSubscription(user.empresaId, endpoint);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[Push] Erro ao remover inscrição:', error?.message);
    return NextResponse.json({ error: 'Erro ao remover inscrição' }, { status: 500 });
  }
}
