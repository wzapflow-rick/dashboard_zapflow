'use client';

import { useState, useEffect, useRef } from 'react';
import { createPayment, getMPPublicKey } from '@/app/actions/mercadopago';
import { Loader2, CreditCard, Lock, Check } from 'lucide-react';
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

interface MPToken {
  token: string;
}

declare global {
  interface Window {
    MercadoPago: {
      createCardToken: (cardData: Record<string, unknown>) => Promise<MPToken>;
    };
    MercadoPagoPublicKey: string;
  }
}

export default function PaymentForm({ pedidoId, total, onSuccess, onError }: PaymentFormProps) {
  const [loading, setLoading] = useState(false);
  const [publicKey, setPublicKey] = useState<string>('');
  const initialized = useRef(false);
  
  const [formData, setFormData] = useState<CardFormData>({
    cardNumber: '',
    cardExpiration: '',
    cardCvv: '',
    cardHolderName: '',
    docType: 'CPF',
    docNumber: '',
  });

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initMP = async () => {
      try {
        const key = await getMPPublicKey();
        console.log('[PaymentForm] Public Key obtida:', key);
        setPublicKey(key);

        if (key && !window.MercadoPago) {
          window.MercadoPagoPublicKey = key;
          
          const script = document.createElement('script');
          script.src = 'https://www.mercadopago.com.br/v2/security.js';
          script.setAttribute('data-v2', 'true');
          script.async = true;
          
          document.head.appendChild(script);
        }
      } catch (error) {
        console.error('[PaymentForm] Erro ao obter public key:', error);
      }
    };

    initMP();
  }, []);

  const handleInputChange = (field: keyof CardFormData, value: string) => {
    let formattedValue = value;

    if (field === 'cardNumber') {
      formattedValue = value.replace(/\D/g, '').slice(0, 16);
      formattedValue = formattedValue.replace(/(\d{4})/g, '$1 ').trim();
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
    // Espera o script carregar
    let attempts = 0;
    while (!window.MercadoPago && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 250));
      attempts++;
    }

    if (!window.MercadoPago) {
      console.error('[PaymentForm] MercadoPago não disponível após espera');
      return null;
    }

    const [month, year] = formData.cardExpiration.split('/');
    const cardData = {
      card_number: formData.cardNumber.replace(/\s/g, ''),
      card_expiration_month: month,
      card_expiration_year: `20${year}`,
      security_code: formData.cardCvv,
      cardholder_name: formData.cardHolderName,
      doc_type: formData.docType,
      doc_number: formData.docNumber.replace(/\D/g, ''),
    };

    console.log('[PaymentForm] Criando token...');

    try {
      const token = await window.MercadoPago.createCardToken(cardData);
      console.log('[PaymentForm] Token criado:', token);
      return token.token;
    } catch (error: any) {
      console.error('[PaymentForm] Erro ao criar token:', error);
      return null;
    }
  };

  const processPayment = async () => {
    if (!formData.cardNumber || !formData.cardExpiration || !formData.cardCvv || !formData.cardHolderName || !formData.docNumber) {
      toast.error('Preencha todos os campos');
      return;
    }

    setLoading(true);

    try {
      const token = await getCardToken();
      
      if (!token) {
        toast.error('Erro ao validar cartão. Verifique os dados.');
        onError?.('Erro ao validar cartão');
        return;
      }

      const result = await createPayment({
        pedidoId,
        paymentMethodId: 'credit_card',
        token,
      });

      if (result.success) {
        if (result.status === 'approved') {
          toast.success('Pagamento aprovado!');
          onSuccess();
        } else if (result.status === 'in_process') {
          toast.info('Pagamento em análise. Aguarde a aprovação.');
          onSuccess();
        } else {
          toast.error(result.statusDetail || 'Pagamento rejeitado');
          onError?.(result.statusDetail || 'Pagamento rejeitado');
        }
      } else {
        toast.error(result.error || 'Erro ao processar pagamento');
        onError?.(result.error || 'Erro ao processar pagamento');
      }
    } catch (error: any) {
      console.error('[PaymentForm] Erro no pagamento:', error);
      toast.error(error.message || 'Erro ao processar pagamento');
      onError?.(error.message);
    } finally {
      setLoading(false);
    }
  };
  }
}

