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
  RefreshCw,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { getDashboardStats } from '@/app/actions/remarketing';
import Link from 'next/link';

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
      href: '/admin/remarketing/contatos',
    },
    {
      label: 'Categorias',
      value: stats.totalCategorias,
      icon: Target,
      color: 'purple',
      href: '/admin/remarketing/categorias',
    },
    {
      label: 'Templates',
      value: stats.totalMensagens,
      icon: MessageSquare,
      color: 'green',
      href: '/admin/remarketing/mensagens',
    },
    {
      label: 'Fila Pendente',
      value: stats.filaPendente,
      icon: ListTodo,
      color: 'orange',
      href: '/admin/remarketing/fila',
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
    const colors: Record<string, { bg: string; text: string; iconBg: string; border: string }> = {
      blue: { bg: 'bg-blue-500/5', text: 'text-blue-400', iconBg: 'bg-blue-500/15', border: 'border-blue-500/20' },
      purple: { bg: 'bg-purple-500/5', text: 'text-purple-400', iconBg: 'bg-purple-500/15', border: 'border-purple-500/20' },
      green: { bg: 'bg-green-500/5', text: 'text-green-400', iconBg: 'bg-green-500/15', border: 'border-green-500/20' },
      orange: { bg: 'bg-orange-500/5', text: 'text-orange-400', iconBg: 'bg-orange-500/15', border: 'border-orange-500/20' },
      emerald: { bg: 'bg-emerald-500/5', text: 'text-emerald-400', iconBg: 'bg-emerald-500/15', border: 'border-emerald-500/20' },
      cyan: { bg: 'bg-cyan-500/5', text: 'text-cyan-400', iconBg: 'bg-cyan-500/15', border: 'border-cyan-500/20' },
      yellow: { bg: 'bg-yellow-500/5', text: 'text-yellow-400', iconBg: 'bg-yellow-500/15', border: 'border-yellow-500/20' },
      red: { bg: 'bg-red-500/5', text: 'text-red-400', iconBg: 'bg-red-500/15', border: 'border-red-500/20' },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Remarketing CRM</h1>
          <p className="text-slate-400 mt-1">
            Gerencie contatos, mensagens e campanhas de remarketing
          </p>
        </div>
        <button
          onClick={loadStats}
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-[#1e3a5f] hover:bg-[#2a4a6f] text-white px-4 py-2.5 rounded-xl font-medium transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          <span>Atualizar</span>
        </button>
      </div>

      {loading && !stats ? (
        <div className="flex justify-center py-20">
          <Loader2 className="size-8 animate-spin text-orange-500" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((stat) => {
              const colors = getColorClasses(stat.color);
              return (
                <Link
                  key={stat.label}
                  href={stat.href}
                  className={`bg-[#0f1f35] border ${colors.border} rounded-2xl p-5 hover:bg-[#162438] transition-all group`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-slate-400 text-sm">{stat.label}</p>
                      <p className="text-3xl font-bold text-white mt-2">
                        {stat.value}
                      </p>
                      {'total' in stat && stat.total && (
                        <p className="text-xs text-slate-500 mt-1">
                          de {stat.total} total
                        </p>
                      )}
                    </div>
                    <div className={`p-3 rounded-xl ${colors.iconBg}`}>
                      <stat.icon className={`size-6 ${colors.text}`} />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-sm text-slate-500 group-hover:text-slate-400 transition-colors">
                    <span>Ver detalhes</span>
                    <ArrowRight className="size-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
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
                    className={`${colors.bg} border ${colors.border} rounded-2xl p-5`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${colors.iconBg}`}>
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
              <Link
                href="/admin/remarketing/contatos"
                className="bg-[#0f1f35] border border-[#1e3a5f] rounded-2xl p-5 hover:bg-[#162438] hover:border-[#2a4a6f] transition-all group"
              >
                <div className="p-3 bg-blue-500/10 rounded-xl w-fit mb-3">
                  <Users className="size-6 text-blue-400" />
                </div>
                <p className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                  Importar Contatos
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Sincronizar da Evolution
                </p>
              </Link>
              <Link
                href="/admin/remarketing/categorias"
                className="bg-[#0f1f35] border border-[#1e3a5f] rounded-2xl p-5 hover:bg-[#162438] hover:border-[#2a4a6f] transition-all group"
              >
                <div className="p-3 bg-purple-500/10 rounded-xl w-fit mb-3">
                  <Target className="size-6 text-purple-400" />
                </div>
                <p className="font-semibold text-white group-hover:text-purple-400 transition-colors">
                  Criar Categoria
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Nova categoria de remarketing
                </p>
              </Link>
              <Link
                href="/admin/remarketing/mensagens"
                className="bg-[#0f1f35] border border-[#1e3a5f] rounded-2xl p-5 hover:bg-[#162438] hover:border-[#2a4a6f] transition-all group"
              >
                <div className="p-3 bg-green-500/10 rounded-xl w-fit mb-3">
                  <MessageSquare className="size-6 text-green-400" />
                </div>
                <p className="font-semibold text-white group-hover:text-green-400 transition-colors">
                  Criar Mensagem
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Novo template de mensagem
                </p>
              </Link>
              <Link
                href="/admin/remarketing/fila"
                className="bg-[#0f1f35] border border-[#1e3a5f] rounded-2xl p-5 hover:bg-[#162438] hover:border-[#2a4a6f] transition-all group"
              >
                <div className="p-3 bg-orange-500/10 rounded-xl w-fit mb-3">
                  <ListTodo className="size-6 text-orange-400" />
                </div>
                <p className="font-semibold text-white group-hover:text-orange-400 transition-colors">
                  Ver Fila
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Gerenciar disparos
                </p>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
