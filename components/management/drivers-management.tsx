'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  User, 
  Phone, 
  Car, 
  Star,
  Save,
  X,
  Loader2,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getDrivers, createDriver, updateDriver, deleteDriver, Driver } from '@/app/actions/drivers';
import { toast } from 'sonner';

export default function DriversManagement() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: '',
    veiculo: '',
    placa: '',
    comissao_por_entrega: 0,
  });

  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    try {
      const data = await getDrivers();
      setDrivers(data);
    } catch (error) {
      console.error('Erro ao carregar entregadores:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (driver?: Driver) => {
    if (driver) {
      setEditingDriver(driver);
      setFormData({
        nome: driver.nome,
        telefone: driver.telefone,
        email: driver.email || '',
        veiculo: driver.veiculo,
        placa: driver.placa || '',
        comissao_por_entrega: driver.comissao_por_entrega,
      });
    } else {
      setEditingDriver(null);
      setFormData({
        nome: '',
        telefone: '',
        email: '',
        veiculo: '',
        placa: '',
        comissao_por_entrega: 0,
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDriver(null);
  };

  const handleSubmit = async () => {
    if (!formData.nome || !formData.telefone || !formData.veiculo) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    try {
      if (editingDriver) {
        await updateDriver(editingDriver.id!, formData);
        toast.success('Entregador atualizado!');
      } else {
        await createDriver({
          ...formData,
          status: 'offline',
          entregas_hoje: 0,
          entregas_total: 0,
          avaliacao: 5.0,
          ativo: true,
        });
        toast.success('Entregador criado!');
      }
      
      await loadDrivers();
      closeModal();
    } catch (error) {
      toast.error('Erro ao salvar entregador');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este entregador?')) return;
    
    try {
      await deleteDriver(id);
      toast.success('Entregador excluído!');
      await loadDrivers();
    } catch (error) {
      toast.error('Erro ao excluir entregador');
    }
  };

  const toggleStatus = async (driver: Driver) => {
    const newStatus = driver.status === 'disponivel' ? 'offline' : 'disponivel';
    try {
      await updateDriver(driver.id!, { status: newStatus });
      await loadDrivers();
      toast.success(`Status alterado para ${newStatus}`);
    } catch (error) {
      toast.error('Erro ao alterar status');
    }
  };

  const getStatusBadge = (status: Driver['status']) => {
    switch (status) {
      case 'disponivel':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-bold">
            <CheckCircle className="size-3" />
            Disponível
          </span>
        );
      case 'ocupado':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-xs font-bold">
            <Clock className="size-3" />
            Ocupado
          </span>
        );
      case 'offline':
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full text-xs font-bold">
            <XCircle className="size-3" />
            Offline
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Entregadores</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie sua equipe de entregas</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors"
        >
          <Plus className="size-4" />
          Novo Entregador
        </button>
      </div>

      {/* Lista de Entregadores */}
      <div className="grid gap-4">
        {drivers.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-600">
            <Truck className="size-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhum entregador cadastrado</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Clique em &quot;Novo Entregador&quot; para começar</p>
          </div>
        ) : (
          drivers.map((driver) => (
            <motion.div
              key={driver.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="size-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center">
                    <User className="size-6 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 dark:text-white">{driver.nome}</h4>
                      {getStatusBadge(driver.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Phone className="size-3" />
                        {driver.telefone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Car className="size-3" />
                        {driver.veiculo}
                      </span>
                      {driver.placa && (
                        <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono">
                          {driver.placa}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1 text-xs">
                        <Star className="size-3 text-amber-500" />
                        {driver.avaliacao?.toFixed(1) || '5.0'}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {driver.entregas_hoje || 0} entregas hoje
                      </span>
                      <span className="text-xs text-primary font-bold">
                        R$ {driver.comissao_por_entrega?.toFixed(2) || '0,00'}/entrega
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleStatus(driver)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    title={driver.status === 'disponivel' ? 'Marcar offline' : 'Marcar disponível'}
                  >
                    {driver.status === 'disponivel' ? (
                      <XCircle className="size-4 text-slate-400 dark:text-slate-500" />
                    ) : (
                      <CheckCircle className="size-4 text-green-500" />
                    )}
                  </button>
                  <button
                    onClick={() => openModal(driver)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit2 className="size-4 text-slate-400 dark:text-slate-500" />
                  </button>
                  <button
                    onClick={() => handleDelete(driver.id!)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="size-4 text-red-400" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Modal de Cadastro/Edição */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700"
            >
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-white">
                  {editingDriver ? 'Editar Entregador' : 'Novo Entregador'}
                </h3>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="size-5 text-slate-400 dark:text-slate-500" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <User className="size-4" />
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Nome do entregador"
                    className="w-full mt-1 px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none dark:bg-slate-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <Phone className="size-4" />
                    WhatsApp *
                  </label>
                  <input
                    type="tel"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="(00) 00000-0000"
                    className="w-full mt-1 px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none dark:bg-slate-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <Mail className="size-4" />
                    E-mail (para login)
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                    className="w-full mt-1 px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none dark:bg-slate-700 dark:text-white"
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Opcional. Usado para o entregador fazer login no painel.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                      <Car className="size-4" />
                      Veículo *
                    </label>
                    <select
                      value={formData.veiculo}
                      onChange={(e) => setFormData({ ...formData, veiculo: e.target.value })}
                      className="w-full mt-1 px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none dark:bg-slate-700 dark:text-white"
                    >
                      <option value="">Selecione</option>
                      <option value="Moto">Moto</option>
                      <option value="Carro">Carro</option>
                      <option value="Bicicleta">Bicicleta</option>
                      <option value="A pé">A pé</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Placa</label>
                    <input
                      type="text"
                      value={formData.placa}
                      onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
                      placeholder="ABC-1234"
                      className="w-full mt-1 px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Comissão por Entrega (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.comissao_por_entrega}
                    onChange={(e) => setFormData({ ...formData, comissao_por_entrega: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full mt-1 px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none dark:bg-slate-700 dark:text-white"
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Valor pago por entrega concluída</p>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex gap-3">
                <button
                  onClick={closeModal}
                  className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="size-4" />
                  Salvar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
