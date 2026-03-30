'use client';

import React from 'react';
import DashboardLayout, { SidebarProvider } from '@/components/dashboard-layout';
import { 
  Check, 
  CreditCard, 
  Zap, 
  ShieldCheck, 
  History,
  ArrowRight,
  Star
} from 'lucide-react';
import { cn } from '@/lib/utils';

const plans = [
  { 
    name: 'Essencial', 
    price: 'R$ 97', 
    period: '/mês',
    desc: 'Ideal para quem está começando no delivery.',
    features: ['Até 300 pedidos/mês', 'Cardápio Digital', 'Gestão de Pedidos', 'Suporte via Chat'],
    current: false
  },
  { 
    name: 'Pro', 
    price: 'R$ 197', 
    period: '/mês',
    desc: 'O plano mais completo para escalar suas vendas.',
    features: ['Pedidos Ilimitados', 'Recuperação de Carrinhos (IA)', 'Relatórios Avançados', 'Suporte Prioritário', 'Múltiplos Atendentes'],
    current: true,
    popular: true
  },
  { 
    name: 'Enterprise', 
    price: 'Sob Consulta', 
    period: '',
    desc: 'Para redes de franquias e grandes operações.',
    features: ['Multi-unidades', 'API de Integração', 'Gerente de Conta', 'SLA Garantido'],
    current: false
  },
];

export default function SubscriptionPage() {
  return (
    <SidebarProvider>
      <DashboardLayout>
        <div className="space-y-8">
          <header>
            <h1 className="text-2xl font-bold text-slate-900">Assinatura e Cobrança</h1>
            <p className="text-slate-500 text-sm mt-1">Gerencie seu plano, métodos de pagamento e histórico de faturas.</p>
          </header>

          {/* Current Plan Status */}
          <div className="bg-primary rounded-2xl p-8 text-white flex flex-col md:flex-row justify-between items-center gap-8 shadow-xl shadow-primary/20">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-bold uppercase tracking-wider">
                <Star className="size-3 fill-current" />
                Plano Atual: Pro
              </div>
              <h2 className="text-3xl font-black">Sua próxima fatura é em 15 de Outubro</h2>
              <p className="text-white/70 font-medium">Valor: R$ 197,00 • Cartão final 4242</p>
            </div>
            <div className="flex gap-3 shrink-0">
              <button className="px-6 py-3 bg-white text-primary font-bold rounded-xl hover:bg-slate-50 transition-all">Alterar Plano</button>
              <button className="px-6 py-3 bg-white/10 border border-white/20 text-white font-bold rounded-xl hover:bg-white/20 transition-all">Cancelar</button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div 
                key={plan.name} 
                className={cn(
                  "bg-white rounded-3xl border p-8 flex flex-col relative overflow-hidden",
                  plan.popular ? "border-primary ring-4 ring-primary/5" : "border-slate-200"
                )}
              >
                {plan.popular && (
                  <div className="absolute top-4 right-4">
                    <span className="bg-primary text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">Popular</span>
                  </div>
                )}
                
                <div className="mb-8">
                  <h3 className="text-xl font-black text-slate-900">{plan.name}</h3>
                  <p className="text-slate-500 text-sm mt-2">{plan.desc}</p>
                </div>

                <div className="mb-8">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-slate-900">{plan.price}</span>
                    <span className="text-slate-400 font-bold">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-4 mb-12 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm font-medium text-slate-600">
                      <div className="size-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                        <Check className="size-3" />
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button 
                  className={cn(
                    "w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2",
                    plan.current 
                      ? "bg-slate-100 text-slate-400 cursor-default" 
                      : "bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20"
                  )}
                >
                  {plan.current ? 'Plano Atual' : 'Migrar para este plano'}
                  {!plan.current && <ArrowRight className="size-4" />}
                </button>
              </div>
            ))}
          </div>

          {/* Payment Methods */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h4 className="font-bold text-slate-800">Métodos de Pagamento</h4>
              <button className="text-sm font-bold text-primary hover:underline">Adicionar Cartão</button>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="size-12 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                    <CreditCard className="size-6 text-slate-400" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Visa final 4242</p>
                    <p className="text-xs text-slate-500">Expira em 12/2028</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded uppercase">Principal</span>
              </div>
            </div>
          </section>
        </div>
      </DashboardLayout>
    </SidebarProvider>
  );
}
