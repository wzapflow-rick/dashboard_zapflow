'use client';

import React, { useState, useEffect, Suspense } from 'react';
import {
  CheckCircle2, ArrowRight, ChevronLeft,
  Utensils, Pizza, Beef, Coffee, IceCream, CakeSlice,
  QrCode, Check, Zap, Loader2, RefreshCw, Wifi, WifiOff, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { updateOnboarding } from '@/app/actions/auth';
import { saveHorariosFuncionamento } from '@/app/actions/horarios';
import { createEvolutionInstance, getEvolutionQRCode, getInstanceStatus } from '@/app/actions/evolution';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import { TimeInput } from '@/components/ui/time-input';

const steps = [
  { id: 1, name: 'Especialidade' },
  { id: 2, name: 'WhatsApp' },
  { id: 3, name: 'Horários' },
  { id: 4, name: 'Finalizar' },
];

const niches = [
  { id: 'pizzaria', name: 'Pizzaria', icon: Pizza },
  { id: 'hamburgueria', name: 'Hamburgueria', icon: Beef },
  { id: 'cafeteria', name: 'Cafeteria', icon: Coffee },
  { id: 'sorveteria', name: 'Sorveteria', icon: IceCream },
  { id: 'restaurante', name: 'Restaurante', icon: Utensils },
  { id: 'acaiteria', name: 'Açaíteria', icon: CakeSlice },
];

const DIAS_SEMANA = [
  { id: 1, label: 'Segunda-feira' },
  { id: 2, label: 'Terça-feira' },
  { id: 3, label: 'Quarta-feira' },
  { id: 4, label: 'Quinta-feira' },
  { id: 5, label: 'Sexta-feira' },
  { id: 6, label: 'Sábado' },
  { id: 0, label: 'Domingo' },
];

type HorarioState = {
  dia_semana: number;
  hora_abertura: string;
  hora_fechamento: string;
  fechado: boolean;
};

function OnboardingContent() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedNiche, setSelectedNiche] = useState('');
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Evolution API state
  const [instanceName, setInstanceName] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [loadingQr, setLoadingQr] = useState(false);

  // Horários state
  const [horarios, setHorarios] = useState<HorarioState[]>(
    DIAS_SEMANA.map(d => ({
      dia_semana: d.id,
      hora_abertura: '18:00',
      hora_fechamento: '23:00',
      fechado: d.id === 0, // domingo fechado por padrão
    }))
  );

  useEffect(() => {
    const nomeParam = searchParams.get('nome');
    if (nomeParam) setCompanyName(nomeParam);
  }, [searchParams]);

  // Poll connection status when on step 2
  useEffect(() => {
    if (currentStep !== 2 || !instanceName || connectionState === 'connected') return;
    const interval = setInterval(async () => {
      const res = await getInstanceStatus(instanceName);
      if (res.state === 'open') {
        setConnectionState('connected');
        setQrCode(null);
        toast.success('WhatsApp conectado com sucesso! 🎉');
        clearInterval(interval);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [currentStep, instanceName, connectionState]);

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 4));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  async function handleConnectWhatsApp() {
    setLoadingQr(true);
    setQrCode(null);
    setConnectionState('connecting');
    try {
      // 1. Cria a instância
      const createRes = await createEvolutionInstance(Date.now());
      if ('error' in createRes && createRes.error) {
        toast.error('Erro ao criar instância: ' + createRes.error);
        setConnectionState('disconnected');
        return;
      }
      const name = (createRes as any).instanceName;
      setInstanceName(name);

      // 2. Busca o QR Code
      await new Promise(r => setTimeout(r, 2000)); // aguarda instância inicializar
      const qrRes = await getEvolutionQRCode(name);
      if ('error' in qrRes && qrRes.error) {
        toast.error('Erro ao gerar QR Code');
        setConnectionState('disconnected');
        return;
      }
      if (qrRes.qrcode) setQrCode(qrRes.qrcode);
    } catch (e) {
      toast.error('Erro inesperado ao conectar');
      setConnectionState('disconnected');
    } finally {
      setLoadingQr(false);
    }
  }

  async function refreshQRCode() {
    if (!instanceName) return;
    setLoadingQr(true);
    const qrRes = await getEvolutionQRCode(instanceName);
    if (qrRes.qrcode) setQrCode(qrRes.qrcode);
    setLoadingQr(false);
  }

  function updateHorario(diaId: number, field: keyof HorarioState, value: any) {
    setHorarios(prev => prev.map(h => h.dia_semana === diaId ? { ...h, [field]: value } : h));
  }

  async function handleFinish() {
    setLoading(true);
    try {
      // 1. Salva os horários PRIMEIRO (antes de marcar onboarded=true)
      const currentCompanyName = companyName || (selectedNiche ? `Minha ${selectedNiche}` : 'Minha Empresa');
      const horariosParaSalvar = horarios.filter(h => !h.fechado);
      if (horariosParaSalvar.length > 0) {
        const horarioRes = await saveHorariosFuncionamento(horariosParaSalvar, currentCompanyName);
        if (horarioRes?.error) toast.warning('Horários: ' + horarioRes.error);
      }

      // 2. Salva dados do onboarding (nome fantasia + nicho) - marca onboarded=true na sessão
      const result = await updateOnboarding({
        nome: companyName || (selectedNiche ? `Minha ${selectedNiche}` : 'Minha Empresa'),
        nicho: selectedNiche,
        instancia_evolution: instanceName || undefined,
      });
      if (result?.error) { toast.error(result.error); setLoading(false); return; }

      toast.success('Configuração finalizada! 🚀');
      nextStep();
    } catch (e: any) {
      console.error('handleFinish ERROR:', e);
      toast.error('Erro ao salvar configurações: ' + (e?.message || 'desconhecido'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-primary/20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-white">
            <Zap className="size-5 fill-current" />
          </div>
          <span className="text-xl font-black tracking-tighter text-slate-900">ZapFlow</span>
        </div>

        <div className="hidden md:flex items-center gap-6">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center gap-2">
              <div className={cn(
                "size-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
                currentStep >= step.id ? "bg-primary text-white" : "bg-slate-200 text-slate-500"
              )}>
                {currentStep > step.id ? <Check className="size-3" /> : step.id}
              </div>
              <span className={cn(
                "text-xs font-bold uppercase tracking-wider",
                currentStep >= step.id ? "text-slate-900" : "text-slate-400"
              )}>{step.name}</span>
            </div>
          ))}
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full">
          <AnimatePresence mode="wait">

            {/* STEP 1: Especialidade */}
            {currentStep === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 text-center">
                <div className="space-y-4">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Qual o nome da sua empresa?</h2>
                  <input
                    type="text"
                    placeholder="Nome da sua loja"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full max-w-sm mx-auto bg-white border-2 border-slate-100 rounded-2xl py-4 px-6 text-center text-lg font-bold text-slate-800 outline-none focus:border-primary transition-all block"
                  />
                  <div className="pt-4">
                    <h3 className="text-xl font-bold text-slate-900">E o seu nicho?</h3>
                    <p className="text-slate-500 mt-2 text-sm">Isso nos ajuda a configurar seu cardápio.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {niches.map((niche) => (
                    <button key={niche.id} onClick={() => setSelectedNiche(niche.id)}
                      className={cn(
                        "p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 group",
                        selectedNiche === niche.id ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "border-white bg-white hover:border-slate-200 shadow-sm"
                      )}>
                      <div className={cn(
                        "size-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                        selectedNiche === niche.id ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
                      )}>
                        <niche.icon className="size-8" />
                      </div>
                      <span className={cn("font-bold text-sm", selectedNiche === niche.id ? "text-primary" : "text-slate-700")}>
                        {niche.name}
                      </span>
                    </button>
                  ))}
                </div>

                <button onClick={nextStep} disabled={!selectedNiche || !companyName}
                  className="w-full md:w-64 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/25 flex items-center justify-center gap-2 mx-auto transition-all">
                  Próximo Passo <ArrowRight className="size-5" />
                </button>
              </motion.div>
            )}

            {/* STEP 2: WhatsApp / QR Code */}
            {currentStep === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 text-center">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Conecte seu WhatsApp</h2>
                  <p className="text-slate-500 mt-2">Escaneie o QR Code abaixo para ativar a automação.</p>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl max-w-sm mx-auto relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-primary" />

                  {connectionState === 'connected' ? (
                    <div className="aspect-square flex flex-col items-center justify-center gap-4">
                      <div className="size-20 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Wifi className="size-10 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-black text-xl text-emerald-600">WhatsApp Conectado!</p>
                        <p className="text-slate-500 text-sm mt-1">{instanceName}</p>
                      </div>
                    </div>
                  ) : qrCode ? (
                    <div className="space-y-4">
                      <div className="aspect-square bg-white flex items-center justify-center rounded-xl overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={qrCode} alt="QR Code WhatsApp" className="w-full h-full object-contain" />
                      </div>
                      <button onClick={refreshQRCode} disabled={loadingQr}
                        className="flex items-center gap-2 text-xs text-slate-500 hover:text-primary mx-auto transition-colors">
                        <RefreshCw className={cn("size-3", loadingQr && "animate-spin")} />
                        Atualizar QR Code
                      </button>
                    </div>
                  ) : (
                    <div className="aspect-square bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center">
                      {loadingQr ? (
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="size-12 text-primary animate-spin" />
                          <span className="text-sm text-slate-500 font-medium">Gerando QR Code...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <QrCode className="size-16 text-slate-300" />
                          <span className="text-sm text-slate-400">Clique abaixo para gerar</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {connectionState !== 'connected' && !qrCode && !loadingQr && (
                  <button onClick={handleConnectWhatsApp}
                    className="w-full md:w-72 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 mx-auto transition-all">
                    <Zap className="size-5 fill-current" />
                    Gerar QR Code
                  </button>
                )}

                <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-2">
                  <button onClick={prevStep} className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-700 px-6 py-4">
                    <ChevronLeft className="size-5" /> Voltar
                  </button>
                  {connectionState === 'connected' && (
                    <button onClick={nextStep}
                      className="w-full md:w-64 bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/25 flex items-center justify-center gap-2 transition-all">
                      Próximo Passo
                      <ArrowRight className="size-5" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 3: Horários */}
            {currentStep === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                <div className="text-center">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Horário de Funcionamento</h2>
                  <p className="text-slate-500 mt-2">Defina quando sua loja estará aberta.</p>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="divide-y divide-slate-100">
                    {DIAS_SEMANA.map((dia) => {
                      const h = horarios.find(x => x.dia_semana === dia.id)!;
                      return (
                        <div key={dia.id} className={cn("p-4 flex items-center justify-between gap-4", h.fechado && "opacity-50")}>
                          <div className="flex items-center gap-3 min-w-[140px]">
                            <button
                              onClick={() => updateHorario(dia.id, 'fechado', !h.fechado)}
                              className={cn(
                                "size-5 rounded border-2 flex items-center justify-center transition-colors shrink-0",
                                !h.fechado ? "bg-primary border-primary text-white" : "border-slate-300"
                              )}>
                              {!h.fechado && <Check className="size-3" />}
                            </button>
                            <span className="font-bold text-slate-700 text-sm">{dia.label}</span>
                          </div>
                          {h.fechado ? (
                            <span className="text-xs text-slate-400 font-medium">Fechado</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <TimeInput value={h.hora_abertura}
                                onChange={val => updateHorario(dia.id, 'hora_abertura', val)}
                                className="px-2 py-1.5 bg-slate-100 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/30" />
                              <span className="text-slate-400 text-xs">às</span>
                              <TimeInput value={h.hora_fechamento}
                                onChange={val => updateHorario(dia.id, 'hora_fechamento', val)}
                                className="px-2 py-1.5 bg-slate-100 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/30" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                  <button onClick={prevStep} className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-700 px-6 py-4">
                    <ChevronLeft className="size-5" /> Voltar
                  </button>
                  <button onClick={handleFinish} disabled={loading}
                    className="w-full md:w-64 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/25 flex items-center justify-center gap-2 transition-all">
                    {loading ? <Loader2 className="size-5 animate-spin" /> : <>Finalizar e Salvar <ArrowRight className="size-5" /></>}
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 4: Conclusão */}
            {currentStep === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-8">
                <div className="size-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-100/50">
                  <CheckCircle2 className="size-12" />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">Tudo pronto, {companyName}!</h2>
                  <p className="text-slate-500 mt-4 text-lg max-w-md mx-auto">Sua loja já está configurada e pronta no ZapFlow.</p>
                </div>
                <button onClick={() => { router.push('/dashboard'); router.refresh(); }}
                  className="w-full md:w-64 bg-primary hover:bg-primary/90 text-white font-bold py-5 rounded-2xl shadow-xl shadow-primary/30 flex items-center justify-center gap-2 mx-auto transition-all active:scale-95">
                  Ir para o Painel <ArrowRight className="size-5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}
