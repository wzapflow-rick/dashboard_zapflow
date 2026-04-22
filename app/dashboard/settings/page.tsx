'use client';

import React from 'react';
import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';
import {
  Settings as SettingsIcon,
  Store,
  Clock,
  MapPin,
  Bell,
  Shield,
  Save,
  ChevronRight,
  Plus,
  Trash2,
  Package,
  ShoppingBag,
  Info,
  Bot,
  Ticket,
  Award,
  Truck,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import { CurrencyInput } from '@/components/ui/currency-input';
import { TimeInput } from '@/components/ui/time-input';

import { getMe } from '@/app/actions/auth';
import { getCompanyDetails, updateCompany } from '@/app/actions/company';
import { getDeliveryRates, upsertDeliveryRate, deleteDeliveryRate } from '@/app/actions/delivery';
import { changePassword } from '@/app/actions/security';
import { getHorariosFuncionamento, saveHorariosFuncionamento, HorarioItem } from '@/app/actions/horarios';
import { toast } from 'sonner';
import CouponsManagement from '@/components/management/coupons-management';
import LoyaltyManagement from '@/components/management/loyalty-management';
import DriversManagement from '@/components/management/drivers-management';
import DeliveryHistory from '@/components/delivery/delivery-history';
const sections = [
  { id: 'general', name: 'Geral', icon: Store },
  { id: 'hours', name: 'Horários', icon: Clock },
  { id: 'delivery', name: 'Entrega', icon: MapPin },
  { id: 'drivers', name: 'Entregadores', icon: Truck },
  { id: 'deliveryHistory', name: 'Histórico', icon: Package },
  { id: 'generalRules', name: 'Regras Gerais', icon: Package },
  { id: 'coupons', name: 'Cupons', icon: Ticket },
  { id: 'loyalty', name: 'Fidelidade', icon: Award },
  { id: 'notifications', name: 'Notificações', icon: Bell },
  { id: 'security', name: 'Segurança', icon: Shield },
  { id: 'bot', name: 'Bot', icon: Bot },
];

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = React.useState('general');
  const [autoRadius, setAutoRadius] = React.useState(false);
  const [valorPorKm, setValorPorKm] = React.useState<number>(0);
  const [taxaEntregaFixa, setTaxaEntregaFixa] = React.useState<number>(0);
  const [packagingFeeEnabled, setPackagingFeeEnabled] = React.useState(false);
  const [neighborhoods, setNeighborhoods] = React.useState<any[]>([]);
  const [horarios, setHorarios] = React.useState<HorarioItem[]>([]);
  const [company, setCompany] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [valorEmbalagem, setValorEmbalagem] = React.useState<number>(0);
  const [inventoryControlEnabled, setInventoryControlEnabled] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  React.useEffect(() => {
    async function loadData() {
      try {
        const [compData, rates, hoursRes] = await Promise.all([
          getCompanyDetails(),
          getDeliveryRates(),
          getHorariosFuncionamento()
        ]);
        setCompany(compData);
        setNeighborhoods(rates || []);
        if (hoursRes && 'horarios' in hoursRes) {
          setHorarios(hoursRes.horarios as HorarioItem[]);
        }

        if (compData) {
          setPackagingFeeEnabled(!!compData.cobra_embalagem);
          setValorEmbalagem(Number(compData.valor_embalagem || 0));
          setAutoRadius(!!compData.raio_entrega_automatico);
          setValorPorKm(Number(compData.valor_por_km || 0));
          setTaxaEntregaFixa(Number(compData.taxa_entrega_fixa || 0));
          setInventoryControlEnabled(!!compData.controle_estoque);
        }
      } catch (err) {
        console.error('Erro ao carregar configurações:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSave = async () => {
    try {
      if (activeSection === 'general') {
        const form = document.getElementById('company-form') as HTMLFormElement;
        if (form) {
          const formData = new FormData(form);
          await updateCompany({
            nome_fantasia: (formData.get('nome_fantasia') as string),
            email: (formData.get('email') as string),
            chave_pix: (formData.get('chave_pix') as string),
            nome_recebedor_pix: (formData.get('nome_recebedor_pix') as string),
            nome_admin: (formData.get('nome_admin') as string),
            telefone_loja: (formData.get('telefone_loja') as string),
            cnpj: (formData.get('cnpj') as string),
            endereco: (formData.get('endereco') as string),
            cidade: (formData.get('cidade') as string),
            estado: (formData.get('estado') as string),
            instancia_evolution: (formData.get('instancia_evolution') as string),
            nincho: (formData.get('nincho') as string),
          });
        }
      }

      if (activeSection === 'delivery') {
        for (const n of neighborhoods) {
          await upsertDeliveryRate(n);
        }
        const form = document.getElementById('delivery-form') as HTMLFormElement;
        const deliveryData = form ? Object.fromEntries(new FormData(form)) : {};

        await updateCompany({
          raio_entrega_automatico: autoRadius,
          valor_por_km: valorPorKm,
          taxa_entrega_fixa: taxaEntregaFixa,
          lat_loja: deliveryData.lat_loja ? parseFloat(deliveryData.lat_loja as string) : undefined,
          lng_loja: deliveryData.lng_loja ? parseFloat(deliveryData.lng_loja as string) : undefined,
        });
      }

      if (activeSection === 'hours') {
        await saveHorariosFuncionamento(horarios, company?.nome_fantasia || 'Minha Loja');
      }

      if (activeSection === 'generalRules') {
        await updateCompany({
          cobra_embalagem: packagingFeeEnabled,
          valor_embalagem: valorEmbalagem,
          controle_estoque: inventoryControlEnabled
        });
        toast.success('Regras gerais atualizadas com sucesso!');
        return;
      }

      toast.success('Configurações salvas com sucesso!');
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      toast.error(err.message || 'Ocorreu um erro ao salvar.');
    }
  };

  const addNeighborhood = () => {
    setNeighborhoods([...neighborhoods, { id: null, bairro: '', valor_taxa: 0, tempo_estimado: '' }]);
  };

  const removeNeighborhood = async (id: number | null) => {
    if (id) {
      await deleteDeliveryRate(id);
    }
    setNeighborhoods(neighborhoods.filter(n => n.id !== id));
  };

  if (loading) {
    return (
      <SidebarProvider>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DashboardLayout>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <DashboardLayout>
        <div className="space-y-8">
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configurações</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Gerencie as preferências da sua unidade e regras de negócio.</p>
            </div>
            <button
              onClick={handleSave}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all"
            >
              <Save className="size-4" />
              Salvar Alterações
            </button>
          </header>

          <div className="flex flex-col lg:flex-row gap-8">
            <aside className="w-full lg:w-64 shrink-0">
              <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      "flex items-center justify-between px-4 py-3 rounded-xl transition-all whitespace-nowrap lg:w-full",
                      activeSection === section.id
                        ? "bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm text-primary font-bold"
                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <section.icon className="size-5 shrink-0" />
                      <span className="text-sm">{section.name}</span>
                    </div>
                    {activeSection === section.id && <ChevronRight className="size-4 hidden lg:block" />}
                  </button>
                ))}
              </nav>
            </aside>

            <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 sm:p-8 space-y-8 min-w-0">
              {activeSection === 'general' && (
                <div className="space-y-6">
                  <form id="company-form" className="space-y-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Informações da Loja</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Nome da Unidade</label>
                        <input name="nome_fantasia" type="text" defaultValue={company?.nome_fantasia || ''} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none dark:text-white" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Responsável (Admin)</label>
                        <input name="nome_admin" type="text" defaultValue={company?.nome_admin || ''} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none dark:text-white" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Chave PIX</label>
                        <input name="chave_pix" type="text" defaultValue={company?.chave_pix || ''} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none dark:text-white" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-200">E-mail de Contato</label>
                        <input name="email" type="email" defaultValue={company?.email || ''} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none dark:text-white" />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Responsável Financeiro</label>
                        <input name="nome_recebedor_pix" type="text" defaultValue={company?.nome_recebedor_pix || ''} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none dark:text-white" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-200">WhatsApp / Telefone da Loja</label>
                        <input name="telefone_loja" type="text" defaultValue={company?.telefone_loja || ''} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none dark:text-white placeholder:text-slate-400" placeholder="(00) 00000-0000" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-200">CNPJ (Opcional)</label>
                        <input name="cnpj" type="text" defaultValue={company?.cnpj || ''} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none dark:text-white placeholder:text-slate-400" placeholder="00.000.000/0000-00" />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Endereço Completo</label>
                        <input name="endereco" type="text" defaultValue={company?.endereco || ''} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none dark:text-white placeholder:text-slate-400" placeholder="Rua, Número, Bairro" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Cidade</label>
                        <input name="cidade" type="text" defaultValue={company?.cidade || ''} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none dark:text-white placeholder:text-slate-400" placeholder="Sua Cidade" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Estado (UF)</label>
                        <input name="estado" type="text" defaultValue={company?.estado || ''} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none dark:text-white placeholder:text-slate-400" placeholder="Ex: SP, RJ, MG" maxLength={2} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Instância Evolution API</label>
                        <div className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-400 text-sm">
                          <strong>Instância:</strong> {company?.instancia_evolution || 'Não configurada'}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Nicho do Negócio</label>
                        <select name="nincho" defaultValue={company?.nincho || 'pizzaria'} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none dark:text-white">
                          <option value="pizzaria">Pizzaria</option>
                          <option value="hamburgueria">Hamburgueria</option>
                          <option value="açaiteria">Açaiteria</option>
                          <option value="outros">Outros</option>
                        </select>
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {activeSection === 'hours' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Horário de Funcionamento</h3>
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {DIAS_SEMANA.map((day: string, idx: number) => {
                      const h = horarios.find(item => item.dia_semana === idx) || { dia_semana: idx, hora_abertura: '18:00', hora_fechamento: '23:30', fechado_o_dia_todo: true };
                      return (
                        <div key={day} className="py-4 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <input
                              type="checkbox"
                              checked={!h.fechado_o_dia_todo}
                              onChange={(e) => {
                                const newH = [...horarios];
                                const index = newH.findIndex(item => item.dia_semana === idx);
                                if (index >= 0) {
                                  newH[index].fechado_o_dia_todo = !e.target.checked;
                                } else {
                                  newH.push({ dia_semana: idx, hora_abertura: '18:00', hora_fechamento: '23:30', fechado_o_dia_todo: !e.target.checked });
                                }
                                setHorarios(newH);
                              }}
                              className="size-5 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
                            />
                            <span className="font-bold text-slate-700 dark:text-slate-200">{day}</span>
                          </div>
                          {!h.fechado_o_dia_todo && (
                            <div className="flex items-center gap-3">
                              <TimeInput
                                value={h.hora_abertura || '18:00'}
                                onChange={(val) => {
                                  const newH = [...horarios];
                                  const index = newH.findIndex(item => item.dia_semana === idx);
                                  if (index >= 0) newH[index].hora_abertura = val;
                                  setHorarios(newH);
                                }}
                                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-600 border-none rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                              />
                              <span className="text-slate-400 font-bold">às</span>
                              <TimeInput
                                value={h.hora_fechamento || '23:30'}
                                onChange={(val) => {
                                  const newH = [...horarios];
                                  const index = newH.findIndex(item => item.dia_semana === idx);
                                  if (index >= 0) newH[index].hora_fechamento = val;
                                  setHorarios(newH);
                                }}
                                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-600 border-none rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                              />
                            </div>
                          )}
                          {h.fechado_o_dia_todo && <span className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase">Fechado</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeSection === 'delivery' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Regras de Entrega</h3>
                    <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-700 rounded-lg">
                      <Info className="size-3.5 text-amber-600 dark:text-amber-400" />
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">Configuração de Frete</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">Raio de Entrega Automático</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Calcular frete baseado na distância (Google Maps)</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={autoRadius}
                            onChange={() => setAutoRadius(!autoRadius)}
                          />
                          <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>

                      <AnimatePresence>
                        {autoRadius && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <form id="delivery-form" className="pt-2 space-y-4">
                              <div className="flex flex-col sm:flex-row items-center gap-4">
                                <div className="flex-1 space-y-1.5 w-full">
                                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Valor Cobrado por KM (R$)</label>
                                  <div className="relative">
                                    <CurrencyInput
                                      defaultValue={valorPorKm}
                                      onValueChange={(val) => setValorPorKm(val)}
                                      className="w-full pr-4 py-2 bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Latitude da Loja</label>
                                  <input
                                    name="lat_loja"
                                    type="number"
                                    step="any"
                                    defaultValue={company?.lat_loja || ''}
                                    className="w-full px-4 py-2 bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
                                    placeholder="-23.5505"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Longitude da Loja</label>
                                  <input
                                    name="lng_loja"
                                    type="number"
                                    step="any"
                                    defaultValue={company?.lng_loja || ''}
                                    className="w-full px-4 py-2 bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
                                    placeholder="-46.6333"
                                  />
                                </div>
                              </div>
                            </form>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {!autoRadius && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-600"
                      >
                        {/* Taxa de Entrega Fixa */}
                        <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-xl border border-green-100 dark:border-green-800 space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">Taxa de Entrega Fixa</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Valor cobrado para todas as entregas (quando raio automático está desativado)</p>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Valor da Taxa (R$)</label>
                            <CurrencyInput
                              defaultValue={taxaEntregaFixa}
                              onValueChange={(val) => setTaxaEntregaFixa(val)}
                              className="w-full pr-4 py-2 bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Cadastro Manual de Bairros</h4>
                          <button
                            onClick={addNeighborhood}
                            className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                          >
                            <Plus className="size-3" /> Adicionar Bairro
                          </button>
                        </div>

                        <div className="space-y-3">
                          {neighborhoods.map((n, idx) => (
                            <div key={n.id || idx} className="flex flex-col sm:grid sm:grid-cols-12 gap-3 items-end p-3 bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-xl shadow-sm">
                              <div className="w-full sm:col-span-5 space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Bairro / Região</label>
                                <input
                                  type="text"
                                  value={n.bairro}
                                  onChange={(e) => {
                                    const updated = [...neighborhoods];
                                    updated[idx].bairro = e.target.value;
                                    setNeighborhoods(updated);
                                  }}
                                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 dark:text-white" placeholder="Ex: Centro" />
                              </div>
                              <div className="w-full sm:col-span-3 space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Taxa (R$)</label>
                                <CurrencyInput
                                  defaultValue={n.valor_taxa}
                                  onValueChange={(val) => {
                                    const updated = [...neighborhoods];
                                    updated[idx].valor_taxa = val;
                                    setNeighborhoods(updated);
                                  }}
                                  className="w-full pr-3 py-2 bg-slate-50 dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                              </div>
                              <div className="w-full sm:col-span-3 space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Tempo Est.</label>
                                <input
                                  type="text"
                                  value={n.tempo_estimado}
                                  onChange={(e) => {
                                    const updated = [...neighborhoods];
                                    updated[idx].tempo_estimado = e.target.value;
                                    setNeighborhoods(updated);
                                  }}
                                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 dark:text-white" placeholder="Ex: 30-40" />
                              </div>
                              <div className="w-full sm:col-span-1 flex justify-center sm:pb-2">
                                <button onClick={() => removeNeighborhood(n.id)} className="text-slate-300 hover:text-red-500 transition-colors p-2">
                                  <Trash2 className="size-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              )}

              {activeSection === 'generalRules' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Taxas e Regras Gerais</h3>
                  <div className="p-6 bg-slate-50 dark:bg-slate-700 rounded-2xl border border-slate-100 dark:border-slate-600 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-10 bg-white dark:bg-slate-600 rounded-xl shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300">
                          <Package className="size-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">Cobrar Taxa de Embalagem?</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Adiciona um valor fixo ao final de cada pedido.</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={packagingFeeEnabled}
                          onChange={() => setPackagingFeeEnabled(!packagingFeeEnabled)}
                        />
                        <div className="w-11 h-6 bg-slate-200 dark:bg-slate-500 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    <AnimatePresence>
                      {packagingFeeEnabled && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-4 flex items-center gap-4">
                            <div className="flex-1 space-y-1.5">
                              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Valor da Taxa (R$)</label>
                              <div className="relative">
                                <CurrencyInput
                                  defaultValue={valorEmbalagem}
                                  onValueChange={(val) => setValorEmbalagem(val)}
                                  className="w-full pr-4 py-2 bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
                                />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="p-6 bg-slate-50 dark:bg-slate-700 rounded-2xl border border-slate-100 dark:border-slate-600 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-10 bg-white dark:bg-slate-600 rounded-xl shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300">
                          <Package className="size-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">Controle de Estoque Ativo?</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Habilita avisos de falta de insumos e baixa automática no estoque.</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={inventoryControlEnabled}
                          onChange={() => setInventoryControlEnabled(!inventoryControlEnabled)}
                        />
                        <div className="w-11 h-6 bg-slate-200 dark:bg-slate-500 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'coupons' && (
                <CouponsManagement />
              )}

              {activeSection === 'loyalty' && (
                <LoyaltyManagement />
              )}

              {activeSection === 'drivers' && (
                <DriversManagement />
              )}

              {activeSection === 'deliveryHistory' && (
                <DeliveryHistory />
              )}

              {activeSection === 'notifications' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Bell className="size-5 text-primary" />
                    Notificações WhatsApp
                  </h3>

                  <div className="p-4 border border-slate-200 dark:border-slate-600 rounded-xl space-y-4">
                    <div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Testar Conexão</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Envie uma mensagem de teste para verificar se o WhatsApp está funcionando</p>
                    </div>

                    <div className="flex gap-3">
                      <input
                        type="tel"
                        placeholder="Número com DDD (ex: 79998618874)"
                        id="test-phone"
                        className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                      />
                      <button
                        onClick={async () => {
                          const input = document.getElementById('test-phone') as HTMLInputElement;
                          const phone = input?.value;
                          if (!phone || phone.length < 10) {
                            toast.error('Informe um número válido com DDD');
                            return;
                          }
                          toast.loading('Enviando mensagem de teste...', { id: 'whatsapp-test' });
                          try {
                            const { testWhatsApp } = await import('@/app/actions/whatsapp');
                            const result = await testWhatsApp(phone);
                            if (result.success) {
                              toast.success(`Mensagem enviada para ${result.formattedPhone}!`, { id: 'whatsapp-test' });
                            } else {
                              toast.error(`Falha: ${result.error || 'Erro desconhecido'}`, { id: 'whatsapp-test' });
                            }
                          } catch (error: any) {
                            toast.error(`Erro: ${error.message}`, { id: 'whatsapp-test' });
                          }
                        }}
                        className="px-6 py-2 bg-green-500 text-white rounded-lg text-sm font-bold hover:bg-green-600 transition-colors"
                      >
                        Enviar Teste
                      </button>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        <strong>Dica:</strong> Certifique-se de que a Evolution API está configurada corretamente nas variáveis de ambiente:
                        <code className="block mt-1 bg-amber-100 dark:bg-amber-900/50 px-2 py-1 rounded text-[10px]">EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE</code>
                      </p>
                    </div>
                  </div>

                  <div className="p-4 border border-slate-200 dark:border-slate-600 rounded-xl">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Mensagens Automáticas</p>
                    <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <span className="size-2 bg-green-500 rounded-full"></span>
                        <span>Pedido criado → Link de rastreamento</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="size-2 bg-green-500 rounded-full"></span>
                        <span>Status atualizado → Notificação ao cliente</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="size-2 bg-green-500 rounded-full"></span>
                        <span>Entregador atribuído → Dados da entrega</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'security' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Segurança e Acesso</h3>
                  <div className="p-4 border border-slate-200 dark:border-slate-600 rounded-xl space-y-3">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Alterar Senha do Painel</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="password"
                        placeholder="Nova senha"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                      />
                      <input
                        type="password"
                        placeholder="Confirmar nova senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        if (!newPassword || newPassword !== confirmPassword) {
                          toast.error('As senhas não coincidem ou estão vazias.');
                          return;
                        }
                        await changePassword(newPassword);
                        toast.success('Senha atualizada com sucesso!');
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Atualizar Senha
                    </button>
                  </div>

                  {/* Tutorial Button */}
                  <div className="p-4 border border-slate-200 dark:border-slate-600 rounded-xl">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Tutorial do Sistema</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Veja o tutorial de boas-vindas novamente para conhecer todas as funcionalidades</p>
                    <button
                      onClick={() => {
                        localStorage.removeItem('zapflow_onboarding_seen');
                        window.location.reload();
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-bold hover:opacity-90 transition-opacity"
                    >
                      <Sparkles className="size-4" />
                      Ver Tutorial
                    </button>
                  </div>
                </div>
              )}

              {activeSection === 'bot' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Bot className="size-6 text-primary" />
                    🤖 Assistente Virtual
                  </h3>

                  {/* Robot Hero Card com design único */}
                  <div className="relative overflow-hidden rounded-3xl">
                    {/* Background mesh dramático */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-200 via-orange-100 to-rose-100 dark:from-amber-900/30 dark:via-orange-900/20 dark:to-rose-900/20"></div>

                    {/* Grid pattern decoration */}
                    <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

                    {/* Floating shapes */}
                    <div className="absolute top-8 right-8 w-20 h-20 bg-gradient-to-br from-amber-300/20 to-orange-400/20 rounded-2xl rotate-12 animate-pulse"></div>
                    <div className="absolute bottom-16 left-12 w-16 h-16 bg-gradient-to-br from-rose-300/20 to-amber-300/20 rounded-full animate-ping delay-300"></div>
                    <div className="absolute top-1/2 right-1/4 w-4 h-4 bg-orange-400/60 rounded-full animate-pulse"></div>

                    <div className="relative p-8 sm:p-12 flex flex-col lg:flex-row items-center gap-10">
                      {/* Robot Character */}
                      <div className="relative flex-shrink-0">
                        {/* Outer glow ring */}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400 to-rose-500 blur-xl opacity-40 animate-pulse"></div>

                        {/* Robot body container */}
                        <div className="relative w-44 h-44 sm:w-52 sm:h-52">
                          {/* Animated rings */}
                          <div className="absolute inset-2 rounded-full border-2 border-amber-300/50 animate-[spin_8s_linear_infinite]"></div>
                          <div className="absolute inset-4 rounded-full border border-orange-300/30 animate-[spin_6s_linear_infinite_reverse]"></div>

                          {/* Main robot face */}
                          <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/70 dark:to-orange-900/70 rounded-[2.5rem] flex items-center justify-center shadow-2xl">
                            <div className="text-7xl sm:text-8xl filter drop-shadow-lg">
                              🤖
                            </div>
                          </div>

                          {/* Eyes */}
                          <div className="absolute top-1/3 left-1/4 w-3 h-3 sm:w-4 sm:h-4 bg-slate-800 dark:bg-slate-200 rounded-full animate-pulse shadow-lg"></div>
                          <div className="absolute top-1/3 right-1/4 w-3 h-3 sm:w-4 sm:h-4 bg-slate-800 dark:bg-slate-200 rounded-full animate-pulse delay-200 shadow-lg"></div>

                          {/* Smile */}
                          <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-8 h-4 border-b-4 border-slate-800 dark:border-slate-200 rounded-full"></div>
                        </div>

                        {/* Antenna */}
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                          <div className="w-2 h-8 bg-gradient-to-t from-amber-500 to-amber-400 rounded-full"></div>
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-amber-400 rounded-full animate-ping"></div>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 text-center lg:text-left space-y-6">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-100 dark:bg-amber-900/40 rounded-full">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                          </span>
                          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Em Desenvolvimento</span>
                        </div>

                        {/* Title */}
                        <div>
                          <h4 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                            Seu Novo<span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-rose-500"> Assistente</span> 🤖
                          </h4>
                          <p className="text-lg text-slate-600 dark:text-slate-300 mt-3 max-w-lg">
                            Um companion inteligente que vai revolucionar como você atiende seus clientes!
                          </p>
                        </div>

                        {/* Feature Pills */}
                        <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                          <div className="group px-5 py-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">💬</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-200">Atende 24/7</span>
                            </div>
                          </div>
                          <div className="group px-5 py-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">🛒</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-200">Pedidos Auto</span>
                            </div>
                          </div>
                          <div className="group px-5 py-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">🧠</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-200">IA Avançada</span>
                            </div>
                          </div>
                        </div>

                        {/* Progress info */}
                        <div className="pt-4">
                          <div className="flex items-center justify-center lg:justify-start gap-4">
                            <div className="flex -space-x-3">
                              {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 border-4 border-white dark:border-slate-900 flex items-center justify-center text-xs font-bold text-slate-500">
                                  {String.fromCharCode(64 + i)}
                                </div>
                              ))}
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Equipe trabalhando</p>
                              <p className="text-xs text-slate-500">Lançamento em breve!</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Coming Soon Banner */}
                  <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 p-px">
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/10 to-amber-500/0 animate-[shimmer_2s_linear_infinite]"></div>
                    <div className="relative p-6 sm:p-8 flex items-center justify-between">
                      <div>
                        <h5 className="text-white font-bold text-xl">Fique por dentro! 🔔</h5>
                        <p className="text-slate-400 mt-1">Quando lançada, você será notificado.</p>
                      </div>
                      <div className="hidden sm:block text-6xl">🚀</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </SidebarProvider>
  );
}
