'use client';

import React, { useState, useEffect } from 'react';
import { 
  Check, 
  CreditCard, 
  ArrowRight,
  Star,
  Loader2,
  AlertCircle,
  X,
  QrCode,
  Copy,
  CheckCircle2,
  Calendar,
  Receipt
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  getSubscription, 
  getInvoices,
  createSubscription,
  changePlan,
  cancelSubscription,
  generatePixPayment,
  getMPPublicKeyForSubscription,
  type Subscription,
  type Invoice
} from '@/app/actions/subscription';
import { SUBSCRIPTION_PLANS, type SubscriptionPlanId, isTrialPlan } from '@/lib/constants';

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  
  // Modais
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [showPixModal, setShowPixModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId | null>(null);
  
  // PIX
  const [pixData, setPixData] = useState<{ qrCode?: string; qrCodeBase64?: string; copyPaste?: string; expirationDate?: string } | null>(null);
  const [pixCopied, setPixCopied] = useState(false);

  // Carrega dados
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [sub, inv] = await Promise.all([
        getSubscription(),
        getInvoices()
      ]);
      setSubscription(sub);
      setInvoices(inv);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados da assinatura');
    } finally {
      setIsLoading(false);
    }
  }

  // Formata data
  function formatDate(dateStr: string | null) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  // Formata valor
  function formatCurrency(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // Handler para migrar/assinar plano
  async function handleSelectPlan(planId: SubscriptionPlanId) {
    setSelectedPlan(planId);
    setShowChangePlanModal(true);
  }

  // Confirma mudanca de plano
  async function handleConfirmChangePlan() {
    if (!selectedPlan) return;
    
    setProcessingPlan(selectedPlan);
    setShowChangePlanModal(false);
    
    try {
      const result = subscription?.mp_subscription_id 
        ? await changePlan(selectedPlan)
        : await createSubscription(selectedPlan);
      
      if (result.success) {
        if ('initPoint' in result && typeof result.initPoint === 'string' && result.initPoint) {
          // Redireciona para checkout do MP
          window.location.href = result.initPoint;
        } else {
          toast.success('Plano alterado com sucesso!');
          await loadData();
        }
      } else if ('error' in result) {
        toast.error(String(result.error) || 'Erro ao alterar plano');
      }
    } catch (error) {
      toast.error('Erro ao processar solicitação');
    } finally {
      setProcessingPlan(null);
    }
  }

  // Handler PIX
  async function handlePayWithPix(planId: SubscriptionPlanId) {
    setSelectedPlan(planId);
    setProcessingPlan(planId);
    
    try {
      const result = await generatePixPayment(planId);
      
      if (result.success && result.qrCode) {
        setPixData(result);
        setShowPixModal(true);
      } else {
        toast.error(result.error || 'Erro ao gerar QR Code PIX');
      }
    } catch (error) {
      toast.error('Erro ao gerar PIX');
    } finally {
      setProcessingPlan(null);
    }
  }

  // Copiar codigo PIX
  function handleCopyPix() {
    if (pixData?.copyPaste) {
      navigator.clipboard.writeText(pixData.copyPaste);
      setPixCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setPixCopied(false), 3000);
    }
  }

  // Handler cancelar assinatura
  async function handleCancelSubscription() {
    setShowCancelModal(false);
    setProcessingPlan('cancel');
    
    try {
      const result = await cancelSubscription();
      
      if (result.success) {
        toast.success('Assinatura cancelada');
        await loadData();
      } else {
        toast.error(result.error || 'Erro ao cancelar');
      }
    } catch (error) {
      toast.error('Erro ao cancelar assinatura');
    } finally {
      setProcessingPlan(null);
    }
  }

  // Plans array (apenas planos pagos comercializaveis).
  // Exclui o 'iniciante' e o 'parceria' (este e o plano de trial/cortesia,
  // usado apenas quando concedemos dias de teste — nao deve aparecer na vitrine).
  const plans = Object.values(SUBSCRIPTION_PLANS).filter(
    (p) => !('trial' in p && p.trial)
  );
  const currentPlan = subscription?.plano || null;
  
  // Verifica se usuario veio do trial para mostrar preco promocional
  const isFromTrial = isTrialPlan(currentPlan) || subscription?.cartao_bandeira === 'TRIA';
  
  // Retorna o preco correto (promocional para usuarios trial no plano Start)
  function getDisplayPrice(plan: typeof plans[0]): number {
    if (isFromTrial && plan.id === 'start' && 'promoPrice' in plan) {
      return (plan as any).promoPrice;
    }
    return plan.price;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8">
          <header>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Assinatura e Cobrança</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Gerencie seu plano, métodos de pagamento e histórico de faturas.</p>
          </header>

          {/* Current Plan Status */}
          {subscription && subscription.status !== 'cancelled' && (
            <div className="bg-primary rounded-2xl p-6 md:p-8 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl shadow-primary/20">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-bold uppercase tracking-wider">
                  <Star className="size-3 fill-current" />
                  Plano Atual: {subscription.plano?.toUpperCase()}
                </div>
                <h2 className="text-2xl md:text-3xl font-black">
                  {subscription.data_proxima_cobranca 
                    ? `Próxima fatura em ${formatDate(subscription.data_proxima_cobranca)}`
                    : 'Assinatura ativa'
                  }
                </h2>
                <p className="text-white/70 font-medium">
                  Valor: {formatCurrency(subscription.valor)}
                  {subscription.cartao_ultimos_digitos && ` • Cartão final ${subscription.cartao_ultimos_digitos}`}
                </p>
              </div>
              <div className="flex gap-3 shrink-0">
                <button 
                  onClick={() => setShowChangePlanModal(true)}
                  className="px-4 md:px-6 py-3 bg-white text-primary font-bold rounded-xl hover:bg-slate-50 transition-all text-sm md:text-base"
                >
                  Alterar Plano
                </button>
                <button 
                  onClick={() => setShowCancelModal(true)}
                  disabled={processingPlan === 'cancel'}
                  className="px-4 md:px-6 py-3 bg-white/10 border border-white/20 text-white font-bold rounded-xl hover:bg-white/20 transition-all text-sm md:text-base disabled:opacity-50"
                >
                  {processingPlan === 'cancel' ? <Loader2 className="size-5 animate-spin" /> : 'Cancelar'}
                </button>
              </div>
            </div>
          )}

          {/* No subscription alert */}
          {(!subscription || subscription.status === 'cancelled') && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 flex items-start gap-4">
              <AlertCircle className="size-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-amber-800 dark:text-amber-200">Você não possui uma assinatura ativa</h3>
                <p className="text-amber-700 dark:text-amber-300 text-sm mt-1">
                  Escolha um dos planos abaixo para começar a usar todos os recursos do ZapFlow.
                </p>
              </div>
            </div>
          )}

          {/* Plans Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
            {plans.map((plan) => {
              const isCurrent = currentPlan === plan.id;
              const isProcessing = processingPlan === plan.id;
              
              return (
                <div 
                  key={plan.id} 
                  className={cn(
                    "bg-white dark:bg-slate-800 rounded-3xl border p-6 md:p-8 flex flex-col relative overflow-hidden",
                    'popular' in plan && plan.popular ? "border-primary ring-4 ring-primary/5" : "border-slate-200 dark:border-slate-700"
                  )}
                >
                  {'popular' in plan && plan.popular && (
                    <div className="absolute top-4 right-4">
                      <span className="bg-primary text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">Mais Popular</span>
                    </div>
                  )}
                  
                  <div className="mb-6 md:mb-8">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">{plan.name}</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">{plan.description}</p>
                  </div>

                  <div className="mb-6 md:mb-8">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">{formatCurrency(getDisplayPrice(plan))}</span>
                      <span className="text-slate-400 font-bold">/mês</span>
                    </div>
                    {isFromTrial && plan.id === 'start' && 'promoPrice' in plan && (
                      <div className="mt-2">
                        <span className="text-xs text-slate-400 line-through">{formatCurrency(plan.price)}</span>
                        <span className="ml-2 text-xs font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-900/40 px-2 py-0.5 rounded">Preço Promocional</span>
                      </div>
                    )}
                  </div>

                  <ul className="space-y-3 md:space-y-4 mb-8 md:mb-12 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                        <div className="size-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="size-3" />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <div className="space-y-3">
                    <button 
                      onClick={() => handleSelectPlan(plan.id as SubscriptionPlanId)}
                      disabled={isCurrent || isProcessing}
                      className={cn(
                        "w-full py-3 md:py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2",
                        isCurrent 
                          ? "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-default" 
                          : "bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20"
                      )}
                    >
                      {isProcessing ? (
                        <Loader2 className="size-5 animate-spin" />
                      ) : isCurrent ? (
                        'Plano Atual'
                      ) : (
                        <>
                          Assinar com Cartão
                          <ArrowRight className="size-4" />
                        </>
                      )}
                    </button>
                    
                    {!isCurrent && (
                      <button 
                        onClick={() => handlePayWithPix(plan.id as SubscriptionPlanId)}
                        disabled={isProcessing}
                        className="w-full py-3 md:py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 border-2 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        <QrCode className="size-5" />
                        Pagar com PIX
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Payment Methods */}
          {subscription && subscription.cartao_ultimos_digitos && (
            <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <h4 className="font-bold text-slate-800 dark:text-white">Métodos de Pagamento</h4>
                <button 
                  onClick={() => setShowCardModal(true)}
                  className="text-sm font-bold text-primary hover:underline"
                >
                  Alterar Cartão
                </button>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="size-12 bg-slate-50 dark:bg-slate-700 rounded-lg flex items-center justify-center border border-slate-100 dark:border-slate-600">
                      <CreditCard className="size-6 text-slate-400" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {subscription.cartao_bandeira?.toUpperCase() || 'Cartão'} final {subscription.cartao_ultimos_digitos}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Cartão principal</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/40 px-2 py-1 rounded uppercase">Principal</span>
                </div>
              </div>
            </section>
          )}

          {/* Invoices History */}
          {invoices.length > 0 && (
            <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
                <Receipt className="size-5 text-slate-400" />
                <h4 className="font-bold text-slate-800 dark:text-white">Histórico de Faturas</h4>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="p-4 md:p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="size-10 bg-slate-50 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                        <Calendar className="size-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(invoice.valor)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Vencimento: {formatDate(invoice.data_vencimento)}
                        </p>
                      </div>
                    </div>
                    <span className={cn(
                      "text-xs font-bold px-2 py-1 rounded uppercase",
                      invoice.status === 'approved' 
                        ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/40"
                        : invoice.status === 'rejected'
                        ? "text-red-600 bg-red-50 dark:bg-red-900/40"
                        : "text-amber-600 bg-amber-50 dark:bg-amber-900/40"
                    )}>
                      {invoice.status === 'approved' ? 'Pago' : invoice.status === 'rejected' ? 'Recusado' : 'Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Modal: Confirmar Mudanca de Plano */}
        {showChangePlanModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowChangePlanModal(false)} />
            <div className="relative bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <button onClick={() => setShowChangePlanModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X className="size-5" />
              </button>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Confirmar Alteração</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                {selectedPlan && (() => {
                  const planData = SUBSCRIPTION_PLANS[selectedPlan.toUpperCase() as keyof typeof SUBSCRIPTION_PLANS];
                  const displayPrice = isFromTrial && selectedPlan === 'start' && planData && 'promoPrice' in planData
                    ? (planData as any).promoPrice
                    : planData?.price || 0;
                  return (
                    <>
                      Você está prestes a {subscription?.mp_subscription_id ? 'migrar para' : 'assinar'} o plano{' '}
                      <strong>{planData?.name}</strong> por{' '}
                      <strong>{formatCurrency(displayPrice)}/mês</strong>.
                      {isFromTrial && selectedPlan === 'start' && (
                        <span className="block mt-2 text-emerald-600 font-medium">Preço promocional exclusivo para parceiros!</span>
                      )}
                    </>
                  );
                })()}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowChangePlanModal(false)}
                  className="flex-1 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleConfirmChangePlan}
                  className="flex-1 py-3 rounded-xl font-bold bg-primary text-white hover:bg-primary/90"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Cancelar Assinatura */}
        {showCancelModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowCancelModal(false)} />
            <div className="relative bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <button onClick={() => setShowCancelModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X className="size-5" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="size-12 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center">
                  <AlertCircle className="size-6 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Cancelar Assinatura</h3>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                Tem certeza que deseja cancelar sua assinatura? Você perderá acesso aos recursos do seu plano atual ao final do período já pago.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Manter Assinatura
                </button>
                <button 
                  onClick={handleCancelSubscription}
                  className="flex-1 py-3 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: PIX */}
        {showPixModal && pixData && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowPixModal(false)} />
            <div className="relative bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <button onClick={() => setShowPixModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X className="size-5" />
              </button>
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Pague com PIX</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  Escaneie o QR Code ou copie o código para pagar
                </p>
              </div>
              
              {pixData.qrCodeBase64 && (
                <div className="bg-white p-4 rounded-xl mb-6 flex justify-center">
                  <img 
                    src={`data:image/png;base64,${pixData.qrCodeBase64}`} 
                    alt="QR Code PIX" 
                    className="w-48 h-48"
                  />
                </div>
              )}

              <button
                onClick={handleCopyPix}
                className="w-full py-3 rounded-xl font-bold border-2 border-dashed border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center gap-2 mb-4"
              >
                {pixCopied ? (
                  <>
                    <CheckCircle2 className="size-5 text-emerald-600" />
                    Código Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="size-5" />
                    Copiar Código PIX
                  </>
                )}
              </button>

              {pixData.expirationDate && (
                <p className="text-center text-xs text-slate-400">
                  Válido até: {new Date(pixData.expirationDate).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          </div>
        )}
    </>
  );
}
