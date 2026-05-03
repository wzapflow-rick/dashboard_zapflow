'use client';

import { useEffect, useState } from 'react';
import { getAdminStats } from '@/app/actions/admin';
import { Building2, CreditCard, TrendingUp, AlertCircle, Users, Clock } from 'lucide-react';

interface Stats {
  totalEmpresas: number;
  empresasAtivas: number;
  assinaturasAtivas: number;
  assinaturasPorPlano: Record<string, number>;
  vencendoEm7Dias: number;
  empresasRecentes: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const result = await getAdminStats();
    if (result.success && result.stats) {
      setStats(result.stats);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard Admin</h1>
        <p className="text-slate-400 mt-1">Visao geral do sistema ZapFlow</p>
      </div>

      {/* Cards de Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total de Empresas"
          value={stats?.totalEmpresas || 0}
          icon={Building2}
          color="blue"
        />
        <StatCard
          title="Assinaturas Ativas"
          value={stats?.assinaturasAtivas || 0}
          icon={CreditCard}
          color="green"
        />
        <StatCard
          title="Novas (7 dias)"
          value={stats?.empresasRecentes || 0}
          icon={TrendingUp}
          color="orange"
        />
        <StatCard
          title="Vencendo (7 dias)"
          value={stats?.vencendoEm7Dias || 0}
          icon={AlertCircle}
          color="red"
        />
      </div>

      {/* Assinaturas por Plano */}
      <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Assinaturas por Plano</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PlanCard 
            plano="start" 
            total={stats?.assinaturasPorPlano?.start || 0} 
            color="blue"
          />
          <PlanCard 
            plano="pro" 
            total={stats?.assinaturasPorPlano?.pro || 0} 
            color="orange"
          />
          <PlanCard 
            plano="elite" 
            total={stats?.assinaturasPorPlano?.elite || 0} 
            color="purple"
          />
        </div>
      </div>

      {/* Links Rapidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <a 
          href="/admin/empresas"
          className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-6 hover:border-orange-500/50 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="size-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Building2 className="size-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-orange-400 transition-colors">
                Gerenciar Empresas
              </h3>
              <p className="text-slate-400 text-sm">Criar, editar e gerenciar empresas</p>
            </div>
          </div>
        </a>

        <a 
          href="/admin/assinaturas"
          className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-6 hover:border-orange-500/50 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="size-12 bg-green-500/10 rounded-lg flex items-center justify-center">
              <CreditCard className="size-6 text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-orange-400 transition-colors">
                Gerenciar Assinaturas
              </h3>
              <p className="text-slate-400 text-sm">Alterar planos e datas de vencimento</p>
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  color 
}: { 
  title: string; 
  value: number; 
  icon: any; 
  color: 'blue' | 'green' | 'orange' | 'red';
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-400',
    green: 'bg-green-500/10 text-green-400',
    orange: 'bg-orange-500/10 text-orange-400',
    red: 'bg-red-500/10 text-red-400',
  };

  return (
    <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-6">
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
  const planNames: Record<string, string> = {
    start: 'Start',
    pro: 'Pro',
    elite: 'Elite',
  };

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
