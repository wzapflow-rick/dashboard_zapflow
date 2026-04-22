'use client';

import { useState, useEffect, useRef } from 'react';
import { getMPPublicKey, createPayment, getPaymentStatus } from '@/app/actions/mercadopago';
import { Loader2, CreditCard, Lock, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentFormProps {
  pedidoId: number;
  total: number;
  empresaId?: number; // Novo campo
  onSuccess: () => void;
  onError?: (error: string) => void;
}

interface CardFormData {
  cardNumber: string;
  cardExpiration: string;
  cardCvv: string;
  cardHolderName: string;
  docType: string;
  docNumber: string;
}

type PaymentState = 'idle' | 'processing' | 'waiting_confirmation' | 'success' | 'error';

declare global {
  interface Window {
    MercadoPago: new (publicKey: string, options?: { locale?: string }) => {
      createCardToken: (cardData: Record<string, unknown>) => Promise<{ id: string }>;
    };
  }
}

export default function PaymentForm({ pedidoId, total, empresaId, onSuccess, onError }: PaymentFormProps) {
  const [loading, setLoading] = useState(false);
  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [sdkReady, setSdkReady] = useState(false);
  const mpInstanceRef = useRef<InstanceType<Window['MercadoPago']> | null>(null);
  const initialized = useRef(false);

  const [formData, setFormData] = useState<CardFormData>({
    cardNumber: '',
    cardExpiration: '',
    cardCvv: '',
    cardHolderName: '',
    docType: 'CPF',
    docNumber: '',
  });

  // Polling para verificar status do pagamento
  const waitForPaymentConfirmation = async (paymentId: number, maxAttempts = 10) => {
    setPaymentState('waiting_confirmation');
    setStatusMessage('Aguardando confirmação do pagamento...');
    
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Espera 2 segundos
      
      const statusResult = await getPaymentStatus(paymentId);
      
      if (statusResult.success && statusResult.status) {
        console.log(`[PaymentForm] Status do pagamento (tentativa ${attempts + 1}):`, statusResult.status);
        
        if (statusResult.status === 'approved') {
          setPaymentState('success');
          setStatusMessage('Pagamento aprovado!');
          toast.success('Pagamento aprovado!');
          onSuccess();
          return true;
        } else if (statusResult.status === 'rejected' || statusResult.status === 'cancelled') {
          const errorMsg = statusResult.statusDetail || 'Pagamento recusado';
          setPaymentState('error');
          setStatusMessage(errorMsg);
          toast.error(errorMsg);
          onError?.(errorMsg);
          return false;
        } else if (statusResult.status === 'in_process' || statusResult.status === 'pending') {
          setStatusMessage('Pagamento em análise...');
        }
      }
      
      attempts++;
    }
    
    // Timeout - assumir que está pendente
    setStatusMessage('Aguardando aprovação. Você será notificado quando confirmado.');
    toast.info('Pagamento em processamento. Atualize a página em alguns minutos para verificar.');
    onSuccess();
    return true;
  };

  // Carrega o SDK v2 e instancia o MercadoPago com a publicKey dinâmica
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const init = async () => {
      try {
        // Busca a chave pública correta (da empresa ou fallback)
        const publicKey = await getMPPublicKey(empresaId);
        if (!publicKey) {
          console.error('[PaymentForm] Public Key não encontrada');
          return;
        }

        const setupMP = () => {
          if (window.MercadoPago) {
            mpInstanceRef.current = new window.MercadoPago(publicKey, { locale: 'pt-BR' });
            setSdkReady(true);
          }
        };

        if (window.MercadoPago) {
          setupMP();
        } else {
          const script = document.createElement('script');
          script.src = 'https://sdk.mercadopago.com/js/v2';
          script.async = true;
          script.onload = setupMP;
          script.onerror = () => console.error('[PaymentForm] Erro ao carregar SDK');
          document.head.appendChild(script);
        }
      } catch (error) {
        console.error('[PaymentForm] Erro na inicialização:', error);
      }
    };

    init();
  }, [empresaId]);

  const handleInputChange = (field: keyof CardFormData, value: string) => {
    let formattedValue = value;

    if (field === 'cardNumber') {
      formattedValue = value.replace(/\D/g, '').slice(0, 16);
      formattedValue = formattedValue.replace(/(\d{4})(?=\d)/g, '$1 ');
    } else if (field === 'cardExpiration') {
      formattedValue = value.replace(/\D/g, '').slice(0, 4);
      if (formattedValue.length >= 2) {
        formattedValue = `${formattedValue.slice(0, 2)}/${formattedValue.slice(2)}`;
      }
    } else if (field === 'cardCvv') {
      formattedValue = value.replace(/\D/g, '').slice(0, 4);
    } else if (field === 'docNumber') {
      formattedValue = value.replace(/\D/g, '').slice(0, 11);
    }

    setFormData(prev => ({ ...prev, [field]: formattedValue }));
  };

  const getCardToken = async (): Promise<string | null> => {
    if (!mpInstanceRef.current) {
      console.error('[PaymentForm] Instância do MercadoPago não disponível');
      return null;
    }

    const [month, year] = formData.cardExpiration.split('/');
    const cardData = {
      cardNumber: formData.cardNumber.replace(/\s/g, ''),
      cardExpirationMonth: month,
      cardExpirationYear: `20${year}`,
      securityCode: formData.cardCvv,
      cardholderName: formData.cardHolderName,
      identificationType: formData.docType,
      identificationNumber: formData.docNumber.replace(/\D/g, ''),
    };

    try {
      const tokenResponse = await mpInstanceRef.current.createCardToken(cardData as Record<string, unknown>);
      return tokenResponse.id;
    } catch (error: any) {
      console.error('[PaymentForm] Erro ao criar token:', error);
      toast.error('Erro ao validar cartão');
      return null;
    }
  };

  const guessCardBrand = (cardNumber: string) => {
    const number = cardNumber.replace(/\D/g, '');
    if (/^4/.test(number)) return 'visa';
    if (/^5[1-5]/.test(number) || /^2(?:2(?:2[1-9]|[3-9]\d)|[3-6]\d\d|7(?:[01]\d|20))/.test(number)) return 'master';
    if (/^3[47]/.test(number)) return 'amex';
    return 'master';
  };

  const processPayment = async () => {
    if (!formData.cardNumber || !formData.cardExpiration || !formData.cardCvv || !formData.cardHolderName || !formData.docNumber) {
      toast.error('Preencha todos os campos');
      return;
    }

    setLoading(true);
    setPaymentState('processing');

    try {
      const token = await getCardToken();
      if (!token) {
        setPaymentState('error');
        return;
      }

      const result = await createPayment({
        pedidoId,
        paymentMethodId: guessCardBrand(formData.cardNumber),
        token,
      });

      if (result.success) {
        if (result.status === 'approved') {
          setPaymentState('success');
          onSuccess();
        } else if (result.status === 'in_process' || result.status === 'pending') {
          if (result.paymentId) await waitForPaymentConfirmation(result.paymentId);
          else onSuccess();
        } else {
          setPaymentState('error');
          setStatusMessage(result.statusDetail || 'Pagamento recusado');
        }
      } else {
        setPaymentState('error');
        setStatusMessage(result.error || 'Erro ao processar');
      }
    } catch (error: any) {
      setPaymentState('error');
      setStatusMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800 rounded-xl p-4 flex items-center gap-3">
        <Lock className="size-5 text-violet-500 shrink-0" />
        <div>
          <p className="text-sm font-bold text-violet-900 dark:text-violet-300">Pagamento seguro</p>
          <p className="text-xs text-violet-600 dark:text-violet-400">Seus dados são criptografados pelo Mercado Pago</p>
        </div>
      </div>

      {!sdkReady && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Carregando módulo de pagamento...
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Número do cartão</label>
          <div className="relative mt-1">
            <input
              type="text"
              value={formData.cardNumber}
              onChange={(e) => handleInputChange('cardNumber', e.target.value)}
              placeholder="0000 0000 0000 0000"
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/20"
            />
            <CreditCard className="absolute right-4 top-1/2 -translate-y-1/2 size-5 text-slate-300" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Validade</label>
            <input
              type="text"
              value={formData.cardExpiration}
              onChange={(e) => handleInputChange('cardExpiration', e.target.value)}
              placeholder="MM/AA"
              className="w-full mt-1 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">CVV</label>
            <input
              type="password"
              value={formData.cardCvv}
              onChange={(e) => handleInputChange('cardCvv', e.target.value)}
              placeholder="123"
              className="w-full mt-1 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nome no cartão</label>
          <input
            type="text"
            value={formData.cardHolderName}
            onChange={(e) => setFormData({ ...formData, cardHolderName: e.target.value })}
            placeholder="Como escrito no cartão"
            className="w-full mt-1 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/20"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">CPF do Titular</label>
          <input
            type="text"
            value={formData.docNumber}
            onChange={(e) => handleInputChange('docNumber', e.target.value)}
            placeholder="000.000.000-00"
            className="w-full mt-1 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/20"
          />
        </div>
      </div>

      {paymentState === 'error' && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
          <XCircle className="size-4 shrink-0" />
          {statusMessage || 'Erro ao processar pagamento'}
        </div>
      )}

      {paymentState === 'waiting_confirmation' && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm">
          <Loader2 className="size-4 animate-spin shrink-0" />
          {statusMessage}
        </div>
      )}

      <button
        onClick={processPayment}
        disabled={loading || !sdkReady}
        className="w-full py-4 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-lg shadow-lg shadow-violet-500/20 transition-all flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="size-5 animate-spin" />
            Processando...
          </>
        ) : (
          <>
            <CreditCard className="size-5" />
            Pagar R$ {total.toFixed(2).replace('.', ',')}
          </>
        )}
      </button>
    </div>
  );
}
