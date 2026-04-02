'use client';

import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  MapPin, 
  Clock, 
  DollarSign,
  User,
  Search,
  Filter,
  Calendar,
  Package,
  CheckCircle,
  Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getDrivers, getAllDeliveries, Driver } from '@/app/actions/drivers';
import { toast } from 'sonner';

interface DeliveryRecord {
  id: number;
  pedido_id: number;
  entregador_id: number;
  entregador_nome: string;
  entregador_veiculo: string;
  endereco: string;
  bairro: string;
  valor_pedido: number;
  taxa_entrega: number;
  comissao: number;
  status: string;
  atribuida_em: string;
  entregue_em: string;
}

export default function DeliveryHistory() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [filteredDeliveries, setFilteredDeliveries] = useState<DeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'all'>('today');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterDeliveries();
  }, [deliveries, searchTerm, selectedDriver, selectedPeriod]);

  const loadData = async () => {
    try {
      const [driversData, deliveriesData] = await Promise.all([
        getDrivers(),
        getAllDeliveries(500)
      ]);
      setDrivers(driversData);
      setDeliveries(deliveriesData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  };

  const filterDeliveries = () => {
    let filtered = [...deliveries];

    // Filtro por período
    const now = new Date();
    if (selectedPeriod === 'today') {
      const today = now.toISOString().split('T')[0];
      filtered = filtered.filter(d => d.entregue_em?.startsWith(today));
    } else if (selectedPeriod === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(d => new Date(d.entregue_em) >= weekAgo);
    } else if (selectedPeriod === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(d => new Date(d.entregue_em) >= monthAgo);
    }

    // Filtro por entregador
    if (selectedDriver) {
      filtered = filtered.filter(d => d.entregador_id === selectedDriver);
    }

    // Filtro por busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(d => 
        d.pedido_id?.toString().includes(term) ||
        d.entregador_nome?.toLowerCase().includes(term) ||
        d.endereco?.toLowerCase().includes(term) ||
        d.bairro?.toLowerCase().includes(term)
      );
    }

    setFilteredDeliveries(filtered);
  };

  const formatPrice = (price: number) => `R$ ${Number(price || 0).toFixed(2).replace('.', ',')}`;
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  // Calcular totais
  const totalDeliveries = filteredDeliveries.length;
  const totalRevenue = filteredDeliveries.reduce((sum, d) => sum + Number(d.valor_pedido || 0), 0);
  const totalCommission = filteredDeliveries.reduce((sum, d) => sum + Number(d.comissao || 0), 0);
  const totalDeliveryFee = filteredDeliveries.reduce((sum, d) => sum + Number(d.taxa_entrega || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Histórico de Entregas</h3>
          <p className="text-sm text-slate-500">Todas as entregas realizadas</p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
        >
          Atualizar
        </button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{totalDeliveries}</p>
              <p className="text-xs text-slate-500">Entregas</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="size-5 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{formatPrice(totalRevenue)}</p>
              <p className="text-xs text-slate-500">Faturamento</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Truck className="size-5 text-amber-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{formatPrice(totalDeliveryFee)}</p>
              <p className="text-xs text-slate-500">Taxas</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <User className="size-5 text-purple-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{formatPrice(totalCommission)}</p>
              <p className="text-xs text-slate-500">Comissões</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Busca */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
            <input
              type="text"
              placeholder="Buscar por pedido, entregador, endereço..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>

          {/* Entregador */}
          <select
            value={selectedDriver || ''}
            onChange={(e) => setSelectedDriver(e.target.value ? Number(e.target.value) : null)}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
          >
            <option value="">Todos entregadores</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.nome}</option>
            ))}
          </select>

          {/* Período */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
          >
            <option value="today">Hoje</option>
            <option value="week">Últimos 7 dias</option>
            <option value="month">Últimos 30 dias</option>
            <option value="all">Todos</option>
          </select>
        </div>
      </div>

      {/* Lista de Entregas */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredDeliveries.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="size-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhuma entrega encontrada</p>
            <p className="text-sm text-slate-400 mt-1">As entregas finalizadas aparecerão aqui</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Pedido</th>
                  <th className="text-left px-4 py-3 font-medium">Entregador</th>
                  <th className="text-left px-4 py-3 font-medium">Endereço</th>
                  <th className="text-center px-4 py-3 font-medium">Data/Hora</th>
                  <th className="text-right px-4 py-3 font-medium">Valor</th>
                  <th className="text-right px-4 py-3 font-medium">Comissão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDeliveries.map((delivery) => (
                  <tr key={delivery.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-900">#{delivery.pedido_id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-900">{delivery.entregador_nome}</p>
                        <p className="text-xs text-slate-500">{delivery.entregador_veiculo}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-slate-600 truncate" title={delivery.endereco}>
                        {delivery.endereco || delivery.bairro || '-'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500">
                      {formatDate(delivery.entregue_em)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      {formatPrice(delivery.valor_pedido)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-green-600">
                      {formatPrice(delivery.comissao)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resumo por Entregador */}
      {filteredDeliveries.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h4 className="font-bold text-slate-900 mb-4">Resumo por Entregador</h4>
          <div className="space-y-3">
            {(() => {
              const summary = new Map<number, { nome: string; veiculo: string; entregas: number; comissao: number }>();
              
              filteredDeliveries.forEach(d => {
                const existing = summary.get(d.entregador_id) || { 
                  nome: d.entregador_nome, 
                  veiculo: d.entregador_veiculo,
                  entregas: 0, 
                  comissao: 0 
                };
                summary.set(d.entregador_id, {
                  ...existing,
                  entregas: existing.entregas + 1,
                  comissao: existing.comissao + Number(d.comissao || 0)
                });
              });

              return Array.from(summary.entries())
                .sort((a, b) => b[1].entregas - a[1].entregas)
                .map(([id, data]) => (
                  <div key={id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="size-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <User className="size-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{data.nome}</p>
                        <p className="text-xs text-slate-500">{data.veiculo}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">{data.entregas} entregas</p>
                      <p className="text-sm text-green-600">{formatPrice(data.comissao)}</p>
                    </div>
                  </div>
                ));
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
