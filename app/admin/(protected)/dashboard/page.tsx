import { Building2, CreditCard, TrendingUp, AlertCircle } from 'lucide-react';
import { getAdminStats } from '@/app/actions/admin';
import { getComercialStats } from '@/app/actions/comercial';
import { ComercialOverview } from '@/components/admin/dashboard/comercial-overview';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const [adminResult, comercialResult] = await Promise.all([getAdminStats(), getComercialStats()]);
  const stats = adminResult.success ? adminResult.stats : undefined;

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1">Visão geral comercial e do sistema ZapFlash</p>
      </div>

      {comercialResult.success ? (
        <ComercialOverview stats={comercialResult.stats} />
      ) : (
        <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-300">
          {comercialResult.error}
        </p>
      )}

      <section aria-labelledby="sistema-titulo" className="flex flex-col gap-6">
        <h2 id="sistema-titulo" className="text-lg font-semibold text-white">
          Empresas e assinaturas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total de Empresas" value={stats?.totalEmpresas || 0} icon={Building2} color="blue" />
          <StatCard title="Assinaturas Ativas" value={stats?.assinaturasAtivas || 0} icon={CreditCard} color="green" />
          <StatCard title="Novas (7 dias)" value={stats?.empresasRecentes || 0} icon={TrendingUp} color="orange" />
          <StatCard title="Vencendo (7 dias)" value={stats?.vencendoEm7Dias || 0} icon={AlertCircle} color="red" />
        </div>

        <div className="bg-[#111113] border border-[#27272a] rounded-xl p-6">
          <h3 className="text-base font-semibold text-white mb-4">Assinaturas por Plano</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PlanCard plano="start" total={stats?.assinaturasPorPlano?.start || 0} color="blue" />
            <PlanCard plano="pro" total={stats?.assinaturasPorPlano?.pro || 0} color="orange" />
            <PlanCard plano="elite" total={stats?.assinaturasPorPlano?.elite || 0} color="purple" />
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'orange' | 'red';
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-400',
    green: 'bg-green-500/10 text-green-400',
    orange: 'bg-orange-500/10 text-orange-400',
    red: 'bg-red-500/10 text-red-400',
  };

  return (
    <div className="bg-[#111113] border border-[#27272a] rounded-xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-sm">{title}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
        </div>
        <div className={`size-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="size-6" />
        </div>
      </div>
    </div>
  );
}

function PlanCard({ plano, total, color }: { plano: string; total: number; color: string }) {
  const planNames: Record<string, string> = { start: 'Start', pro: 'Pro', elite: 'Elite' };
  const colorClasses: Record<string, string> = {
    blue: 'border-blue-500/50 bg-blue-500/5',
    orange: 'border-orange-500/50 bg-orange-500/5',
    purple: 'border-purple-500/50 bg-purple-500/5',
  };

  return (
    <div className={`border rounded-lg p-4 ${colorClasses[color]}`}>
      <p className="text-slate-400 text-sm">Plano {planNames[plano] || plano}</p>
      <p className="text-2xl font-bold text-white mt-1">{total}</p>
    </div>
  );
}
