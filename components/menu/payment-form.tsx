'use client';

import { useState, useEffect, useRef } from 'react';
import { getMPPublicKey, createPayment, getPaymentStatus } from '@/app/actions/mercadopago';
import { Loader2, CreditCard, Lock, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentFormProps {
  pedidoId: number;
  total: number;
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

export default function PaymentForm({ pedidoId, total, onSuccess, onError }: PaymentFormProps) {
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

  // Carrega o SDK v2 e instancia o MercadoPago com a publicKey
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const init = async () => {
      try {
        const publicKey = await getMPPublicKey();
        if (!publicKey) {
          console.error('[PaymentForm] Public Key não encontrada');
          return;
        }

        // Verifica se o SDK já foi carregado
        if (window.MercadoPago) {
          mpInstanceRef.current = new window.MercadoPago(publicKey, { locale: 'pt-BR' });
          setSdkReady(true);
          return;
        }

        // Carrega o SDK v2 correto
        const script = document.createElement('script');
        script.src = 'https://sdk.mercadopago.com/js/v2';
        script.async = true;

        script.onload = () => {
          console.log('[PaymentForm] MercadoPago SDK v2 carregado');
          if (window.MercadoPago) {
            mpInstanceRef.current = new window.MercadoPago(publicKey, { locale: 'pt-BR' });
            setSdkReady(true);
          } else {
            console.error('[PaymentForm] MercadoPago não disponível após carregamento');
          }
        };

        script.onerror = () => {
          console.error('[PaymentForm] Erro ao carregar MercadoPago SDK');
        };

        document.head.appendChild(script);
      } catch (error) {
        console.error('[PaymentForm] Erro na inicialização:', error);
      }
    };

    init();
  }, []);

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

    console.log('[PaymentForm] Criando token do cartão...');

    try {
      const tokenResponse = await mpInstanceRef.current.createCardToken(cardData as Record<string, unknown>);
      console.log('[PaymentForm] Token criado:', tokenResponse.id);
      return tokenResponse.id;
    } catch (error: unknown) {
      let errMsg = 'Erro desconhecido';
      if (error instanceof Error) {
        errMsg = error.message;
      } else if (Array.isArray(error)) {
        errMsg = error.map(e => e.message || JSON.stringify(e)).join(', ');
      } else if (error && typeof error === 'object') {
        errMsg = JSON.stringify(error);
      }

      console.error('[PaymentForm] Erro ao criar token:', error);
      toast.error('Erro ao validar cartão: ' + errMsg);
      return null;
    }
  };

  const guessCardBrand = (cardNumber: string) => {
    const number = cardNumber.replace(/\D/g, '');
    if (/^4/.test(number)) return 'visa';
    if (/^5[1-5]/.test(number) || /^2(?:2(?:2[1-9]|[3-9]\d)|[3-6]\d\d|7(?:[01]\d|20))/.test(number)) return 'master';
    if (/^3[47]/.test(number)) return 'amex';
    if (/^3(?:0[0-5]|[68]\d)/.test(number)) return 'diners';
    if (/^6(?:011|5)/.test(number)) return 'discover';
    if (/^(?:50|5[6-9]|6)/.test(number)) return 'elo';
    if (/^3841/.test(number)) return 'hipercard';
    return 'master'; // fallback mais comum no brasil
  };

  const processPayment = async () => {
    if (!formData.cardNumber || !formData.cardExpiration || !formData.cardCvv || !formData.cardHolderName || !formData.docNumber) {
      toast.error('Preencha todos os campos');
      return;
    }

    if (!sdkReady || !mpInstanceRef.current) {
      toast.error('SDK do Mercado Pago ainda não carregado. Aguarde um momento.');
      return;
    }

    setLoading(true);
    setPaymentState('processing');
    setStatusMessage('Criando token do cartão...');

    try {
      const token = await getCardToken();

      if (!token) {
        setPaymentState('error');
        setStatusMessage('Erro ao validar cartão');
        onError?.('Erro ao validar cartão');
        return;
      }

      setStatusMessage('Processando pagamento...');

      const result = await createPayment({
        pedidoId,
        paymentMethodId: guessCardBrand(formData.cardNumber),
        token,
      });

      if (result.success) {
        if (result.status === 'approved') {
          setPaymentState('success');
          setStatusMessage('Pagamento aprovado!');
          toast.success('Pagamento aprovado!');
          onSuccess();
        } else if (result.status === 'in_process' || result.status === 'pending') {
          // Espera confirmação via polling
          if (result.paymentId) {
            await waitForPaymentConfirmation(result.paymentId);
          } else {
            setStatusMessage('Pagamento em análise. Aguarde a confirmação.');
            toast.info('Pagamento em análise. Aguarde a confirmação.');
            onSuccess();
          }
        } else {
          const msg = result.statusDetail || 'Pagamento recusado';
          setPaymentState('error');
          setStatusMessage(msg);
          toast.error(msg);
          onError?.(msg);
        }
      } else {
        const msg = result.error || 'Erro ao processar pagamento';
        setPaymentState('error');
        setStatusMessage(msg);
        toast.error(msg);
        onError?.(msg);
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Erro ao processar pagamento';
      console.error('[PaymentForm] Erro:', errMsg);
      setPaymentState('error');
      setStatusMessage(errMsg);
      toast.error(errMsg);
      onError?.(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 flex items-center gap-3">
        <Lock className="size-5 text-violet-500 shrink-0" />
        <div>
          <p className="text-sm font-bold text-violet-900">Pagamento seguro</p>
          <p className="text-xs text-violet-600">Seus dados são criptografados pelo Mercado Pago</p>
        </div>
      </div>

      {!sdkReady && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Carregando módulo de pagamento...
        </div>
      )}

      <div>
        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Número do cartão</label>
        <div className="relative mt-1">
          <input
            type="text"
            inputMode="numeric"
            value={formData.cardNumber}
            onChange={(e) => handleInputChange('cardNumber', e.target.value)}
            placeholder="0000 0000 0000 0000"
            className="w-full px-4 py-3 pl-12 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Validade</label>
          <input
            type="text"
            inputMode="numeric"
            value={formData.cardExpiration}
            onChange={(e) => handleInputChange('cardExpiration', e.target.value)}
            placeholder="MM/AA"
            className="w-full mt-1 px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">CVV</label>
          <input
            type="text"
            inputMode="numeric"
            value={formData.cardCvv}
            onChange={(e) => handleInputChange('cardCvv', e.target.value)}
            placeholder="123"
            className="w-full mt-1 px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Nome do titular</label>
        <input
          type="text"
          value={formData.cardHolderName}
          onChange={(e) => handleInputChange('cardHolderName', e.target.value)}
          placeholder="Nome impresso no cartão"
          className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Documento</label>
          <select
            value={formData.docType}
            onChange={(e) => handleInputChange('docType', e.target.value)}
            className="w-full mt-1 px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          >
            <option value="CPF">CPF</option>
            <option value="CNPJ">CNPJ</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Número</label>
          <input
            type="text"
            inputMode="numeric"
            value={formData.docNumber}
            onChange={(e) => handleInputChange('docNumber', e.target.value)}
            placeholder={formData.docType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
            className="w-full mt-1 px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Status de pagamento */}
      {paymentState !== 'idle' && (
        <div className={`rounded-xl p-4 flex items-center gap-3 ${
          paymentState === 'processing' || paymentState === 'waiting_confirmation' 
            ? 'bg-blue-50 border border-blue-100' 
            : paymentState === 'success' 
              ? 'bg-green-50 border border-green-100'
              : 'bg-red-50 border border-red-100'
        }`}>
          {paymentState === 'processing' || paymentState === 'waiting_confirmation' ? (
            <Loader2 className="size-5 text-blue-500 animate-spin shrink-0" />
          ) : paymentState === 'success' ? (
            <CheckCircle className="size-5 text-green-500 shrink-0" />
          ) : (
            <XCircle className="size-5 text-red-500 shrink-0" />
          )}
          <div>
            <p className={`text-sm font-bold ${
              paymentState === 'processing' || paymentState === 'waiting_confirmation'
                ? 'text-blue-900'
                : paymentState === 'success'
                  ? 'text-green-900'
                  : 'text-red-900'
            }`}>
              {statusMessage}
            </p>
            {paymentState === 'waiting_confirmation' && (
              <p className="text-xs text-blue-600">Não feche esta página...</p>
            )}
            {paymentState === 'error' && (
              <p className="text-xs text-red-600">Tente novamente ou use outro meio de pagamento</p>
            )}
          </div>
        </div>
      )}

      <button
        onClick={processPayment}
        disabled={loading || !sdkReady || paymentState === 'processing' || paymentState === 'waiting_confirmation'}
        className="w-full py-4 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
      >
        {loading || paymentState === 'processing' || paymentState === 'waiting_confirmation' ? (
          <>
            <Loader2 className="size-5 animate-spin" />
            {paymentState === 'waiting_confirmation' ? 'Aguardando...' : 'Processando...'}
          </>
        ) : (
          <>
            <Lock className="size-5" />
            Pagar R$ {total.toFixed(2).replace('.', ',')}
          </>
        )}
      </button>

      <p className="text-xs text-center text-slate-400">
        Powered by Mercado Pago
      </p>
    </div>
  );
}
