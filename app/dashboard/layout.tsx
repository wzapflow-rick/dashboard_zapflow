import DashboardClientLayout from '@/components/dashboard/dashboard-client-layout';
import { BlockScreen } from '@/components/dashboard/block-screen';
import { getMe } from '@/lib/session-server';
import { getBillingStatus } from '@/app/actions/billing';
import { EMPRESAS_TABLE } from '@/lib/tables';
import { pg } from '@/lib/postgres';
import { getPlanAccess, isTestCompanyRecord } from '@/lib/plan-access';

// Sempre renderiza dinamicamente: precisamos checar o bloqueio e o plano no banco
// a cada requisicao, inclusive para quem ja esta logado.
export const dynamic = 'force-dynamic';

export default async function DashboardSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getMe();
  let planAccess = getPlanAccess(user?.plano);

  // Checagem FRESCA no banco: o bloqueio e os recursos do plano refletem
  // imediatamente o estado atual da empresa, sem depender de um JWT antigo.
  if (user?.empresaId) {
    const [billing, company] = await Promise.all([
      getBillingStatus(user.empresaId),
      pg.findById(EMPRESAS_TABLE, user.empresaId) as Promise<Record<string, unknown> | null>,
    ]);

    if (billing?.bloqueado) {
      return <BlockScreen empresaId={user.empresaId} nome={user.nome} />;
    }

    const activePlan =
      billing?.assinatura_status === 'authorized'
        ? billing.plano_assinatura
        : billing?.plano || user.plano;

    planAccess = getPlanAccess(activePlan, isTestCompanyRecord(company));
  }

  return <DashboardClientLayout planAccess={planAccess}>{children}</DashboardClientLayout>;
}
