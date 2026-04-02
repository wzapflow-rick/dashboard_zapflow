'use client';

import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Calendar, 
  Package, 
  DollarSign,
  Star,
  TrendingUp,
  Download,
  Filter
} from 'lucide-react';
import { motion } from 'motion/react';
import { getDrivers, Driver } from '@/app/actions/drivers';

interface DeliveryStats {
  driverId: number;
  driverName: string;
  totalDeliveries: number;
  totalValue: number;
  totalCommission: number;
  rating: number;
}

export default function DeliveryReport() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [stats, setStats] = useState<DeliveryStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const loadData = async () => {
    try {
      const driversData = await getDrivers();
      setDrivers(driversData);

      // Simular estatísticas (em produção, viria da API)
      const statsData: DeliveryStats[] = driversData.map(driver => ({
        driverId: driver.id!,
        driverName: driver.nome,
        totalDeliveries: driver.entregas_hoje || 0,
        totalValue: (driver.entregas_hoje || 0) * 35, // Valor médio simulado
        totalCommission: (driver.entregas_hoje || 0) * (driver.comissao_por_entrega || 0),
        rating: driver.avaliacao || 5.0,
      }));

      setStats(statsData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => `R$ ${price.toFixed(2).replace('.', ',')}`;

  const totalDeliveries = stats.reduce((sum, s) => sum + s.totalDeliveries, 0);
  const totalValue = stats.reduce((sum, s) => sum + s.totalValue, 0);
  const totalCommission = stats.reduce((sum, s) => sum + s.totalCommission, 0);
  const avgRating = stats.length > 0 
    ? stats.reduce((sum, s) => sum + s.rating, 0) / stats.length 
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Relatório de Entregas</h3>
          <p className="text-sm text-slate-500">Acompanhe o desempenho da equipe</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
          >
            <option value="today">Hoje</option>
            <option value="week">Esta Semana</option>
            <option value="month">Este Mês</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
            <Download className="size-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200 rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{totalDeliveries}</p>
              <p className="text-xs text-slate-500">Entregas</p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white border border-slate-200 rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="size-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{formatPrice(totalValue)}</p>
              <p className="text-xs text-slate-500">Faturamento</p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white border border-slate-200 rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="size-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{formatPrice(totalCommission)}</p>
              <p className="text-xs text-slate-500">Comissões</p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white border border-slate-200 rounded-xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Star className="size-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{avgRating.toFixed(1)}</p>
              <p className="text-xs text-slate-500">Avaliação Média</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Ranking de Entregadores */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h4 className="font-bold text-slate-900">Ranking de Entregadores</h4>
        </div>
        
        {stats.length === 0 ? (
          <div className="p-8 text-center">
            <Truck className="size-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum entregador cadastrado</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {stats
              .sort((a, b) => b.totalDeliveries - a.totalDeliveries)
              .map((stat, index) => {
                const driver = drivers.find(d => d.id === stat.driverId);
                const medals = ['🥇', '🥈', '🥉'];
                
                return (
                  <div key={stat.driverId} className="p-4 flex items-center gap-4">
                    <div className="size-10 bg-slate-100 rounded-full flex items-center justify-center text-lg">
                      {index < 3 ? medals[index] : `#${index + 1}`}
                    </div>
                    
                    <div className="flex-1">
                      <p className="font-bold text-slate-900">{stat.driverName}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Truck className="size-3" />
                          {driver?.veiculo || '-'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="size-3 text-amber-500" />
                          {stat.rating.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-bold text-slate-900">{stat.totalDeliveries} entregas</p>
                      <p className="text-xs text-green-600">{formatPrice(stat.totalCommission)} comissão</p>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Tabela Detalhada */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-bold text-slate-900">Detalhamento</h4>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Entregador</th>
                <th className="text-left px-4 py-3 font-medium">Veículo</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-center px-4 py-3 font-medium">Entregas</th>
                <th className="text-right px-4 py-3 font-medium">Comissão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {drivers.map((driver) => {
                const stat = stats.find(s => s.driverId === driver.id);
                return (
                  <tr key={driver.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="size-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">
                            {driver.nome.charAt(0)}
                          </span>
                        </div>
                        <span className="font-medium text-slate-900">{driver.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{driver.veiculo}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        driver.status === 'disponivel' ? 'bg-green-100 text-green-700' :
                        driver.status === 'ocupado' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {driver.status === 'disponivel' ? 'Disponível' :
                         driver.status === 'ocupado' ? 'Ocupado' : 'Offline'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-slate-900">
                      {stat?.totalDeliveries || 0}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-green-600">
                      {formatPrice(stat?.totalCommission || 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
