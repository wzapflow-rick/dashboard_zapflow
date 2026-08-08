import DashboardClientLayout from '@/components/dashboard/dashboard-client-layout';
import { BlockScreen } from '@/components/dashboard/block-screen';
import { getMe } from '@/lib/session-server';
import { getBillingStatus } from '@/app/actions/billing';

// Sempre renderiza dinamicamente: precisamos checar o bloqueio no banco a cada
// requisicao (nao pode ficar em cache), inclusive para quem ja esta logado.
export const dynamic = 'force-dynamic';

export default async function DashboardSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getMe();

  // Checagem FRESCA no banco: mesmo que o JWT da sessao diga o contrario,
  // consultamos o estado atual de `bloqueado` da empresa. Assim o bloqueio
  // vale imediatamente para quem ja estava logado quando o cron marcou.
  if (user?.empresaId) {
    const billing = await getBillingStatus(user.empresaId);
    if (billing?.bloqueado) {
      return <BlockScreen empresaId={user.empresaId} nome={user.nome} />;
    }
  }

  return <DashboardClientLayout>{children}</DashboardClientLayout>;
}
