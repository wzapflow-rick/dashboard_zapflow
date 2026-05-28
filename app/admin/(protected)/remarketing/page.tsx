'use client';

import { useEffect, useState } from 'react';
import { 
  Users, 
  MessageSquare, 
  ListTodo, 
  Target,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { getDashboardStats } from '@/app/actions/remarketing';

interface Stats {
  totalContatos: number;
  contatosAtivos: number;
  totalCategorias: number;
  totalMensagens: number;
  filaPendente: number;
  enviadosHoje: number;
  enviadosSemana: number;
  taxaSucesso: number;
}

export default function RemarketingDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    const result = await getDashboardStats();
    if (result.success && result.stats) {
      setStats(result.stats);
    }
    setLoading(false);
  };

  const statCards = stats ? [
    {
      label: 'Contatos Ativos',
      value: stats.contatosAtivos,
      total: stats.totalContatos,
      icon: Users,
      color: 'blue',
    },
    {
      label: 'Categorias',
      value: stats.totalCategorias,
      icon: Target,
      color: 'purple',
    },
    {
      label: 'Templates',
      value: stats.totalMensagens,
      icon: MessageSquare,
      color: 'green',
    },
    {
      label: 'Fila Pendente',
      value: stats.filaPendente,
      icon: ListTodo,
      color: 'orange',
    },
  ] : [];

  const performanceCards = stats ? [
    {
      label: 'Enviados Hoje',
      value: stats.enviadosHoje,
      icon: Clock,
      color: 'emerald',
    },
    {
      label: 'Enviados na Semana',
      value: stats.enviadosSemana,
      icon: TrendingUp,
      color: 'cyan',
    },
    {
      label: 'Taxa de Sucesso',
      value: `${stats.taxaSucesso}%`,
      icon: stats.taxaSucesso >= 90 ? CheckCircle2 : AlertCircle,
      color: stats.taxaSucesso >= 90 ? 'green' : stats.taxaSucesso >= 70 ? 'yellow' : 'red',
    },
  ] : [];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; iconBg: string }> = {
      blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', iconBg: 'bg-blue-500/20' },
      purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', iconBg: 'bg-purple-500/20' },
      green: { bg: 'bg-green-500/10', text: 'text-green-400', iconBg: 'bg-green-500/20' },
      orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', iconBg: 'bg-orange-500/20' },
      emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', iconBg: 'bg-emerald-500/20' },
      cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', iconBg: 'bg-cyan-500/20' },
      yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', iconBg: 'bg-yellow-500/20' },
      red: { bg: 'bg-red-500/10', text: 'text-red-400', iconBg: 'bg-red-500/20' },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Remarketing CRM</h1>
          <p className="text-slate-400 mt-1 text-sm sm:text-base">
            Gerencie contatos, mensagens e campanhas de remarketing
          </p>
        </div>
        <button
          onClick={loadStats}
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-[#162438] hover:bg-[#1e3a5f] text-white px-4 py-2.5 rounded-lg font-medium transition-all w-full sm:w-auto"
        >
          <RefreshCw className={`size-5 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((stat) => {
              const colors = getColorClasses(stat.color);
              return (
                <div
                  key={stat.label}
                  className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-4 sm:p-6"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-slate-400 text-sm">{stat.label}</p>
                      <p className="text-2xl sm:text-3xl font-bold text-white mt-1">
                        {stat.value}
                      </p>
                      {'total' in stat && stat.total && (
                        <p className="text-xs text-slate-500 mt-1">
                          de {stat.total} total
                        </p>
                      )}
                    </div>
                    <div className={`p-2 sm:p-3 rounded-lg ${colors.iconBg}`}>
                      <stat.icon className={`size-5 sm:size-6 ${colors.text}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Performance Cards */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Performance</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {performanceCards.map((stat) => {
                const colors = getColorClasses(stat.color);
                return (
                  <div
                    key={stat.label}
                    className={`${colors.bg} border border-[#1e3a5f] rounded-xl p-4 sm:p-6`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${colors.iconBg}`}>
                        <stat.icon className={`size-6 ${colors.text}`} />
                      </div>
                      <div>
                        <p className="text-slate-400 text-sm">{stat.label}</p>
                        <p className={`text-2xl font-bold ${colors.text}`}>
                          {stat.value}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Acoes Rapidas</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <a
                href="/admin/remarketing/contatos"
                className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-4 hover:bg-[#162438] transition-colors group"
              >
                <Users className="size-6 text-blue-400 mb-2" />
                <p className="font-medium text-white group-hover:text-blue-400 transition-colors">
                  Importar Contatos
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Sincronizar da Evolution
                </p>
              </a>
              <a
                href="/admin/remarketing/categorias"
                className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-4 hover:bg-[#162438] transition-colors group"
              >
                <Target className="size-6 text-purple-400 mb-2" />
                <p className="font-medium text-white group-hover:text-purple-400 transition-colors">
                  Criar Categoria
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Nova categoria de remarketing
                </p>
              </a>
              <a
                href="/admin/remarketing/mensagens"
                className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-4 hover:bg-[#162438] transition-colors group"
              >
                <MessageSquare className="size-6 text-green-400 mb-2" />
                <p className="font-medium text-white group-hover:text-green-400 transition-colors">
                  Criar Mensagem
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Novo template de mensagem
                </p>
              </a>
              <a
                href="/admin/remarketing/fila"
                className="bg-[#0f1f35] border border-[#1e3a5f] rounded-xl p-4 hover:bg-[#162438] transition-colors group"
              >
                <ListTodo className="size-6 text-orange-400 mb-2" />
                <p className="font-medium text-white group-hover:text-orange-400 transition-colors">
                  Ver Fila
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Gerenciar disparos
                </p>
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
