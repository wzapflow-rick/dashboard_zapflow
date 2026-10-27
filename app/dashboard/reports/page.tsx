import { getMonthlyComparison, getSalesReport } from '@/app/actions/reports';
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
    const initialRange = currentMonthRange();

    const [reportResult, monthlyResult] = await Promise.allSettled([
        getSalesReport(initialRange.start, initialRange.end),
        getMonthlyComparison(),
    ]);

    const initialReport = reportResult.status === 'fulfilled' ? (reportResult.value as ReportData) : null;
    const monthlyData: MonthlyRow[] = monthlyResult.status === 'fulfilled' ? monthlyResult.value : [];

    return <ReportsView initialRange={initialRange} initialReport={initialReport} monthlyData={monthlyData} />;
}