export default function PaymentForm({ pedidoId, total, onSuccess, onError }: PaymentFormProps) {
  const [mpReady, setMpReady] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState<CardFormData>({
    cardNumber: '',
    cardExpiration: '',
    cardCvv: '',
    cardHolderName: '',
    docType: 'CPF',
    docNumber: '',
  });

  useEffect(() => {
    const loadMercadoPago = () => {
      return new Promise<void>((resolve) => {
        // Verifica se já está disponível
        if (window.MercadoPago) {
          setMpReady(true);
          resolve();
          return;
        }

        // Cria o script
        const script = document.createElement('script');
        script.src = 'https://www.mercadopago.com.br/v2/security.js';
        script.setAttribute('data-v2', 'true');
        script.async = true;
        
        script.onload = () => {
          console.log('[PaymentForm] Script MP carregado');
          // Espera um pouco para o MP inicializar
          setTimeout(() => {
            if (window.MercadoPago) {
              setMpReady(true);
              resolve();
            } else {
              // Tenta inicializar manualmente
              (window as any).MercadoPago = (window as any).MercadoPago || {};
              setMpReady(true);
              resolve();
            }
          }, 500);
        };
        
        script.onerror = () => {
          console.error('[PaymentForm] Erro ao carregar script MP');
          resolve();
        };
        
        document.body.appendChild(script);
      });
    };

    loadMercadoPago();
  }, []);

  const handleInputChange = (field: keyof CardFormData, value: string) => {
    let formattedValue = value;

    if (field === 'cardNumber') {
      formattedValue = value.replace(/\D/g, '').slice(0, 16);
      formattedValue = formattedValue.replace(/(\d{4})/g, '$1 ').trim();
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

  const getCardToken = async () => {
    if (!window.MercadoPago) {
      console.error('[PaymentForm] MercadoPago não disponível');
      return null;
    }

    const [month, year] = formData.cardExpiration.split('/');
    const cardData = {
      card_number: formData.cardNumber.replace(/\s/g, ''),
      card_expiration_month: month,
      card_expiration_year: `20${year}`,
      security_code: formData.cardCvv,
      cardholder_name: formData.cardHolderName,
      doc_type: formData.docType,
      doc_number: formData.docNumber.replace(/\D/g, ''),
    };

    console.log('[PaymentForm] Criando token com dados:', { ...cardData, card_number: '****', security_code: '***' });

    try {
      const token = await window.MercadoPago.createCardToken(cardData);
      console.log('[PaymentForm] Token criado:', token);
      return token;
    } catch (error: any) {
      console.error('[PaymentForm] Erro ao criar token do cartão:', error);
      toast.error('Erro ao validar cartão: ' + (error.message || 'Verifique os dados'));
      return null;
    }
  };

  const processPayment = async () => {
    if (!formData.cardNumber || !formData.cardExpiration || !formData.cardCvv || !formData.cardHolderName || !formData.docNumber) {
      toast.error('Preencha todos os campos');
      return;
    }

    setLoading(true);

    try {
      const token = await getCardToken();
      
      if (!token) {
        toast.error('Erro ao validar cartão. Verifique os dados.');
        onError?.('Erro ao validar cartão');
        return;
      }

      const result = await createPayment({
        pedidoId,
        paymentMethodId: 'credit_card',
        token: token.token,
      });

      if (result.success) {
        if (result.status === 'approved') {
          toast.success('Pagamento aprovado!');
          onSuccess();
        } else if (result.status === 'in_process') {
          toast.info('Pagamento em análise. Aguarde a aprovação.');
          onSuccess();
        } else {
          toast.error(result.statusDetail || 'Pagamento rejeitado');
          onError?.(result.statusDetail || 'Pagamento rejeitado');
        }
      } else {
        toast.error(result.error || 'Erro ao processar pagamento');
        onError?.(result.error || 'Erro ao processar pagamento');
      }
    } catch (error: any) {
      console.error('Erro no pagamento:', error);
      toast.error(error.message || 'Erro ao processar pagamento');
      onError?.(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 flex items-center gap-3">
        <Lock className="size-5 text-violet-500" />
        <div>
          <p className="text-sm font-bold text-violet-900">Pagamento seguro</p>
          <p className="text-xs text-violet-600">Seus dados são criptografados</p>
        </div>
      </div>

      <div>
        <label className="text-sm font-bold text-slate-700">Número do cartão</label>
        <div className="relative mt-1">
          <input
            type="text"
            value={formData.cardNumber}
            onChange={(e) => handleInputChange('cardNumber', e.target.value)}
            placeholder="0000 0000 0000 0000"
            className="w-full px-4 py-3 pl-12 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none"
          />
          <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-bold text-slate-700">Validade</label>
          <input
            type="text"
            value={formData.cardExpiration}
            onChange={(e) => handleInputChange('cardExpiration', e.target.value)}
            placeholder="MM/AA"
            className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700">CVV</label>
          <input
            type="text"
            value={formData.cardCvv}
            onChange={(e) => handleInputChange('cardCvv', e.target.value)}
            placeholder="123"
            className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-bold text-slate-700">Nome do titular</label>
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
          <label className="text-sm font-bold text-slate-700">Documento</label>
          <select
            value={formData.docType}
            onChange={(e) => handleInputChange('docType', e.target.value)}
            className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none"
          >
            <option value="CPF">CPF</option>
            <option value="CNPJ">CNPJ</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700">Número</label>
          <input
            type="text"
            value={formData.docNumber}
            onChange={(e) => handleInputChange('docNumber', e.target.value)}
            placeholder={formData.docType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
            className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none"
          />
        </div>
      </div>

      <button
        onClick={processPayment}
        disabled={loading}
        className="w-full py-4 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
      >
        {loading ? (
          <>
            <Loader2 className="size-5 animate-spin" />
            Processando...
          </>
        ) : (
          <>
            <Lock className="size-5" />
            Pagar R$ {total.toFixed(2).replace('.', ',')}
          </>
        )}
      </button>

      <p className="text-xs text-center text-slate-500">
        Powered by Mercado Pago
      </p>
    </div>
  );
}
