'use client';

import React, { useState, useEffect } from 'react';
import {
  Ticket,
  Plus,
  Edit,
  Trash2,
  Percent,
  DollarSign,
  Calendar,
  Users,
  TrendingUp,
  X,
  Check,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { getCoupons, upsertCoupon, deleteCoupon, getCouponStats } from '@/app/actions/coupons';
import { toast } from 'sonner';

interface Coupon {
  id?: number | string;
  codigo: string;
  tipo: 'percentual' | 'valor_fixo';
  valor: number;
  valor_minimo_pedido: number;
  limite_uso?: number;
  usos_atuais: number;
  data_inicio?: string;
  data_fim?: string;
  ativo: boolean;
}

interface CouponStats {
  totalCoupons: number;
  activeCoupons: number;
  totalUsage: number;
}

export default function CouponsManagement() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [stats, setStats] = useState<CouponStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState<Partial<Coupon>>({
    codigo: '',
    tipo: 'percentual',
    valor: 0,
    valor_minimo_pedido: 0,
    ativo: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [couponsData, statsData] = await Promise.all([
        getCoupons(),
        getCouponStats()
      ]);
      setCoupons(couponsData);
      setStats(statsData);
    } catch (error) {
      console.error('Erro ao carregar cupons:', error);
      toast.error('Erro ao carregar cupons');
    } finally {
      setLoading(false);
    }
  }

  function openModal(coupon?: Coupon) {
    if (coupon) {
      setEditingCoupon(coupon);
      setFormData(coupon);
    } else {
      setEditingCoupon(null);
      setFormData({
        codigo: '',
        tipo: 'percentual',
        valor: 0,
        valor_minimo_pedido: 0,
        limite_uso: undefined,
        data_inicio: '',
        data_fim: '',
        ativo: true,
      });
    }
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingCoupon(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await upsertCoupon({
        ...formData,
        id: editingCoupon?.id,
      });
      toast.success(editingCoupon ? 'Cupom atualizado!' : 'Cupom criado!');
      closeModal();
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar cupom');
    }
  }

  async function handleDelete(id: number | string) {
    if (!confirm('Tem certeza que deseja excluir este cupom?')) return;
    try {
      await deleteCoupon(id);
      toast.success('Cupom excluído!');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir cupom');
    }
  }

  function toggleCouponStatus(coupon: Coupon) {
    setFormData({ ...formData, ativo: !coupon.ativo });
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
      {/* Header com Stats */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Ticket className="size-5 text-primary" />
            Cupons de Desconto
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie os cupons de desconto da sua loja</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-all"
        >
          <Plus className="size-4" />
          Novo Cupom
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Ticket className="size-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total de Cupons</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{stats?.totalCoupons || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <Check className="size-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Ativos</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{stats?.activeCoupons || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <TrendingUp className="size-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total de Usos</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{stats?.totalUsage || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Cupons */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
        {coupons.length === 0 ? (
          <div className="py-12 text-center">
            <Ticket className="size-12 text-slate-200 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhum cupom criado</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Crie seu primeiro cupom de desconto</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-600">
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Código</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Valor</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Usos</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                {coupons.map((coupon) => (
                  <tr key={coupon.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-600 px-2 py-1 rounded">
                        {coupon.codigo}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {coupon.tipo === 'percentual' ? (
                          <>
                            <Percent className="size-3.5 text-blue-500" />
                            <span className="text-sm text-slate-600 dark:text-slate-300">Percentual</span>
                          </>
                        ) : (
                          <>
                            <DollarSign className="size-3.5 text-green-500" />
                            <span className="text-sm text-slate-600 dark:text-slate-300">Valor Fixo</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {coupon.tipo === 'percentual' ? `${coupon.valor}%` : `R$ ${coupon.valor.toFixed(2).replace('.', ',')}`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        {coupon.usos_atuais || 0}
                        {coupon.limite_uso && ` / ${coupon.limite_uso}`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                        coupon.ativo ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                      )}>
                        {coupon.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openModal(coupon)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <Edit className="size-4 text-slate-400 dark:text-slate-500" />
                        </button>
                        <button
                          onClick={() => handleDelete(coupon.id!)}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="size-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Criar/Editar */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingCoupon ? 'Editar Cupom' : 'Novo Cupom'}
                  </h3>
                  <button onClick={closeModal} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                    <X className="size-5 text-slate-400 dark:text-slate-500" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Código do Cupom</label>
                  <input
                    type="text"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                    className="w-full mt-1 px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono dark:bg-slate-700 dark:text-white"
                    placeholder="EXEMPLO20"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Tipo</label>
                    <select
                      value={formData.tipo}
                      onChange={(e) => setFormData({ ...formData, tipo: e.target.value as any })}
                      className="w-full mt-1 px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none dark:bg-slate-700 dark:text-white"
                    >
                      <option value="percentual">Percentual (%)</option>
                      <option value="valor_fixo">Valor Fixo (R$)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Valor</label>
                    <input
                      type="number"
                      step={formData.tipo === 'percentual' ? '1' : '0.01'}
                      min="0"
                      value={formData.valor}
                      onChange={(e) => setFormData({ ...formData, valor: parseFloat(e.target.value) || 0 })}
                      className="w-full mt-1 px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none dark:bg-slate-700 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Valor Mínimo (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.valor_minimo_pedido}
                      onChange={(e) => setFormData({ ...formData, valor_minimo_pedido: parseFloat(e.target.value) || 0 })}
                      className="w-full mt-1 px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Limite de Usos</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.limite_uso || ''}
                      onChange={(e) => setFormData({ ...formData, limite_uso: e.target.value ? parseInt(e.target.value) : undefined })}
                      className="w-full mt-1 px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none dark:bg-slate-700 dark:text-white"
                      placeholder="Ilimitado"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Data Início</label>
                    <input
                      type="date"
                      value={formData.data_inicio || ''}
                      onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                      className="w-full mt-1 px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Data Fim</label>
                    <input
                      type="date"
                      value={formData.data_fim || ''}
                      onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                      className="w-full mt-1 px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, ativo: !formData.ativo })}
                    className={cn(
                      "relative w-12 h-6 rounded-full transition-colors",
                      formData.ativo ? "bg-primary" : "bg-slate-200 dark:bg-slate-600"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm",
                      formData.ativo ? "left-7" : "left-1"
                    )} />
                  </button>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Cupom {formData.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors"
                  >
                    {editingCoupon ? 'Salvar' : 'Criar Cupom'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
