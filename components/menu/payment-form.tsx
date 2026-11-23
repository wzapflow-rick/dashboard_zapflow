'use client';


import { MorphingInfinity } from '@/components/ui/morphing-infinity';
import { useState, useEffect, useRef } from 'react';
import { getMPPublicKey, createPayment, getPaymentStatus } from '@/app/actions/mercadopago';
import { CreditCard, Lock, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentFormProps {
  pedidoId: number;
  total: number;
  empresaId?: number; // Novo campo
  onSuccess: () => void;
  onError?: (error: string) => void;
  onPendingChange?: (pending: boolean) => void;
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

export default function PaymentForm({ pedidoId, total, empresaId, onSuccess, onError, onPendingChange }: PaymentFormProps) {
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
    onPendingChange?.(true);
    
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Espera 2 segundos
      
      const statusResult = await getPaymentStatus(paymentId);
      
      if (statusResult.success && statusResult.status) {
        console.log(`[PaymentForm] Status do pagamento (tentativa ${attempts + 1}):`, statusResult.status);
        
        if (statusResult.status === 'approved') {
          setPaymentState('success');
          setStatusMessage('Pagamento aprovado!');
          onPendingChange?.(false);
          toast.success('Pagamento aprovado!');
          onSuccess();
          return true;
        } else if (statusResult.status === 'rejected' || statusResult.status === 'cancelled') {
          const errorMsg = translateStatusDetail(statusResult.statusDetail);
          setPaymentState('error');
          setStatusMessage(errorMsg);
          onPendingChange?.(false);
          toast.error(errorMsg);
          onError?.(errorMsg);
          return false;
        } else if (statusResult.status === 'in_process' || statusResult.status === 'pending') {
          setStatusMessage('Pagamento em análise...');
        }
      }
      
      attempts++;
    }
    
    // Timeout de consulta nao significa aprovacao. Mantem o pedido em espera
    // e bloqueia uma nova tentativa para evitar cobrar o cliente duas vezes.
    setStatusMessage('Ainda aguardando confirmação do Mercado Pago. Não tente pagar novamente; esta tela será atualizada quando houver uma resposta.');
    toast.info('Pagamento ainda em análise. Aguarde a confirmação antes de tentar novamente.');
    return false;
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

        if (!document.querySelector('script[data-mp-security]')) {
          const securityScript = document.createElement('script');
          securityScript.src = 'https://www.mercadopago.com/v2/security.js';
          securityScript.setAttribute('view', 'checkout');
          securityScript.setAttribute('data-mp-security', 'true');
          securityScript.async = true;
          document.head.appendChild(securityScript);
        }

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

  const detectPaymentMethod = async (cardNumber: string): Promise<{ id: string; issuerId?: string }> => {
    const bin = cardNumber.replace(/\D/g, '').slice(0, 8);
    try {
      const mp = mpInstanceRef.current as unknown as {
        getPaymentMethods?: (args: { bin: string }) => Promise<{ results?: Array<{ id: string; issuer?: { id?: number | string } }> }>;
      };
      const response = await mp?.getPaymentMethods?.({ bin });
      const method = response?.results?.[0];
      if (method?.id) {
        return { id: method.id, issuerId: method.issuer?.id ? String(method.issuer.id) : undefined };
      }
    } catch (error) {
      console.error('[PaymentForm] Erro ao identificar bandeira:', error);
    }
    return { id: guessCardBrand(cardNumber) };
  };

  const translateStatusDetail = (detail?: string) => {
    const messages: Record<string, string> = {
      cc_rejected_high_risk: 'Pagamento recusado pelo sistema antifraude do Mercado Pago. Tente outro cartão ou pague com PIX.',
      cc_rejected_insufficient_amount: 'Saldo ou limite insuficiente.',
      cc_rejected_bad_filled_security_code: 'CVV inválido. Confira o código de segurança.',
      cc_rejected_bad_filled_date: 'Data de validade inválida.',
      cc_rejected_bad_filled_card_number: 'Número do cartão inválido.',
      cc_rejected_bad_filled_other: 'Confira os dados do cartão.',
      cc_rejected_call_for_authorize: 'O banco precisa autorizar este pagamento. Ligue para o seu banco e tente novamente.',
      cc_rejected_card_disabled: 'Cartão desabilitado. Ligue para o seu banco para ativá-lo.',
      cc_rejected_duplicated_payment: 'Pagamento duplicado. Você já fez um pagamento com esse valor.',
      cc_rejected_max_attempts: 'Limite de tentativas atingido. Use outro cartão ou PIX.',
      cc_rejected_blacklist: 'Não foi possível processar este cartão. Use outro cartão ou PIX.',
      cc_rejected_other_reason: 'O banco recusou o pagamento. Use outro cartão ou PIX.',
    };
    return (detail && messages[detail]) || 'Pagamento recusado. Tente outro cartão ou pague com PIX.';
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

      const method = await detectPaymentMethod(formData.cardNumber);
      const deviceId = (window as unknown as { MP_DEVICE_SESSION_ID?: string }).MP_DEVICE_SESSION_ID;

      const result = await createPayment({
        pedidoId,
        paymentMethodId: method.id,
        issuerId: method.issuerId,
        token,
        payerDocNumber: formData.docNumber,
        deviceId,
      });

      if (result.success) {
        if (result.status === 'approved') {
          setPaymentState('success');
          onPendingChange?.(false);
          onSuccess();
        } else if (result.status === 'in_process' || result.status === 'pending') {
          if (result.paymentId) {
            await waitForPaymentConfirmation(result.paymentId);
          } else {
            setPaymentState('waiting_confirmation');
            setStatusMessage('O Mercado Pago recebeu o pagamento e ainda não confirmou o resultado. Não tente pagar novamente.');
            onPendingChange?.(true);
            toast.info('Pagamento em análise. Aguarde a confirmação antes de tentar novamente.');
          }
        } else {
          setPaymentState('error');
          setStatusMessage(translateStatusDetail(result.statusDetail));
          onPendingChange?.(false);
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
      <div className="bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-xl p-4 flex items-center gap-3">
        <Lock className="size-5 text-[#22c55e] shrink-0" />
        <div>
          <p className="text-sm font-bold text-white">Pagamento seguro</p>
          <p className="text-xs text-gray-400">Seus dados são criptografados pelo Mercado Pago</p>
        </div>
      </div>

      {!sdkReady && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <MorphingInfinity className="size-4" />
          Carregando módulo de pagamento...
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Número do cartão</label>
          <div className="relative mt-1">
            <input
              type="text"
              value={formData.cardNumber}
              onChange={(e) => handleInputChange('cardNumber', e.target.value)}
              placeholder="0000 0000 0000 0000"
              className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder:text-gray-600 rounded-xl text-sm outline-none focus:border-[#22c55e] transition-colors"
            />
            <CreditCard className="absolute right-4 top-1/2 -translate-y-1/2 size-5 text-slate-300" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Validade</label>
            <input
              type="text"
              value={formData.cardExpiration}
              onChange={(e) => handleInputChange('cardExpiration', e.target.value)}
              placeholder="MM/AA"
              className="w-full mt-1 px-4 py-3 bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder:text-gray-600 rounded-xl text-sm outline-none focus:border-[#22c55e] transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">CVV</label>
            <input
              type="password"
              value={formData.cardCvv}
              onChange={(e) => handleInputChange('cardCvv', e.target.value)}
              placeholder="123"
              className="w-full mt-1 px-4 py-3 bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder:text-gray-600 rounded-xl text-sm outline-none focus:border-[#22c55e] transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nome no cartão</label>
          <input
            type="text"
            value={formData.cardHolderName}
            onChange={(e) => setFormData({ ...formData, cardHolderName: e.target.value })}
            placeholder="Como escrito no cartão"
            className="w-full mt-1 px-4 py-3 bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder:text-gray-600 rounded-xl text-sm outline-none focus:border-[#22c55e] transition-colors"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">CPF do Titular</label>
          <input
            type="text"
            value={formData.docNumber}
            onChange={(e) => handleInputChange('docNumber', e.target.value)}
            placeholder="000.000.000-00"
            className="w-full mt-1 px-4 py-3 bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder:text-gray-600 rounded-xl text-sm outline-none focus:border-[#22c55e] transition-colors"
          />
        </div>
      </div>

      {paymentState === 'error' && (
        <div role="alert" className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400 text-sm">
          <XCircle className="size-4 shrink-0" />
          {statusMessage || 'Erro ao processar pagamento'}
        </div>
      )}

      {paymentState === 'waiting_confirmation' && (
        <div role="status" className="p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl flex items-center gap-2 text-gray-300 text-sm">
          <MorphingInfinity className="size-4 shrink-0" />
          {statusMessage}
        </div>
      )}

      <button
        onClick={processPayment}
        disabled={loading || !sdkReady || paymentState === 'waiting_confirmation'}
        className="w-full p-4 bg-[#22c55e] hover:bg-[#1ea34d] disabled:bg-[#1a1a1a] disabled:text-gray-600 text-white font-black rounded-xl shadow-lg shadow-green-900/30 transition-all flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <MorphingInfinity className="size-5" />
            Processando...
          </>
        ) : paymentState === 'waiting_confirmation' ? (
          <>
            <MorphingInfinity className="size-5" />
            Aguardando confirmação...
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
