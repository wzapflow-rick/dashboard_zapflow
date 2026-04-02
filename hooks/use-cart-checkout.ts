'use client';

import { useState, useCallback } from 'react';
import { validateCoupon } from '@/app/actions/coupons';
import { createPublicOrder } from '@/app/actions/public-orders';
import { toast } from 'sonner';

export type CheckoutStep = 'cart' | 'customer' | 'payment' | 'success';

interface Cupom {
  id: number;
  codigo: string;
  desconto: number;
  tipo: string;
}

interface CustomerData {
  nome: string;
  telefone: string;
  endereco: string;
  bairro: string;
  cidade: string;
}

interface PaymentData {
  forma: 'pix' | 'dinheiro' | 'cartao';
  troco: number;
}

export function useCartCheckout(empresaId?: number) {
  const [step, setStep] = useState<CheckoutStep>('cart');
  const [cupomInput, setCupomInput] = useState('');
  const [loadingCupom, setLoadingCupom] = useState(false);
  const [cupomError, setCupomError] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);

  const [customerData, setCustomerData] = useState<CustomerData>({
    nome: '',
    telefone: '',
    endereco: '',
    bairro: '',
    cidade: '',
  });

  const [paymentData, setPaymentData] = useState<PaymentData>({
    forma: 'pix',
    troco: 0,
  });

  const applyCupom = useCallback(async (subtotal: number, setCupom: (cupom: Cupom | null) => void) => {
    if (!cupomInput.trim()) return;

    setLoadingCupom(true);
    setCupomError('');

    try {
      const result = await validateCoupon(cupomInput.trim(), subtotal);
      if (result.valid && result.cupom) {
        setCupom({
          id: result.cupom.id,
          codigo: result.cupom.codigo,
          desconto: result.cupom.valor,
          tipo: result.cupom.tipo
        });
        toast.success(`Cupom ${result.cupom.codigo} aplicado!`);
      } else {
        setCupomError(result.error || 'Cupom inválido');
        setCupom(null);
      }
    } catch (error) {
      setCupomError('Erro ao validar cupom');
    } finally {
      setLoadingCupom(false);
    }
  }, [cupomInput]);

  const removeCupom = useCallback((setCupom: (cupom: null) => void) => {
    setCupom(null);
    setCupomInput('');
    setCupomError('');
  }, []);

  const proceedToCustomer = useCallback(() => {
    setStep('customer');
  }, []);

  const proceedToPayment = useCallback(() => {
    setStep('payment');
  }, []);

  const goBack = useCallback(() => {
    if (step === 'payment') setStep('customer');
    else if (step === 'customer') setStep('cart');
  }, [step]);

  const resetCheckout = useCallback(() => {
    setStep('cart');
    setCupomInput('');
    setCupomError('');
    setOrderId(null);
    setCustomerData({
      nome: '',
      telefone: '',
      endereco: '',
      bairro: '',
      cidade: '',
    });
    setPaymentData({
      forma: 'pix',
      troco: 0,
    });
  }, []);

  return {
    step,
    setStep,
    cupomInput,
    setCupomInput,
    loadingCupom,
    cupomError,
    loading,
    setLoading,
    orderId,
    setOrderId,
    customerData,
    setCustomerData,
    paymentData,
    setPaymentData,
    applyCupom,
    removeCupom,
    proceedToCustomer,
    proceedToPayment,
    goBack,
    resetCheckout
  };
}
