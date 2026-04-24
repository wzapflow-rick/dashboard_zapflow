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
  Sparkles,
  Upload,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import { CurrencyInput } from '@/components/ui/currency-input';
import { TimeInput } from '@/components/ui/time-input';

import { getMe } from '@/app/actions/auth';
import { getCompanyDetails, updateCompany } from '@/app/actions/company';
import { getDeliveryRates, upsertDeliveryRate, deleteDeliveryRate, saveDeliveryRatesBatch } from '@/app/actions/delivery';
import { changePassword } from '@/app/actions/security';
import { getHorariosFuncionamento, saveHorariosFuncionamento, HorarioItem } from '@/app/actions/horarios';
import { uploadImageAction } from '@/app/actions/products';
import { toast } from 'sonner';
import CouponsManagement from '@/components/management/coupons-management';
import LoyaltyManagement from '@/components/management/loyalty-management';
import DriversManagement from '@/components/management/drivers-management';
import DeliveryHistory from '@/components/delivery/delivery-history';
import MercadoPagoConnection from '@/components/management/mercadopago-connection';
import { CreditCard as PaymentIcon } from 'lucide-react';

const sections = [
  { id: 'general', name: 'Geral', icon: Store },
  { id: 'hours', name: 'Horários', icon: Clock },
  { id: 'payments', name: 'Pagamentos', icon: PaymentIcon },
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
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialSection = searchParams?.get('section') || 'general';
  const [activeSection, setActiveSection] = React.useState(initialSection);
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
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = React.useState(false);

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
          setLogoUrl((compData.logo && typeof compData.logo === 'string') ? compData.logo : null);
        }
      } catch (err) {
        console.error('Erro ao carregar configurações:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      
      const { processImage, isValidImageFile, formatFileSize } = await import('@/lib/image-utils');
      
      if (!isValidImageFile(file)) {
        toast.error('Arquivo inválido. Use PNG, JPG, WebP ou GIF com até 10MB.');
        setUploadingLogo(false);
        return;
      }
      
      const processedFile = await processImage(file, {
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.85,
        format: 'jpeg'
      });
      
      const formData = new FormData();
      formData.append('image', processedFile);
      const url = await uploadImageAction(formData);
      
      if (url) {
        setLogoUrl(url);
        toast.success(`Logo carregada com sucesso! (${formatFileSize(processedFile.size)})`);
      }
    } catch (error: any) {
      console.error('Erro ao processar logo:', error);
      toast.error(error.message || 'Erro ao carregar logo. Tente novamente.');
    } finally {
      setUploadingLogo(false);
    }
  };

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
            logo: logoUrl
          });
        }
      }

      if (activeSection === 'delivery') {
        const res = await saveDeliveryRatesBatch(neighborhoods);
        if (!res || !res.success) {
           throw new Error('Falha ao salvar os bairros. Verifique se os dados estão corretos.');
        }
        
        if (res.count === 0 && neighborhoods.length > 0) {
           throw new Error('Nenhum bairro foi salvo. Verifique se os nomes dos bairros estão preenchidos.');
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
                  <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-700">
                    <div className="relative group">
                      <div className="size-24 rounded-2xl bg-slate-100 dark:bg-slate-700 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden relative">
                        {logoUrl ? (
                          <Image src={logoUrl} alt="Logo" fill className="object-cover" />
                        ) : (
                          <Store className="size-8 text-slate-400" />
                        )}
                        {uploadingLogo && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Loader2 className="size-6 text-white animate-spin" />
                          </div>
                        )}
                      </div>
                      <label className="absolute -bottom-2 -right-2 size-8 bg-primary text-white rounded-lg shadow-lg flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                        <Upload className="size-4" />
                        <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} />
                      </label>
                    </div>
                    <div className="text-center sm:text-left">
                      <h4 className="font-bold text-slate-900 dark:text-white">Logo da Loja</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Qualquer tamanho ou formato (PNG, JPG, WebP, GIF)</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Redimensionada automaticamente para 512x512px</p>
                      {logoUrl && (
                        <button onClick={() => setLogoUrl(null)} className="text-xs text-red-500 font-bold mt-2 hover:underline">Remover Logo</button>
                      )}
                    </div>
                  </div>

                  <form id="company-form" className="space-y-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Informações da Loja</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6">
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
                      const h = horarios.find(item => item.dia_semana === idx) || { dia_semana: idx, hora_abertura: '09:00', hora_fechamento: '23:30', fechado_o_dia_todo: false };
                      return (
                        <div key={day} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
                                  newH.push({ dia_semana: idx, hora_abertura: '09:00', hora_fechamento: '23:30', fechado_o_dia_todo: !e.target.checked });
                                }
                                setHorarios(newH);
                              }}
                              className="size-5 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
                            />
                            <span className="font-bold text-slate-700 dark:text-slate-200 min-w-[100px]">{day}</span>
                          </div>
                          {!h.fechado_o_dia_todo && (
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                              <div className="flex items-center gap-2 w-full sm:w-auto">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 sm:hidden">Abre:</label>
                                <TimeInput
                                  value={h.hora_abertura || '09:00'}
                                  onChange={(val) => {
                                    const newH = [...horarios];
                                    const index = newH.findIndex(item => item.dia_semana === idx);
                                    if (index >= 0) newH[index].hora_abertura = val;
                                    setHorarios(newH);
                                  }}
                                  className="flex-1 sm:flex-none px-3 py-1.5 bg-slate-100 dark:bg-slate-600 border-none rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                                />
                              </div>
                              <span className="text-slate-400 font-bold hidden sm:inline">às</span>
                              <div className="flex items-center gap-2 w-full sm:w-auto">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 sm:hidden">Fecha:</label>
                                <TimeInput
                                  value={h.hora_fechamento || '23:30'}
                                  onChange={(val) => {
                                    const newH = [...horarios];
                                    const index = newH.findIndex(item => item.dia_semana === idx);
                                    if (index >= 0) newH[index].hora_fechamento = val;
                                    setHorarios(newH);
                                  }}
                                  className="flex-1 sm:flex-none px-3 py-1.5 bg-slate-100 dark:bg-slate-600 border-none rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                                />
                              </div>
                            </div>
                          )}
                          {h.fechado_o_dia_todo && (
                            <span className="text-xs font-bold text-red-500 uppercase tracking-wider bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full">Fechado</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeSection === 'payments' && (
                <MercadoPagoConnection />
              )}

              {activeSection === 'delivery' && (
                <div className="space-y-8">
                  <div className="p-6 bg-slate-50 dark:bg-slate-700 rounded-2xl border border-slate-100 dark:border-slate-600 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-10 bg-white dark:bg-slate-600 rounded-xl shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300">
                          <MapPin className="size-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">Cálculo Automático por Raio?</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Usa o Google Maps para calcular a taxa baseada na distância.</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={autoRadius}
                          onChange={() => setAutoRadius(!autoRadius)}
                        />
                        <div className="w-11 h-6 bg-slate-200 dark:bg-slate-500 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
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
                          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Valor por KM (R$)</label>
                              <CurrencyInput
                                defaultValue={valorPorKm}
                                onValueChange={(val) => setValorPorKm(val)}
                                className="w-full pr-4 py-2 bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Taxa Base/Fixa (R$)</label>
                              <CurrencyInput
                                defaultValue={taxaEntregaFixa}
                                onValueChange={(val) => setTaxaEntregaFixa(val)}
                                className="w-full pr-4 py-2 bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white"
                              />
                            </div>
                            <form id="delivery-form" className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Latitude da Loja</label>
                                <input name="lat_loja" type="number" step="any" defaultValue={company?.lat_loja || ''} className="w-full px-4 py-2 bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none dark:text-white" />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Longitude da Loja</label>
                                <input name="lng_loja" type="number" step="any" defaultValue={company?.lng_loja || ''} className="w-full px-4 py-2 bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none dark:text-white" />
                              </div>
                            </form>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Taxas por Bairro</h3>
                      <button
                        onClick={addNeighborhood}
                        className="text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                      >
                        <Plus className="size-4" />
                        Adicionar Bairro
                      </button>
                    </div>

                    {neighborhoods.length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                        <MapPin className="size-8 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum bairro configurado.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {neighborhoods.map((n, idx) => (
                          <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-100 dark:border-slate-600">
                            <div className="flex flex-col sm:flex-row gap-4">
                              <div className="flex-1 space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Nome do Bairro</label>
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
                              <div className="w-full sm:w-32 space-y-1">
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
                              <div className="w-full sm:w-32 space-y-1">
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
                              <div className="flex items-end">
                                <button onClick={() => removeNeighborhood(n.id)} className="text-slate-300 hover:text-red-500 transition-colors p-2">
                                  <Trash2 className="size-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
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
                </div>
              )}

              {activeSection === 'security' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Segurança</h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Nova Senha</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none dark:text-white"
                        placeholder="Mínimo 6 caracteres"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Confirmar Nova Senha</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none dark:text-white"
                        placeholder="Repita a nova senha"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        if (!newPassword || newPassword.length < 6) {
                          toast.error('A senha deve ter pelo menos 6 caracteres');
                          return;
                        }
                        if (newPassword !== confirmPassword) {
                          toast.error('As senhas não coincidem');
                          return;
                        }
                        try {
                          await changePassword(newPassword);
                          setNewPassword('');
                          setConfirmPassword('');
                          toast.success('Senha alterada com sucesso!');
                        } catch (error: any) {
                          toast.error(error.message || 'Erro ao alterar senha');
                        }
                      }}
                      className="px-6 py-2.5 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all"
                    >
                      Alterar Senha
                    </button>
                  </div>
                </div>
              )}

              {activeSection === 'bot' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="size-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                      <Bot className="size-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">ZapFlow AI Bot</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Configurações do assistente inteligente de vendas.</p>
                    </div>
                  </div>

                  <div className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl text-center space-y-4">
                    <div className="size-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto">
                      <Sparkles className="size-8 text-slate-300" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">Em Breve</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">Estamos finalizando a integração do bot de IA para automatizar seus pedidos.</p>
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
