import { NextResponse } from 'next/server';
import { getMe } from '@/lib/session-server';
import { sendPushToEmpresa } from '@/lib/push';

export async function POST() {
  const user = await getMe();
  if (!user?.empresaId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const result = await sendPushToEmpresa(user.empresaId, {
    title: 'ZapFlash',
    body: 'Notificações ativadas! Você vai ser avisado a cada novo pedido.',
    url: '/dashboard/expedition',
    tag: 'teste',
  });

  return NextResponse.json(result);
}
