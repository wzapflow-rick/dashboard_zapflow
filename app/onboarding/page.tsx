'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, ChefHat, Clock3, Coffee, IceCream, PackagePlus, Pizza, Sparkles, Store, Utensils, Beef, WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { updateOnboarding } from '@/app/actions/auth';
import { saveHorariosFuncionamento } from '@/app/actions/horarios';
import { getOnboardingCompany, updateCompany } from '@/app/actions/company';
import { upsertCategory, upsertProduct } from '@/app/actions/products';

type DaySchedule = { id: number; label: string; open: boolean; start: string; end: string };

const days = [
  { id: 1, label: 'Segunda' }, { id: 2, label: 'Terça' }, { id: 3, label: 'Quarta' },
  { id: 4, label: 'Quinta' }, { id: 5, label: 'Sexta' }, { id: 6, label: 'Sábado' }, { id: 0, label: 'Domingo' },
];
const niches = [
  { id: 'pizzaria', label: 'Pizzaria', icon: Pizza, category: 'Pizzas' },
  { id: 'hamburgueria', label: 'Hamburgueria', icon: Beef, category: 'Hambúrgueres' },
  { id: 'cafeteria', label: 'Cafeteria', icon: Coffee, category: 'Cafés' },
  { id: 'sorveteria', label: 'Sorveteria', icon: IceCream, category: 'Sorvetes' },
  { id: 'restaurante', label: 'Restaurante', icon: Utensils, category: 'Pratos' },
  { id: 'acaiteria', label: 'Açaíteria', icon: IceCream, category: 'Açaí' },
  { id: 'outros', label: 'Outro negócio', icon: Store, category: 'Mais pedidos' },
];
const planCharacters: Record<string, { label: string; image: string; accent: string; glow: string }> = {
  parceria: { label: 'Parceria', image: '/onboarding/mascot-parceria.png', accent: '#C084FC', glow: 'rgba(168,85,247,.24)' },
  start: { label: 'Start', image: '/onboarding/mascot-start.jpg', accent: '#38BDF8', glow: 'rgba(14,165,233,.22)' },
  pro: { label: 'Pro', image: '/onboarding/mascot-pro.jpg', accent: '#A3E635', glow: 'rgba(132,204,22,.22)' },
  elite: { label: 'Elite', image: '/onboarding/mascot-elite.jpg', accent: '#FBBF24', glow: 'rgba(251,191,36,.2)' },
};
const stepNames = ['Sua loja', 'Primeiro produto', 'Horários'];
function characterFor(value: unknown) {
  const plan = String(value || 'start').toLowerCase();
  if (plan.includes('parceria')) return planCharacters.parceria;
  if (plan.includes('elite')) return planCharacters.elite;
  if (plan.includes('pro')) return planCharacters.pro;
  return planCharacters.start;
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nameFromQuery = searchParams.get('nome');
  const [step, setStep] = useState(1);
  const [companyLoading, setCompanyLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [niche, setNiche] = useState('');
  const [plan, setPlan] = useState('start');
  const [firstProduct, setFirstProduct] = useState('');
  const [firstPrice, setFirstPrice] = useState('');
  const [firstDescription, setFirstDescription] = useState('');
  const [categoryName, setCategoryName] = useState('Mais pedidos');
  const [hours, setHours] = useState<DaySchedule[]>(days.map((day) => ({ ...day, open: false, start: '18:00', end: '23:00' })));
  const persona = useMemo(() => characterFor(plan), [plan]);

  useEffect(() => {
    let active = true;
    async function loadCompany() {
      try {
        const company = await getOnboardingCompany();
        if (!active) return;
        if (!company?.id) { window.location.href = '/login?from=/onboarding'; return; }
        setCompanyName(nameFromQuery || String(company.nome_fantasia || ''));
        setNiche(String(company.nincho || ''));
        setPlan(String(company.planos || company.plano || 'start'));
        const existing = niches.find((item) => item.id === String(company.nincho || ''));
        if (existing) setCategoryName(existing.category);
      } catch (error) {
        console.error('Erro ao carregar a empresa para configuração:', error);
        window.location.href = '/login?from=/onboarding';
      } finally {
        if (active) setCompanyLoading(false);
      }
    }
    loadCompany();
    return () => { active = false; };
  }, [nameFromQuery]);

  const characterLines = [
    'Oi! Eu vou te acompanhar para colocar sua loja no ar. Vamos no seu ritmo.',
    'Agora vamos cadastrar um item simples. Depois você pode incluir fotos e completar o cardápio.',
    'Só falta dizer quando a loja funciona. Você poderá mudar esses horários quando quiser.',
    'Pronto! Sua loja já tem um começo. O restante pode ser feito quando for melhor para você.',
  ];
  const characterLine = characterLines[Math.min(step - 1, characterLines.length - 1)];

  function toggleDay(id: number, open: boolean) {
    setHours((previous) => previous.map((day) => day.id === id ? { ...day, open } : day));
  }
  function updateTime(id: number, key: 'start' | 'end', value: string) {
    setHours((previous) => previous.map((day) => day.id === id ? { ...day, [key]: value } : day));
  }
  async function persistStore(allowFallback = false) {
    const name = companyName.trim() || (allowFallback ? 'Minha loja' : '');
    if (!name) throw new Error('Digite o nome da sua loja para continuar.');
    await updateCompany({ nome_fantasia: name, nincho: niche || undefined });
    if (!companyName.trim()) setCompanyName(name);
    return name;
  }
  async function saveFirstProduct() {
    const name = firstProduct.trim();
    const price = Number(firstPrice.replace(',', '.'));
    if (name.length < 2) throw new Error('Digite o nome do primeiro produto.');
    if (!firstPrice || !Number.isFinite(price) || price < 0) throw new Error('Informe um preço válido para o produto.');
    const category = await upsertCategory({ nome: categoryName.trim() || 'Mais pedidos', ordem: 0 });
    const categoryId = Number(category?.id);
    if (!Number.isFinite(categoryId) || categoryId <= 0) throw new Error('Não consegui criar a categoria. Tente novamente ou adicione o produto depois.');
    await upsertProduct({
      nome: name, preco: price, descricao: firstDescription.trim(), categoria_id: categoryId,
      imagem: '', imagem_url: '', disponivel: true,
    });
  }
  async function saveHours(closedAll = false, storeName?: string) {
    const schedule = hours.map((day) => ({
      dia_semana: day.id, hora_abertura: day.start, hora_fechamento: day.end,
      fechado_o_dia_todo: closedAll || !day.open,
    }));
    const result = await saveHorariosFuncionamento(schedule, storeName || companyName.trim() || 'Minha loja');
    if (result?.error) throw new Error(result.error);
  }
  async function completeJourney(keepClosed = false) {
    setSaving(true);
    try {
      const name = await persistStore(keepClosed);
      const hasOpenDay = hours.some((day) => day.open);
      await saveHours(keepClosed || !hasOpenDay, name);
      const result = await updateOnboarding({ nome: name, nicho: niche });
      if (result?.error) throw new Error(result.error);
      setStep(4);
      toast.success(keepClosed || !hasOpenDay
        ? 'Tudo salvo. Sua loja ficará fechada até você configurar os horários.'
        : 'Configuração salva. Sua loja já pode receber pedidos!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar sua configuração.');
    } finally { setSaving(false); }
  }
  async function handleStoreContinue() {
    setSaving(true);
    try { await persistStore(); setStep(2); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Não consegui salvar os dados da loja.'); }
    finally { setSaving(false); }
  }
  async function handleProductContinue() {
    setSaving(true);
    try { await saveFirstProduct(); toast.success('Primeiro produto adicionado ao seu cardápio!'); setStep(3); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Não consegui salvar o produto.'); }
    finally { setSaving(false); }
  }
  async function handleDefer() { await completeJourney(true); }

  return (
    <main className="min-h-screen overflow-hidden bg-[#07100B] text-white selection:bg-lime-300/30">
      <div className="pointer-events-none fixed inset-0 opacity-80" aria-hidden="true">
        <div className="absolute -left-40 -top-48 size-[34rem] rounded-full blur-[130px]" style={{ background: persona.glow }} />
        <div className="absolute -bottom-56 -right-36 size-[38rem] rounded-full bg-lime-400/10 blur-[150px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,.06),transparent_40%)]" />
      </div>
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <a href="/dashboard" className="flex items-center gap-3" aria-label="ZapFlash">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-lime-300 text-[#10200f] shadow-[0_8px_30px_rgba(163,230,53,.18)]"><WandSparkles className="size-5" /></span>
          <span className="text-lg font-black tracking-tight">Zap<span className="text-lime-300">Flash</span></span>
          <span className="hidden rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400 sm:inline-flex">Plano {persona.label}</span>
        </a>
        {step < 4 && <button type="button" onClick={handleDefer} disabled={saving} className="rounded-full px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50 sm:px-4 sm:text-sm">{saving ? 'Salvando…' : 'Continuar depois'}</button>}
      </header>
      <section className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-10 pt-2 sm:px-8 sm:pb-16">
        {step < 4 && (
          <div className="mx-auto mb-7 max-w-5xl">
            <div className="mb-3 flex items-center justify-between text-xs"><span className="font-semibold text-slate-300">Sua primeira configuração</span><span className="text-slate-500">Etapa {step} de 3</span></div>
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full" style={{ background: persona.accent }} initial={false} animate={{ width: (step / 3 * 100) + '%' }} transition={{ duration: 0.55, ease: 'easeOut' }} /></div>
            <div className="grid grid-cols-3 gap-2">
              {stepNames.map((name, index) => <div key={name} className={cn('text-[10px] font-bold uppercase tracking-[.12em] sm:text-xs', index + 1 <= step ? 'text-white' : 'text-slate-600')}>
                <span className="mr-1.5 inline-flex size-5 items-center justify-center rounded-full border text-[10px]" style={index + 1 < step ? { color: '#07100B', background: persona.accent, borderColor: persona.accent } : index + 1 === step ? { color: persona.accent, borderColor: persona.accent } : { color: '#64748B', borderColor: 'rgba(255,255,255,.12)' }}>{index + 1 < step ? <Check className="size-3" /> : index + 1}</span>{name}
              </div>)}
            </div>
          </div>
        )}
        <div className="mx-auto grid max-w-5xl items-stretch gap-5 lg:grid-cols-[.82fr_1.18fr]">
          <motion.aside initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="relative min-h-[410px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#0D1912] sm:min-h-[450px] lg:min-h-[600px]" style={{ boxShadow: '0 25px 100px ' + persona.glow }}>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(163,230,53,.13),transparent_62%)]" />
            <div className="absolute left-5 top-5 z-20 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-slate-300 backdrop-blur"><Sparkles className="size-3" style={{ color: persona.accent }} />Seu guia ZapFlash</div>
            <div className="absolute bottom-32 left-0 right-0 top-14 sm:bottom-36 sm:top-12">
              <Image src={persona.image} alt={'Personagem do plano ' + persona.label} fill priority sizes="(max-width: 1024px) 100vw, 40vw" className={cn('object-contain object-bottom', persona.label !== 'Parceria' && 'mix-blend-screen')} />
            </div>
            <AnimatePresence mode="wait"><motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute bottom-3 left-4 right-4 z-20 rounded-2xl border border-white/10 bg-[#09120D]/95 p-3 shadow-xl backdrop-blur sm:bottom-4 sm:left-5 sm:right-5 sm:p-4">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[.16em]" style={{ color: persona.accent }}>{step === 1 ? 'Vamos começar' : step === 2 ? 'Muito bem!' : step === 3 ? 'Último passo' : 'Conseguimos!'}</p>
              <p className="text-xs leading-relaxed text-slate-200 sm:text-sm">{characterLine}</p>
            </motion.div></AnimatePresence>
          </motion.aside>
          <section className="min-h-[500px] rounded-[2rem] border border-white/10 bg-[#0C1510]/95 p-5 shadow-2xl backdrop-blur-xl sm:p-8 lg:min-h-[600px]">
            <AnimatePresence mode="wait">
              {step === 1 && <motion.div key="store" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="flex h-full flex-col">
                <div className="mb-7"><div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-white/5" style={{ color: persona.accent }}><Store className="size-5" /></div><p className="mb-2 text-xs font-bold uppercase tracking-[.18em]" style={{ color: persona.accent }}>Etapa 1 · Sua loja</p><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Como vamos chamar sua loja?</h1><p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-400">Esse nome aparece no seu cardápio. Você poderá mudar depois.</p></div>
                <label className="mb-6 block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Nome da loja</span><input value={companyName} onChange={(event) => setCompanyName(event.target.value)} disabled={companyLoading} placeholder="Ex.: Cantinho da Pizza" maxLength={80} className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-base font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-lime-300/60 focus:ring-4 focus:ring-lime-300/10" /><span className="mt-2 block text-xs text-slate-500">Se esse nome não for o da sua loja, é só trocar aqui.</span></label>
                <div className="mb-7"><span className="mb-3 block text-xs font-bold uppercase tracking-wider text-slate-400">O que você vende?</span><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {niches.map((item) => { const Icon = item.icon; const selected = niche === item.id; return <button key={item.id} type="button" disabled={companyLoading} onClick={() => { setNiche(item.id); setCategoryName(item.category); }} className={cn('flex min-h-20 flex-col items-start justify-center gap-2 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5', selected ? 'bg-white/[.07]' : 'border-white/10 bg-white/[.02] hover:border-white/20')} style={selected ? { borderColor: persona.accent, boxShadow: '0 0 0 3px ' + persona.glow } : undefined}><Icon className="size-4" style={{ color: selected ? persona.accent : '#94A3B8' }} /><span className={cn('text-xs font-semibold', selected ? 'text-white' : 'text-slate-300')}>{item.label}</span></button>; })}
                </div></div>
                <div className="mt-auto flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between"><span className="text-xs text-slate-500">Leva menos de 2 minutos</span><button type="button" onClick={handleStoreContinue} disabled={companyLoading || saving || !companyName.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-black text-[#10200F] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45" style={{ background: persona.accent }}>{companyLoading ? 'Carregando loja…' : saving ? 'Salvando…' : 'Continuar'} <ArrowRight className="size-4" /></button></div>
              </motion.div>}
              {step === 2 && <motion.div key="product" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="flex h-full flex-col">
                <div className="mb-6"><div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-white/5" style={{ color: persona.accent }}><PackagePlus className="size-5" /></div><p className="mb-2 text-xs font-bold uppercase tracking-[.18em]" style={{ color: persona.accent }}>Etapa 2 · Primeiro produto</p><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Vamos colocar um campeão no cardápio</h1><p className="mt-2 text-sm leading-relaxed text-slate-400">Comece com um produto. Foto e detalhes podem ser adicionados depois.</p></div>
                <div className="space-y-4">
                  <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Nome do produto</span><input value={firstProduct} onChange={(event) => setFirstProduct(event.target.value)} placeholder="Ex.: X-Burger da casa" maxLength={100} className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 font-semibold outline-none transition placeholder:text-slate-600 focus:border-lime-300/60 focus:ring-4 focus:ring-lime-300/10" /></label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Preço</span><div className="flex items-center rounded-2xl border border-white/10 bg-black/25 px-4 focus-within:border-lime-300/60"><span className="mr-2 text-sm font-bold text-slate-500">R$</span><input inputMode="decimal" value={firstPrice} onChange={(event) => setFirstPrice(event.target.value.replace(/[^\d,\.]/g, ''))} placeholder="29,90" className="w-full bg-transparent py-3.5 font-semibold outline-none placeholder:text-slate-600" /></div></label>
                    <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Categoria</span><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Ex.: Mais pedidos" maxLength={50} className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 font-semibold outline-none transition placeholder:text-slate-600 focus:border-lime-300/60 focus:ring-4 focus:ring-lime-300/10" /></label>
                  </div>
                  <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Descrição <span className="font-normal normal-case tracking-normal text-slate-600">· opcional</span></span><textarea value={firstDescription} onChange={(event) => setFirstDescription(event.target.value)} placeholder="Conte em poucas palavras o que torna esse produto especial." rows={3} maxLength={240} className="w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-600 focus:border-lime-300/60 focus:ring-4 focus:ring-lime-300/10" /></label>
                  <div className="flex items-start gap-2 rounded-xl bg-lime-300/[.06] p-3 text-xs leading-relaxed text-slate-400"><Sparkles className="mt-0.5 size-4 shrink-0" style={{ color: persona.accent }} /><span>Uma foto bonita ajuda a vender. Você pode colocar a imagem quando terminar este começo rápido.</span></div>
                </div>
                <div className="mt-auto flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={() => setStep(1)} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white"><ArrowLeft className="size-4" /> Voltar</button><div className="flex flex-col-reverse gap-2 sm:flex-row"><button type="button" onClick={() => setStep(3)} className="rounded-xl px-4 py-3 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white">Adicionar depois</button><button type="button" onClick={handleProductContinue} disabled={saving || firstProduct.trim().length < 2 || !firstPrice} className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-black text-[#10200F] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45" style={{ background: persona.accent }}>{saving ? 'Salvando…' : 'Adicionar produto'} <ArrowRight className="size-4" /></button></div></div>
              </motion.div>}
              {step === 3 && <motion.div key="hours" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="flex h-full flex-col">
                <div className="mb-6"><div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-white/5" style={{ color: persona.accent }}><Clock3 className="size-5" /></div><p className="mb-2 text-xs font-bold uppercase tracking-[.18em]" style={{ color: persona.accent }}>Etapa 3 · Horários</p><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Quando sua loja atende?</h1><p className="mt-2 text-sm leading-relaxed text-slate-400">Marque os dias e ajuste os horários. Você pode editar tudo depois.</p></div>
                <div className="mb-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setHours((prev) => prev.map((day) => ({ ...day, open: day.id >= 1 && day.id <= 6 })))} className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:border-white/25 hover:bg-white/5">Seg. a sáb.</button>
                  <button type="button" onClick={() => setHours((prev) => prev.map((day) => ({ ...day, open: true })))} className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:border-white/25 hover:bg-white/5">Todos os dias</button>
                  <button type="button" onClick={() => setHours((prev) => prev.map((day) => ({ ...day, open: false })))} className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-slate-400 transition hover:border-white/25 hover:bg-white/5">Limpar</button>
                </div>
                <div className="space-y-2">{hours.map((day) => <div key={day.id} className={cn('grid grid-cols-[1fr_1fr_1fr] items-center gap-2 rounded-xl border px-3 py-2.5 transition sm:grid-cols-[1.05fr_1fr_1fr]', day.open ? 'border-white/10 bg-white/[.035]' : 'border-white/5 bg-black/10 opacity-60')}>
                  <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={day.open} onChange={(event) => toggleDay(day.id, event.target.checked)} className="size-4 accent-lime-400" /><span className="text-xs font-semibold sm:text-sm">{day.label}</span></label>
                  {day.open ? <><input aria-label={'Abertura ' + day.label} type="time" value={day.start} onChange={(event) => updateTime(day.id, 'start', event.target.value)} className="min-w-0 rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs text-white outline-none focus:border-lime-300/60" /><input aria-label={'Fechamento ' + day.label} type="time" value={day.end} onChange={(event) => updateTime(day.id, 'end', event.target.value)} className="min-w-0 rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs text-white outline-none focus:border-lime-300/60" /></> : <span className="col-span-2 text-right text-[11px] text-slate-600">Fechado</span>}
                </div>)}</div>
                <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Se preferir continuar depois, sua loja ficará fechada até você configurar os horários.</p>
                <div className="mt-auto flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={() => setStep(2)} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white"><ArrowLeft className="size-4" /> Voltar</button><div className="flex flex-col-reverse gap-2 sm:flex-row"><button type="button" onClick={handleDefer} disabled={saving} className="rounded-xl px-4 py-3 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50">Fazer depois</button><button type="button" onClick={() => completeJourney(false)} disabled={saving || !hours.some((day) => day.open)} className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-black text-[#10200F] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45" style={{ background: persona.accent }}>{saving ? 'Salvando…' : 'Salvar e concluir'} <ArrowRight className="size-4" /></button></div></div>
              </motion.div>}
              {step === 4 && <motion.div key="done" initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} className="flex h-full flex-col justify-center">
                <div className="mb-6 flex size-14 items-center justify-center rounded-2xl text-[#10200F]" style={{ background: persona.accent }}><Check className="size-7" strokeWidth={3} /></div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[.18em]" style={{ color: persona.accent }}>Seu começo está pronto</p><h1 className="max-w-xl text-3xl font-black tracking-tight sm:text-4xl">Mandou bem, {companyName.trim().split(/\s+/)[0] || 'empreendedor'}!</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">O próximo passo está no seu painel. Você pode completar o cardápio, conectar o WhatsApp e ativar pagamentos quando quiser.</p>
                <div className="my-7 grid gap-3 sm:grid-cols-3">{[{ label: 'Loja', done: true }, { label: 'Primeiro produto', done: !!firstProduct.trim() }, { label: 'Horários', done: hours.some((day) => day.open) }].map((item) => <div key={item.label} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.03] p-3"><span className={cn('flex size-6 items-center justify-center rounded-full', item.done ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/5 text-slate-500')}>{item.done ? <Check className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current" />}</span><span className="text-xs font-semibold text-slate-200">{item.label}</span></div>)}</div>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={() => router.push('/dashboard')} className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-black text-[#10200F] transition hover:brightness-110" style={{ background: persona.accent }}>Ir para meu painel <ArrowRight className="size-4" /></button><button type="button" onClick={() => router.push('/dashboard/menu')} className="rounded-xl border border-white/10 px-5 py-3.5 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white">Completar meu cardápio</button></div>
              </motion.div>}
            </AnimatePresence>
          </section>
        </div>
        <footer className="mx-auto mt-6 flex max-w-5xl items-center justify-center gap-2 text-[11px] text-slate-600"><ChefHat className="size-3.5" />Uma configuração simples hoje. Sua loja evolui com você.</footer>
      </section>
    </main>
  );
}

export default function OnboardingPage() {
  return <Suspense fallback={<div className="min-h-screen bg-[#07100B]" />}><OnboardingContent /></Suspense>;
}
