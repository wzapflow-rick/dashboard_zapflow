'use client';

import React, { useState, useEffect } from 'react';
import {
  Award,
  Star,
  Users,
  TrendingUp,
  Settings,
  Gift,
  DollarSign,
  Save,
  Loader2,
  Crown,
  Medal,
  Trophy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getLoyaltyConfig, 
  saveLoyaltyConfig, 
  getAllClientsPoints, 
  getLoyaltyStats,
  calculatePointsValue 
} from '@/app/actions/loyalty';
import { toast } from 'sonner';

interface LoyaltyConfig {
  id?: number | string;
  pontos_por_real: number;
  valor_ponto: number;
  pontos_para_desconto: number;
  desconto_tipo: 'percentual' | 'valor_fixo';
  desconto_valor: number;
  pontos_para_item_gratis?: number;
  ativo: boolean;
}

interface ClientPoints {
  id?: number | string;
  cliente_telefone: string;
  cliente_nome?: string;
  pontos_acumulados: number;
  pontos_gastos: number;
  total_gasto: number;
}

interface LoyaltyStats {
  totalClientes: number;
  totalPontosAcumulados: number;
  totalPontosResgatados: number;
  pontosAtivos: number;
  topClients: ClientPoints[];
}

export default function LoyaltyManagement() {
  const [config, setConfig] = useState<LoyaltyConfig>({
    pontos_por_real: 1,
    valor_ponto: 0.10,
    pontos_para_desconto: 100,
    desconto_tipo: 'valor_fixo',
    desconto_valor: 10,
    ativo: false,
  });
  const [stats, setStats] = useState<LoyaltyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'clients'>('config');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [configData, statsData] = await Promise.all([
        getLoyaltyConfig(),
        getLoyaltyStats()
      ]);
      if (configData) setConfig(configData);
      if (statsData) setStats(statsData);
    } catch (error) {
      console.error('Erro ao carregar fidelidade:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveConfig() {
    try {
      setSaving(true);
      await saveLoyaltyConfig(config);
      toast.success('Configurações salvas!');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  function getRankIcon(position: number) {
    switch (position) {
      case 0:
        return <Crown className="size-5 text-yellow-500" />;
      case 1:
        return <Medal className="size-5 text-slate-400" />;
      case 2:
        return <Trophy className="size-5 text-amber-600" />;
      default:
        return <span className="text-sm font-bold text-slate-400">#{position + 1}</span>;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Award className="size-5 text-amber-500" />
            Programa de Fidelidade
          </h3>
          <p className="text-sm text-slate-500">Configure e gerencie o programa de pontos</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('config')}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === 'config' ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            <Settings className="size-4 inline mr-1.5" />
            Configuração
          </button>
          <button
            onClick={() => setActiveTab('clients')}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === 'clients' ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            <Users className="size-4 inline mr-1.5" />
            Clientes
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Users className="size-5 text-amber-600" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Clientes</p>
              <p className="text-lg font-bold text-slate-900">{stats?.totalClientes || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Star className="size-5 text-green-600" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Pontos Ativos</p>
              <p className="text-lg font-bold text-slate-900">{stats?.pontosAtivos || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Acumulados</p>
              <p className="text-lg font-bold text-slate-900">{stats?.totalPontosAcumulados || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Gift className="size-5 text-purple-600" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Resgatados</p>
              <p className="text-lg font-bold text-slate-900">{stats?.totalPontosResgatados || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'config' ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-6">
          {/* Ativar/Desativar */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div>
              <h4 className="font-bold text-slate-900">Programa de Fidelidade</h4>
              <p className="text-sm text-slate-500">Ativar ou desativar o programa de pontos</p>
            </div>
            <button
              onClick={() => setConfig({ ...config, ativo: !config.ativo })}
              className={cn(
                "relative w-14 h-7 rounded-full transition-colors",
                config.ativo ? "bg-primary" : "bg-slate-300"
              )}
            >
              <div className={cn(
                "absolute top-1 w-5 h-5 rounded-full bg-white transition-transform shadow-md",
                config.ativo ? "left-8" : "left-1"
              )} />
            </button>
          </div>

          <div className={cn("space-y-6", !config.ativo && "opacity-50 pointer-events-none")}>
            {/* Regras de Acúmulo */}
            <div className="space-y-4">
              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <Star className="size-4 text-amber-500" />
                Regras de Acúmulo
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-slate-700">Pontos por Real gasto</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={config.pontos_por_real}
                    onChange={(e) => setConfig({ ...config, pontos_por_real: parseFloat(e.target.value) || 1 })}
                    className="w-full mt-1 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                  <p className="text-xs text-slate-400 mt-1">Ex: 1 = 1 ponto a cada R$ 1,00</p>
                </div>
              </div>
            </div>

            {/* Regras de Resgate */}
            <div className="space-y-4">
              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <Gift className="size-4 text-purple-500" />
                Regras de Resgate
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-bold text-slate-700">Quantidade de Pontos</label>
                  <input
                    type="number"
                    min="1"
                    value={config.pontos_para_desconto}
                    onChange={(e) => setConfig({ ...config, pontos_para_desconto: parseInt(e.target.value) || 100 })}
                    className="w-full mt-1 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                  <p className="text-xs text-slate-400 mt-1">Pontos necessários para resgate</p>
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700">Tipo de Desconto</label>
                  <select
                    value={config.desconto_tipo}
                    onChange={(e) => setConfig({ ...config, desconto_tipo: e.target.value as any })}
                    className="w-full mt-1 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  >
                    <option value="valor_fixo">Valor Fixo (R$)</option>
                    <option value="percentual">Percentual (%)</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700">Valor do Desconto</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={config.desconto_valor}
                    onChange={(e) => setConfig({ ...config, desconto_valor: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    {config.desconto_tipo === 'valor_fixo' ? 'R$ por resgate' : '% do desconto'}
                  </p>
                </div>
              </div>

              {/* Preview */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <p className="text-sm text-slate-600">
                  <span className="font-bold">Exemplo:</span> A cada{' '}
                  <span className="font-bold text-primary">{config.pontos_para_desconto} pontos</span>,
                  o cliente ganha{' '}
                  <span className="font-bold text-primary">
                    {config.desconto_tipo === 'valor_fixo' 
                      ? `R$ ${config.desconto_valor.toFixed(2).replace('.', ',')}`
                      : `${config.desconto_valor}% de desconto`
                    }
                  </span>
                </p>
              </div>
            </div>

            {/* Botão Salvar */}
            <div className="flex justify-end">
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          {/* Top Clientes */}
          <div className="p-6 border-b border-slate-100">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <Trophy className="size-4 text-amber-500" />
              Top 10 Clientes com Mais Pontos
            </h4>
          </div>
          
          {stats?.topClients && stats.topClients.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {stats.topClients.map((client, index) => (
                <div key={client.cliente_telefone} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="size-10 flex items-center justify-center">
                      {getRankIcon(index)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{client.cliente_nome || 'Cliente'}</p>
                      <p className="text-xs text-slate-500">{client.cliente_telefone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{client.pontos_acumulados || 0} pts</p>
                    <p className="text-xs text-slate-500">
                      Disponíveis: {(client.pontos_acumulados || 0) - (client.pontos_gastos || 0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Users className="size-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Nenhum cliente com pontos ainda</p>
              <p className="text-sm text-slate-400 mt-1">Os pontos são acumulados quando os pedidos são finalizados</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
