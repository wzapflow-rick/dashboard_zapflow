import { getMonthlyComparison, getSalesReport } from '@/app/actions/reports';
import { getBillingStatus } from '@/app/actions/billing';
import { getMe } from '@/lib/session-server';
import { EMPRESAS_TABLE } from '@/lib/tables';
import { pg } from '@/lib/postgres';
import { getPlanAccess, isTestCompanyRecord } from '@/lib/plan-access';
import { notFound } from 'next/navigation';
import { ReportsView, type DateRange, type MonthlyRow, type ReportData } from '@/components/reports/reports-view';

function currentMonthRange(): DateRange {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
        start: firstDay.toISOString().split('T')[0],
        end: today.toISOString().split('T')[0],
    };
}

export default async function ReportsPage() {
    const user = await getMe();
    if (!user?.empresaId) notFound();

    const [billing, company] = await Promise.all([
        getBillingStatus(user.empresaId),
        pg.findById(EMPRESAS_TABLE, user.empresaId) as Promise<Record<string, unknown> | null>,
    ]);
    const companyPlan =
        typeof company?.planos === 'string' ? company.planos : null;
    const activePlan =
        billing?.assinatura_status === 'authorized'
            ? billing.plano_assinatura
            : billing?.plano || companyPlan || 'iniciante';
    const planAccess = getPlanAccess(activePlan, isTestCompanyRecord(company));

    if (!planAccess.features.performanceReports) notFound();

    const initialRange = currentMonthRange();

    const [reportResult, monthlyResult] = await Promise.allSettled([
        getSalesReport(initialRange.start, initialRange.end),
        getMonthlyComparison(),
    ]);

    const initialReport = reportResult.status === 'fulfilled' ? (reportResult.value as ReportData) : null;
    const monthlyData: MonthlyRow[] = monthlyResult.status === 'fulfilled' ? monthlyResult.value : [];

    return <ReportsView initialRange={initialRange} initialReport={initialReport} monthlyData={monthlyData} />;
}
