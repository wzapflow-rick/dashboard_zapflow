'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingCart,
  X,
  Plus,
  Minus,
  Trash2,
  Tag,
  Star,
  Check,
  Loader2,
  Sparkles,
  CreditCard,
  Banknote,
  QrCode,
  MapPin,
  Phone,
  User,
  ChevronRight,
  ArrowLeft,
  AlertCircle,
  Copy,
  CheckCircle
} from 'lucide-react';
import { useCart } from './cart-context';
import { validateCoupon } from '@/app/actions/coupons';
import { createPublicOrder } from '@/app/actions/public-orders';
import { getClientPoints, getLoyaltyConfig } from '@/app/actions/loyalty';
import { calculateDeliveryFee, geocodeAddress, getDeliveryConfig } from '@/app/actions/delivery';
import { createPayment, getMPPublicKey } from '@/app/actions/mercadopago';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import Image from 'next/image';

const PaymentForm = dynamic(() => import('./payment-form'), { ssr: false });

interface CartProps {
  whatsappNumber: string;
  empresaNome: string;
  empresaId?: number;
  clienteTelefone?: string;
  upsellProducts?: UpsellProduct[];
}

interface UpsellProduct {
  id: number;
  nome: string;
  preco: number;
  imagem?: string | null;
  descricao?: string;
}

type CheckoutStep = 'cart' | 'customer' | 'payment' | 'success';

const formatPrice = (price: number) => {
  return `R$ ${price.toFixed(2).replace('.', ',')}`;
};

export default function Cart({ whatsappNumber, empresaNome, empresaId, clienteTelefone, upsellProducts = [] }: CartProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<CheckoutStep>('cart');
  const [cupomInput, setCupomInput] = useState('');
  const [loadingCupom, setLoadingCupom] = useState(false);
  const [cupomError, setCupomError] = useState('');
  const [showUpsell, setShowUpsell] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);

  // Customer data
  const [customerData, setCustomerData] = useState({
    nome: '',
    telefone: clienteTelefone || '',
    endereco: '',
    bairro: '',
    cidade: '',
  });

  // Delivery/Pickup
  const [isDelivery, setIsDelivery] = useState(true);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryInfo, setDeliveryInfo] = useState<{ distance?: number; duration?: number } | null>(null);
  const [deliveryConfig, setDeliveryConfig] = useState<{ auto_radius: boolean; taxa_entrega_fixa: number } | null>(null);

  // Client points
  const [clientPoints, setClientPoints] = useState<number | null>(null);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const [checkingCustomer, setCheckingCustomer] = useState(false);
  const [phoneChecked, setPhoneChecked] = useState(false);

  // Payment data
  const [paymentData, setPaymentData] = useState({
    forma: 'pix' as 'pix' | 'dinheiro' | 'cartao',
    troco: 0,
  });

  // Mercado Pago payment state
  const [mpLoading, setMpLoading] = useState(false);
  const [mpQrCode, setMpQrCode] = useState<string | null>(null);
  const [mpQrCodeBase64, setMpQrCodeBase64] = useState<string | null>(null);
  const [mpCopied, setMpCopied] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);

  // Points usage
  const [usePoints, setUsePoints] = useState(false);
  const [loyaltyConfig, setLoyaltyConfig] = useState<{ pontos_para_desconto: number; desconto_valor: number } | null>(null);

  // Scheduling
  const [agendarPedido, setAgendarPedido] = useState(false);
  const [dataAgendamento, setDataAgendamento] = useState('');
  const [horaAgendamento, setHoraAgendamento] = useState('');

  const {
    items,
    cupom,
    addItem,
    removeItem,
    updateQuantity,
    setCupom,
    clearCart,
    subtotal,
    desconto,
    total,
    pontosGanhos,
    itemCount
  } = useCart();

  // Cálculo do desconto por pontos
  const pontosDisponiveis = clientPoints || 0;
  const maxDescontoPorPontos = useMemo(() => {
    if (!loyaltyConfig || pontosDisponiveis < loyaltyConfig.pontos_para_desconto) return 0;
    const blocosCompletos = Math.floor(pontosDisponiveis / loyaltyConfig.pontos_para_desconto);
    return blocosCompletos * loyaltyConfig.desconto_valor;
  }, [pontosDisponiveis, loyaltyConfig]);

  const descontoPontos = usePoints && pontosDisponiveis >= (loyaltyConfig?.pontos_para_desconto || 100)
    ? Math.min(maxDescontoPorPontos, subtotal - desconto)
    : 0;

  const pontosASeremUsados = usePoints && descontoPontos > 0 && loyaltyConfig
    ? Math.floor(descontoPontos / loyaltyConfig.desconto_valor) * loyaltyConfig.pontos_para_desconto
    : 0;

  const totalFinal = Math.max(0, subtotal - desconto - descontoPontos + deliveryFee);

  // Upsell suggestions
  const upsellSuggestions = upsellProducts.map((product, index) => ({
    id: product.id,
    nome: product.nome,
    preco: product.preco,
    imagem: product.imagem,
    sugestao: index === 0 ? 'Para acompanhar!' :
      index === 1 ? 'Combina muito bem!' :
        'Que tal mais algo?',
  }));

  const applyCupom = async () => {
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
  };

  const removeCupom = () => {
    setCupom(null);
    setCupomInput('');
    setCupomError('');
  };

  const proceedToCustomer = () => {
    if (items.length === 0) return;
    setStep('customer');
  };

  const proceedToPayment = () => {
    // Se telefone ainda não foi verificado
    if (!phoneChecked) {
      const cleanPhone = customerData.telefone.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        toast.error('Digite um telefone válido');
        return;
      }
      checkCustomerExists();
      return;
    }

    // Se é novo cadastro, validar nome
    if (!isExistingCustomer && !customerData.nome) {
      toast.error('Digite seu nome');
      return;
    }

    // Validar endereço apenas se for delivery
    if (isDelivery && !customerData.endereco) {
      toast.error('Digite o endereço de entrega');
      return;
    }

    // Validar agendamento
    if (agendarPedido && (!dataAgendamento || !horaAgendamento)) {
      toast.error('Selecione data e horário para agendamento');
      return;
    }

    // Validar horário mínimo (pelo menos 30min no futuro)
    if (agendarPedido && dataAgendamento && horaAgendamento) {
      const agendamento = new Date(`${dataAgendamento}T${horaAgendamento}`);
      const agora = new Date();
      const diferenca = (agendamento.getTime() - agora.getTime()) / (1000 * 60); // em minutos

      if (diferenca < 30) {
        toast.error('O agendamento deve ser com pelo menos 30 minutos de antecedência');
        return;
      }
    }

    setStep('payment');
  };

  const finishOrder = async () => {
    if (!empresaId) {
      toast.error('Erro: empresa não identificada');
      return;
    }

    // Se for PIX ou Cartão com pagamento online, processar primeiro
    if (paymentData.forma === 'pix' || (paymentData.forma === 'cartao' && !showCardForm)) {
      setMpLoading(true);
      try {
        // Criar primeiro o pedido no NocoDB (sem status de pagamento ainda)
        const orderResult = await createPublicOrder({
          empresaId,
          clienteTelefone: customerData.telefone.replace(/\D/g, ''),
          clienteNome: customerData.nome || 'Cliente Cardápio',
          clienteEndereco: customerData.endereco,
          clienteBairro: customerData.bairro,
          tipoEntrega: isDelivery ? 'delivery' : 'retirada',
          taxaEntrega: deliveryFee,
          itens: items.map(item => ({
            id: item.productId,
            nome: item.nome,
            preco: item.preco,
            quantidade: item.quantidade,
            complementos: item.complementos,
          })),
          subtotal,
          desconto: desconto + descontoPontos,
          total: totalFinal,
          cupomCodigo: cupom?.codigo,
          cupomId: cupom?.id,
          pontosGanhos,
          pontosUsados: pontosASeremUsados,
          descontoPontos: descontoPontos,
          formaPagamento: paymentData.forma === 'pix' ? 'pix' : 'cartao',
          troco: undefined,
          dataAgendamento: agendarPedido && dataAgendamento && horaAgendamento
            ? `${dataAgendamento}T${horaAgendamento}:00`
            : null,
        });

        const newOrderId = orderResult.orderId;

        // Agora processar o pagamento via Mercado Pago
        if (paymentData.forma === 'pix') {
          const paymentResult = await createPayment({
            pedidoId: newOrderId,
            paymentMethodId: 'pix',
          });

          if (paymentResult.success) {
            if (paymentResult.qrCode || paymentResult.qrCodeBase64) {
              setMpQrCode(paymentResult.qrCode || null);
              setMpQrCodeBase64(paymentResult.qrCodeBase64 || null);
            }
            setOrderId(newOrderId);
            // NÃO ir para success ainda - mostrar QR Code para pagar
            setStep('payment');

            toast.info('Escaneie o QR Code ou copie o código PIX para pagar.');
          } else {
            toast.error(paymentResult.error || 'Erro ao gerar pagamento PIX');
          }
        } else if (paymentData.forma === 'cartao') {
          setOrderId(newOrderId);
          setShowCardForm(true);
        }
      } catch (error: any) {
        toast.error(error.message || 'Erro ao processar pedido');
      } finally {
        setMpLoading(false);
      }
      return;
    }

    // Para dinheiro ou cartão na entrega, processo normal
    setLoading(true);

    try {
      const result = await createPublicOrder({
        empresaId,
        clienteTelefone: customerData.telefone.replace(/\D/g, ''),
        clienteNome: customerData.nome || 'Cliente Cardápio',
        clienteEndereco: customerData.endereco,
        clienteBairro: customerData.bairro,
        tipoEntrega: isDelivery ? 'delivery' : 'retirada',
        taxaEntrega: deliveryFee,
        itens: items.map(item => ({
          id: item.productId,
          nome: item.nome,
          preco: item.preco,
          quantidade: item.quantidade,
          complementos: item.complementos,
        })),
        subtotal,
        desconto: desconto + descontoPontos,
        total: totalFinal,
        cupomCodigo: cupom?.codigo,
        cupomId: cupom?.id,
        pontosGanhos,
        pontosUsados: pontosASeremUsados,
        descontoPontos: descontoPontos,
        formaPagamento: paymentData.forma,
        troco: paymentData.forma === 'dinheiro' ? paymentData.troco : undefined,
        dataAgendamento: agendarPedido && dataAgendamento && horaAgendamento
          ? `${dataAgendamento}T${horaAgendamento}:00`
          : null,
      });

      setOrderId(result.orderId);
      setStep('success');

      playSuccessSound();

    } catch (error: any) {
      toast.error(error.message || 'Erro ao finalizar pedido');
    } finally {
      setLoading(false);
    }
  };

  const copyPixCode = () => {
    if (mpQrCode) {
      navigator.clipboard.writeText(mpQrCode);
      setMpCopied(true);
      toast.success('Código copiado!');
      setTimeout(() => setMpCopied(false), 2000);
    }
  };

  const handleCardPaymentSuccess = () => {
    setStep('success');
    playSuccessSound();
  };

  const handleCardPaymentError = (error: string) => {
    toast.error(error);
  };

  const checkPixPayment = async () => {
    if (!orderId) return;

    setLoading(true);
    try {
      const { getPaymentStatus, getOrderPaymentId } = await import('@/app/actions/mercadopago');

      const paymentId = await getOrderPaymentId(orderId);

      if (!paymentId) {
        toast.error('Pagamento ainda não registrado. Aguarde alguns segundos.');
        return;
      }

      const statusResult = await getPaymentStatus(Number(paymentId));

      if (statusResult.success && statusResult.status === 'approved') {
        setStep('success');
        playSuccessSound();
        toast.success('Pagamento confirmado!');
      } else {
        toast.info('Pagamento ainda não confirmado. Aguarde alguns segundos e tente novamente.');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao verificar pagamento');
    } finally {
      setLoading(false);
    }
  };

  const playSuccessSound = () => {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU');
      audio.volume = 0.5;
      audio.play().catch(() => { });
    } catch { }
  };

  const resetCart = () => {
    clearCart();
    setStep('cart');
    setCustomerData({ nome: '', telefone: clienteTelefone || '', endereco: '', bairro: '', cidade: '' });
    setPaymentData({ forma: 'pix', troco: 0 });
    setOrderId(null);
    setIsOpen(false);
    setIsExistingCustomer(false);
    setPhoneChecked(false);
    setClientPoints(null);
    setDeliveryFee(0);
    setDeliveryCoords(null);
    setDeliveryInfo(null);
    setUsePoints(false);
    setMpQrCode(null);
    setMpQrCodeBase64(null);
    setMpCopied(false);
    setShowCardForm(false);
  };

  // Auto-show upsell
  useEffect(() => {
    if (items.length > 0 && !showUpsell && step === 'cart') {
      const timer = setTimeout(() => setShowUpsell(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [items.length, showUpsell, step]);

  // Buscar configuração de fidelidade ao montar
  useEffect(() => {
    const fetchLoyaltyConfig = async () => {
      try {
        const config = await getLoyaltyConfig();
        if (config) {
          setLoyaltyConfig({
            pontos_para_desconto: config.pontos_para_desconto || 100,
            desconto_valor: config.desconto_valor || 10,
          });
        }
      } catch (error) {
        console.error('Erro ao buscar config fidelidade:', error);
      }
    };
    fetchLoyaltyConfig();
  }, []);

  // Buscar configuração de entrega ao montar
  useEffect(() => {
    const fetchDeliveryConfig = async () => {
      try {
        const config = await getDeliveryConfig();
        if (config) {
          setDeliveryConfig({
            auto_radius: config.auto_radius,
            taxa_entrega_fixa: config.taxa_entrega_fixa
          });
        }
      } catch (error) {
        console.error('Erro ao buscar config entrega:', error);
      }
    };
    fetchDeliveryConfig();
  }, []);

  // Buscar pontos do cliente quando o telefone for preenchido
  const fetchClientPoints = async (telefone: string) => {
    const cleanPhone = telefone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setClientPoints(null);
      return;
    }

    setLoadingPoints(true);
    try {
      const points = await getClientPoints(cleanPhone);
      // Calcular pontos disponíveis (acumulados - gastos)
      const pontosDisponiveis = (points?.pontos_acumulados || 0) - (points?.pontos_gastos || 0);
      setClientPoints(pontosDisponiveis);
    } catch (error) {
      setClientPoints(null);
    } finally {
      setLoadingPoints(false);
    }
  };

  // Buscar pontos quando o telefone mudar
  useEffect(() => {
    if (customerData.telefone && step === 'customer' && phoneChecked) {
      fetchClientPoints(customerData.telefone);
    }
  }, [customerData.telefone, step, phoneChecked]);

  // Calcular taxa de entrega quando endereço for preenchido
  const calculateDelivery = async () => {
    if (!isDelivery || !customerData.endereco || !customerData.bairro) {
      setDeliveryFee(0);
      setDeliveryCoords(null);
      setDeliveryInfo(null);
      return;
    }

    const fullAddress = `${customerData.endereco}, ${customerData.bairro}, ${customerData.cidade || ''}`;

    setDeliveryLoading(true);
    try {
      // Geocodificar endereço com cidade
      const coords = await geocodeAddress(
        `${customerData.endereco}, ${customerData.bairro}`,
        customerData.cidade || undefined
      );

      if (!coords) {
        toast.error('Não foi possível localizar o endereço. Verifique se está correto.');
        setDeliveryFee(0);
        setDeliveryCoords(null);
        setDeliveryInfo(null);
        return;
      }

      setDeliveryCoords(coords);
      console.log('[Delivery] Coordenadas encontradas:', coords);

      // Calcular taxa usando a API
      const result = await calculateDeliveryFee(coords);

      console.log('[Delivery] Resultado:', result);

      if (result.success && result.taxa_entrega !== undefined) {
        setDeliveryFee(result.taxa_entrega);
        setDeliveryInfo({
          distance: result.distance_km,
          duration: result.duration_min
        });
        toast.success(`Entrega calculada: ${result.distance_km}km - ${result.duration_min}min - R$ ${result.taxa_entrega.toFixed(2).replace('.', ',')}`);
      } else {
        toast.warning(result.error || 'Não foi possível calcular a taxa. Verifique os dados.');
        setDeliveryFee(0);
      }
    } catch (error) {
      console.error('[Delivery] Erro ao calcular:', error);
      toast.error('Erro ao calcular taxa de entrega');
      setDeliveryFee(0);
    } finally {
      setDeliveryLoading(false);
    }
  };

  // Verificar se cliente existe ao completar o telefone
  const checkCustomerExists = async () => {
    const cleanPhone = customerData.telefone.replace(/\D/g, '');
    if (cleanPhone.length < 10) return;

    setCheckingCustomer(true);
    try {
      // Chamar server action para verificar cliente
      const { checkCustomerByPhone } = await import('@/app/actions/public-orders');
      const customer = await checkCustomerByPhone(empresaId || 0, cleanPhone);

      if (customer) {
        setIsExistingCustomer(true);
        setCustomerData(prev => ({
          ...prev,
          nome: customer.nome || '',
          endereco: customer.endereco || '',
          bairro: customer.bairro_entrega || '',
          cidade: customer.cidade || '',
        }));
      } else {
        setIsExistingCustomer(false);
      }
      setPhoneChecked(true);
    } catch (error) {
      console.error('Erro ao verificar cliente:', error);
      setIsExistingCustomer(false);
      setPhoneChecked(true);
    } finally {
      setCheckingCustomer(false);
    }
  };

  // Validação baseada no step atual
  const isCustomerValid = !phoneChecked
    ? customerData.telefone.replace(/\D/g, '').length >= 10
    : isExistingCustomer
      ? (isDelivery ? customerData.endereco.length >= 5 : true)
      : customerData.nome.length >= 2 && (isDelivery ? customerData.endereco.length >= 5 : true);

  return (
    <>
      {/* Floating Cart Button */}
      <AnimatePresence>
        {items.length > 0 && step !== 'success' && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-600 text-white rounded-full p-4 shadow-2xl shadow-green-500/30 transition-all active:scale-95"
          >
            <ShoppingCart className="size-6" />
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
              {itemCount}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Cart Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => step !== 'success' && setIsOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  {step !== 'cart' && step !== 'success' && (
                    <button
                      onClick={() => setStep(step === 'payment' ? 'customer' : 'cart')}
                      className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <ArrowLeft className="size-5 text-slate-500" />
                    </button>
                  )}
                  <h2 className="text-lg font-bold text-slate-900">
                    {step === 'cart' && 'Seu Pedido'}
                    {step === 'customer' && 'Seus Dados'}
                    {step === 'payment' && 'Pagamento'}
                    {step === 'success' && 'Pedido Enviado!'}
                  </h2>
                </div>
                {step !== 'success' && (
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="size-5 text-slate-400" />
                  </button>
                )}
              </div>

              {/* Progress Steps */}
              {step !== 'success' && (
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 shrink-0">
                  <div className="flex items-center justify-between">
                    {['Pedido', 'Dados', 'Pagamento'].map((label, idx) => (
                      <div key={label} className="flex items-center gap-2">
                        <div className={cn(
                          "size-7 rounded-full flex items-center justify-center text-xs font-bold",
                          (step === 'cart' && idx === 0) ||
                            (step === 'customer' && idx === 1) ||
                            (step === 'payment' && idx === 2)
                            ? "bg-green-500 text-white"
                            : idx < (step === 'customer' ? 1 : step === 'payment' ? 2 : 0)
                              ? "bg-green-100 text-green-600"
                              : "bg-slate-200 text-slate-500"
                        )}>
                          {idx < (step === 'customer' ? 1 : step === 'payment' ? 2 : 0) ? (
                            <Check className="size-4" />
                          ) : (
                            idx + 1
                          )}
                        </div>
                        <span className="text-xs font-medium text-slate-600 hidden sm:block">{label}</span>
                        {idx < 2 && <ChevronRight className="size-4 text-slate-300 hidden sm:block" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">

                {/* STEP 1: Cart */}
                {step === 'cart' && (
                  <div className="p-4 space-y-4">
                    {items.length === 0 ? (
                      <div className="py-12 text-center">
                        <ShoppingCart className="size-12 text-slate-200 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">Carrinho vazio</p>
                        <p className="text-sm text-slate-400 mt-1">Adicione itens do cardápio</p>
                      </div>
                    ) : (
                      <>
                        {items.map((item) => (
                          <div key={item.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <div className="flex gap-3">
                              <div className="flex-1">
                                <h4 className="font-bold text-slate-900 text-sm">{item.nome}</h4>
                                {item.complementos && item.complementos.length > 0 && (
                                  <div className="mt-1 space-y-0.5">
                                    {item.complementos.map((grupo, idx) => (
                                      <p key={idx} className="text-[10px] text-slate-500">
                                        {grupo.grupoNome}: {grupo.items.map(i => i.nome).join(', ')}
                                      </p>
                                    ))}
                                  </div>
                                )}
                                <p className="text-xs text-violet-600 font-bold mt-1">{formatPrice(item.preco)}</p>
                              </div>

                              <div className="flex flex-col items-end gap-2">
                                <button
                                  onClick={() => removeItem(item.id)}
                                  className="p-1 hover:bg-red-100 rounded-lg transition-colors"
                                >
                                  <Trash2 className="size-4 text-red-400" />
                                </button>

                                <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200">
                                  <button
                                    onClick={() => updateQuantity(item.id, item.quantidade - 1)}
                                    className="p-1.5 hover:bg-slate-100 rounded-l-lg transition-colors"
                                  >
                                    <Minus className="size-3 text-slate-500" />
                                  </button>
                                  <span className="text-sm font-bold text-slate-900 w-6 text-center">
                                    {item.quantidade}
                                  </span>
                                  <button
                                    onClick={() => updateQuantity(item.id, item.quantidade + 1)}
                                    className="p-1.5 hover:bg-slate-100 rounded-r-lg transition-colors"
                                  >
                                    <Plus className="size-3 text-slate-500" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Upsell Suggestions */}
                        {showUpsell && upsellSuggestions.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4"
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <Sparkles className="size-4 text-amber-500" />
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Que tal adicionar?</span>
                            </div>
                            <div className="space-y-2">
                              {upsellSuggestions.map((sugestao) => (
                                <button
                                  key={sugestao.id}
                                  onClick={() => addItem({
                                    productId: sugestao.id,
                                    nome: sugestao.nome,
                                    preco: sugestao.preco,
                                    quantidade: 1,
                                    imagem: sugestao.imagem || undefined
                                  })}
                                  className="w-full flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-xl hover:bg-amber-100 transition-colors"
                                >
                                  <div className="text-left">
                                    <p className="text-sm font-bold text-slate-900">{sugestao.nome}</p>
                                    <p className="text-[10px] text-amber-600">{sugestao.sugestao}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-violet-600">{formatPrice(sugestao.preco)}</span>
                                    <Plus className="size-4 text-amber-500" />
                                  </div>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* STEP 2: Customer Data */}
                {step === 'customer' && (
                  <div className="p-4 space-y-4">
                    {/* ETAPA 1: Apenas telefone para verificar cadastro */}
                    {!phoneChecked ? (
                      <>
                        <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex gap-3">
                          <Phone className="size-5 text-green-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-slate-900">Digite seu WhatsApp</p>
                            <p className="text-xs text-slate-600 mt-1">Vamos verificar se você já é nosso cliente</p>
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <Phone className="size-4" />
                            WhatsApp *
                          </label>
                          <input
                            type="tel"
                            autoFocus
                            value={customerData.telefone}
                            onChange={(e) => {
                              let value = e.target.value.replace(/\D/g, '');
                              if (value.length > 11) value = value.slice(0, 11);
                              if (value.length > 6) {
                                value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
                              } else if (value.length > 2) {
                                value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
                              } else if (value.length > 0) {
                                value = `(${value}`;
                              }
                              setCustomerData({ ...customerData, telefone: value });
                            }}
                            placeholder="(11) 99999-9999"
                            className="w-full mt-1 px-4 py-4 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none text-lg text-center font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800"
                          />
                        </div>

                        {checkingCustomer && (
                          <div className="flex items-center justify-center gap-2 py-4">
                            <Loader2 className="size-5 text-green-500 animate-spin" />
                            <span className="text-sm text-slate-600">Verificando cadastro...</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {/* Cliente já existe - mostrar info */}
                        {isExistingCustomer && (
                          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                            <div className="flex items-center gap-3">
                              <div className="size-10 bg-green-500 rounded-full flex items-center justify-center">
                                <Check className="size-5 text-white" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-green-800">Bem-vindo de volta, {customerData.nome}!</p>
                                <p className="text-xs text-green-600">Seus dados já estão salvos</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Novo cadastro */}
                        {!isExistingCustomer && (
                          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
                            <User className="size-5 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-bold text-slate-900">Novo cliente</p>
                              <p className="text-xs text-slate-600 mt-1">Cadastre-se rapidinho para finalizar</p>
                            </div>
                          </div>
                        )}

                        {/* Pontos do cliente */}
                        {loadingPoints && (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                            <Loader2 className="size-4 text-slate-400 animate-spin" />
                            <span className="text-sm text-slate-500">Verificando seus pontos...</span>
                          </div>
                        )}

                        {clientPoints !== null && clientPoints > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                              "border rounded-xl p-4 flex items-center gap-3",
                              clientPoints >= 100
                                ? "bg-green-50 border-green-200"
                                : "bg-amber-50 border-amber-200"
                            )}
                          >
                            <Star className={cn("size-6", clientPoints >= 100 ? "text-green-500" : "text-amber-500")} />
                            <div>
                              <p className="text-sm font-bold text-slate-900">
                                Você tem <span className="text-lg">{clientPoints}</span> pontos!
                              </p>
                              {clientPoints >= 100 ? (
                                <p className="text-xs text-green-600 font-medium">
                                  🎉 Você pode resgatar {Math.floor(clientPoints / 100) * 10} reais de desconto!
                                </p>
                              ) : (
                                <p className="text-xs text-amber-600">
                                  Faltam {100 - (clientPoints % 100)} pontos para o próximo desconto de R$ 10
                                </p>
                              )}
                            </div>
                          </motion.div>
                        )}

                        <div className="space-y-4">
                          {/* Telefone (somente leitura) */}
                          <div>
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                              <Phone className="size-4" />
                              WhatsApp
                            </label>
                            <input
                              type="tel"
                              value={customerData.telefone}
                              disabled
                              className="w-full mt-1 px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                            />
                          </div>

                          {/* Nome - obrigatório apenas para novo cadastro */}
                          {!isExistingCustomer && (
                            <div>
                              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <User className="size-4" />
                                Nome completo *
                              </label>
                              <input
                                type="text"
                                value={customerData.nome}
                                onChange={(e) => setCustomerData({ ...customerData, nome: e.target.value })}
                                placeholder="Seu nome"
                                autoFocus
                                className="w-full mt-1 px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                              />
                            </div>
                          )}

                          {/* Delivery ou Retirada */}
                          <div>
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                              Como deseja receber?
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsDelivery(true);
                                  // Se raio automático está desativado, usar taxa fixa
                                  if (deliveryConfig && !deliveryConfig.auto_radius && deliveryConfig.taxa_entrega_fixa > 0) {
                                    setDeliveryFee(deliveryConfig.taxa_entrega_fixa);
                                  } else if (!deliveryConfig?.auto_radius) {
                                    // Sem config, usar taxa padrão
                                    setDeliveryFee(5);
                                  } else {
                                    // Raio automático ativado, zerar taxa (será calculada)
                                    setDeliveryFee(0);
                                  }
                                }}
                                className={cn(
                                  "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                                  isDelivery
                                    ? "border-green-500 bg-green-50"
                                    : "border-slate-200 hover:border-slate-300"
                                )}
                              >
                                <span className="text-2xl">🛵</span>
                                <span className="text-sm font-bold text-slate-900">Delivery</span>
                                <span className="text-xs text-slate-500">
                                  {deliveryConfig && !deliveryConfig.auto_radius && deliveryConfig.taxa_entrega_fixa > 0
                                    ? `Taxa: R$ ${deliveryConfig.taxa_entrega_fixa.toFixed(2).replace('.', ',')}`
                                    : deliveryConfig?.auto_radius
                                      ? 'Taxa calculada'
                                      : 'Taxa: R$ 5,00'}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsDelivery(false);
                                  setDeliveryFee(0);
                                }}
                                className={cn(
                                  "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                                  !isDelivery
                                    ? "border-green-500 bg-green-50"
                                    : "border-slate-200 hover:border-slate-300"
                                )}
                              >
                                <span className="text-2xl">🏪</span>
                                <span className="text-sm font-bold text-slate-900">Retirada</span>
                                <span className="text-xs text-slate-500">Grátis</span>
                              </button>
                            </div>
                          </div>

                          {/* Endereço - só mostra se for delivery */}
                          {isDelivery && (
                            <>
                              <div>
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                  <MapPin className="size-4" />
                                  Endereço de entrega *
                                </label>
                                <input
                                  type="text"
                                  value={customerData.endereco}
                                  onChange={(e) => setCustomerData({ ...customerData, endereco: e.target.value })}
                                  placeholder="Rua, número, complemento"
                                  className="w-full mt-1 px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                    Bairro *
                                  </label>
                                  <input
                                    type="text"
                                    value={customerData.bairro}
                                    onChange={(e) => setCustomerData({ ...customerData, bairro: e.target.value })}
                                    placeholder="Seu bairro"
                                    className="w-full mt-1 px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                  />
                                </div>
                                <div>
                                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                    Cidade
                                  </label>
                                  <input
                                    type="text"
                                    value={customerData.cidade}
                                    onChange={(e) => setCustomerData({ ...customerData, cidade: e.target.value })}
                                    placeholder="Sua cidade"
                                    className="w-full mt-1 px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                  />
                                </div>
                              </div>

                              {/* Botão calcular entrega */}
                              {customerData.endereco.length > 5 && customerData.bairro.length > 2 && deliveryConfig?.auto_radius && (
                                <button
                                  type="button"
                                  onClick={calculateDelivery}
                                  disabled={deliveryLoading}
                                  className="w-full py-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 font-bold text-sm hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                                >
                                  {deliveryLoading ? (
                                    <>
                                      <Loader2 className="size-4 animate-spin" />
                                      Calculando...
                                    </>
                                  ) : (
                                    <>
                                      <MapPin className="size-4" />
                                      Calcular Taxa de Entrega
                                    </>
                                  )}
                                </button>
                              )}

                              {/* Mostrar taxa fixa quando raio automático está desativado */}
                              {isDelivery && deliveryConfig && !deliveryConfig.auto_radius && deliveryConfig.taxa_entrega_fixa > 0 && (
                                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <MapPin className="size-4 text-green-600" />
                                      <span className="text-sm font-medium text-green-800">Taxa de entrega</span>
                                    </div>
                                    <span className="font-bold text-green-800">R$ {deliveryConfig.taxa_entrega_fixa.toFixed(2).replace('.', ',')}</span>
                                  </div>
                                </div>
                              )}

                              {/* Resultado do cálculo */}
                              {deliveryInfo && (
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-blue-700">📍 {deliveryInfo.distance}km</span>
                                    <span className="text-blue-700">⏱️ {deliveryInfo.duration}min</span>
                                    <span className="font-bold text-blue-800">R$ {deliveryFee.toFixed(2)}</span>
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          {!isDelivery && (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                              <p className="text-sm font-bold text-green-800">Retirada no balcão</p>
                              <p className="text-xs text-green-600 mt-1">Seu pedido ficará pronto para retirada</p>
                            </div>
                          )}

                          {/* Agendamento - apenas para retirada */}
                          {!isDelivery && (
                            <div className="border-t border-slate-200 pt-4 mt-4">
                              <label className="flex items-center gap-3 cursor-pointer">
                                <div className="relative">
                                  <input
                                    type="checkbox"
                                    checked={agendarPedido}
                                    onChange={(e) => setAgendarPedido(e.target.checked)}
                                    className="sr-only"
                                  />
                                  <div className={cn(
                                    "w-11 h-6 rounded-full transition-colors",
                                    agendarPedido ? "bg-violet-500" : "bg-slate-200"
                                  )}>
                                    <div className={cn(
                                      "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                                      agendarPedido && "translate-x-5"
                                    )} />
                                  </div>
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                    📅 Agendar pedido
                                  </p>
                                  <p className="text-xs text-slate-500">Quero buscar em outro horário</p>
                                </div>
                              </label>

                              {agendarPedido && (
                                <div className="grid grid-cols-2 gap-3 mt-3 ml-14">
                                  <div>
                                    <label className="text-xs font-medium text-slate-600">Data</label>
                                    <input
                                      type="date"
                                      value={dataAgendamento}
                                      onChange={(e) => setDataAgendamento(e.target.value)}
                                      min={new Date().toISOString().split('T')[0]}
                                      className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-slate-600">Horário</label>
                                    <input
                                      type="time"
                                      value={horaAgendamento}
                                      onChange={(e) => setHoraAgendamento(e.target.value)}
                                      className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* STEP 3: Payment */}
                {step === 'payment' && (
                  <div className="p-4 space-y-4">
                    {showCardForm && orderId ? (
                      <>
                        <button
                          onClick={() => setShowCardForm(false)}
                          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-300 mb-2"
                        >
                          <ArrowLeft className="size-4" />
                          Voltar
                        </button>
                        <PaymentForm
                          pedidoId={orderId}
                          total={totalFinal}
                          onSuccess={handleCardPaymentSuccess}
                          onError={handleCardPaymentError}
                        />
                      </>
                    ) : (
                      <>
                        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                          <p className="text-sm font-bold text-slate-900">Escolha a forma de pagamento</p>
                          <p className="text-xs text-slate-600 mt-1">Após confirmar, seu pedido será enviado para produção</p>
                        </div>

                        {mpQrCode && paymentData.forma === 'pix' ? (
                          <div className="space-y-4">
                            <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 text-center">
                              <p className="font-bold text-violet-900">Pagamento PIX</p>
                              <p className="text-xs text-violet-600">Escaneie o QR Code ou copie o código</p>
                            </div>

                            {mpQrCodeBase64 && (
                              <div className="flex justify-center">
                                <Image
                                  src={`data:image/png;base64,${mpQrCodeBase64}`}
                                  alt="PIX QR Code"
                                  width={192}
                                  height={192}
                                  className="border rounded-xl"
                                />
                              </div>
                            )}

                            {mpQrCode && (
                              <div className="bg-slate-50 rounded-xl p-4">
                                <label className="text-xs font-bold text-slate-500 uppercase">Código PIX</label>
                                <div className="flex items-center gap-2 mt-1">
                                  <input
                                    type="text"
                                    value={mpQrCode}
                                    readOnly
                                    className="flex-1 text-xs text-slate-600 bg-white border rounded-lg px-3 py-2"
                                  />
                                  <button
                                    onClick={copyPixCode}
                                    className="p-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors"
                                  >
                                    {mpCopied ? <CheckCircle className="size-5" /> : <Copy className="size-5" />}
                                  </button>
                                </div>
                              </div>
                            )}

                            <button
                              onClick={checkPixPayment}
                              disabled={loading}
                              className="w-full py-4 bg-green-500 hover:bg-green-600 disabled:bg-green-400 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                            >
                              {loading ? (
                                <>
                                  <Loader2 className="size-5 animate-spin" />
                                  Verificando...
                                </>
                              ) : (
                                'Já efetuei o pagamento'
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <button
                              onClick={() => setPaymentData({ ...paymentData, forma: 'pix' })}
                              className={cn(
                                "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all",
                                paymentData.forma === 'pix'
                                  ? "border-green-500 bg-green-50"
                                  : "border-slate-200 hover:border-slate-300"
                              )}
                            >
                              <div className={cn(
                                "size-12 rounded-xl flex items-center justify-center",
                                paymentData.forma === 'pix' ? "bg-green-500 text-white" : "bg-slate-100 text-slate-500"
                              )}>
                                <QrCode className="size-6" />
                              </div>
                              <div className="text-left flex-1">
                                <p className="font-bold text-slate-900">PIX</p>
                                <p className="text-xs text-slate-500">Pagamento instantâneo online</p>
                              </div>
                              {paymentData.forma === 'pix' && (
                                <Check className="size-5 text-green-500" />
                              )}
                            </button>

                            <button
                              onClick={() => setPaymentData({ ...paymentData, forma: 'dinheiro' })}
                              className={cn(
                                "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all",
                                paymentData.forma === 'dinheiro'
                                  ? "border-green-500 bg-green-50"
                                  : "border-slate-200 hover:border-slate-300"
                              )}
                            >
                              <div className={cn(
                                "size-12 rounded-xl flex items-center justify-center",
                                paymentData.forma === 'dinheiro' ? "bg-green-500 text-white" : "bg-slate-100 text-slate-500"
                              )}>
                                <Banknote className="size-6" />
                              </div>
                              <div className="text-left flex-1">
                                <p className="font-bold text-slate-900">Dinheiro</p>
                                <p className="text-xs text-slate-500">Pagamento na entrega</p>
                              </div>
                              {paymentData.forma === 'dinheiro' && (
                                <Check className="size-5 text-green-500" />
                              )}
                            </button>

                            <button
                              onClick={() => setPaymentData({ ...paymentData, forma: 'cartao' })}
                              className={cn(
                                "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all",
                                paymentData.forma === 'cartao'
                                  ? "border-green-500 bg-green-50"
                                  : "border-slate-200 hover:border-slate-300"
                              )}
                            >
                              <div className={cn(
                                "size-12 rounded-xl flex items-center justify-center",
                                paymentData.forma === 'cartao' ? "bg-green-500 text-white" : "bg-slate-100 text-slate-500"
                              )}>
                                <CreditCard className="size-6" />
                              </div>
                              <div className="text-left flex-1">
                                <p className="font-bold text-slate-900">Cartão</p>
                                <p className="text-xs text-slate-500">Débito ou crédito online</p>
                              </div>
                              {paymentData.forma === 'cartao' && (
                                <Check className="size-5 text-green-500" />
                              )}
                            </button>
                          </div>
                        )}

                        {/* Troco para dinheiro */}
                        {paymentData.forma === 'dinheiro' && !mpQrCode && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-slate-50 rounded-xl p-4"
                          >
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                              Precisa de troco?
                            </label>
                            <input
                              type="number"
                              value={paymentData.troco || ''}
                              onChange={(e) => setPaymentData({ ...paymentData, troco: parseFloat(e.target.value) || 0 })}
                              placeholder="Valor para troco (opcional)"
                              className="w-full mt-2 px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            />
                            {paymentData.troco > 0 && (
                              <p className="text-xs text-slate-500 mt-2">
                                Troco: {formatPrice(paymentData.troco - totalFinal)}
                              </p>
                            )}
                          </motion.div>
                        )}

                        {/* Usar pontos */}
                        {pontosDisponiveis >= (loyaltyConfig?.pontos_para_desconto || 100) && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="border border-amber-200 bg-amber-50 rounded-xl p-4"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Star className="size-6 text-amber-500" />
                                <div>
                                  <p className="text-sm font-bold text-slate-900">
                                    Usar {pontosDisponiveis} pontos?
                                  </p>
                                  <p className="text-xs text-amber-700">
                                    Desconto de {formatPrice(maxDescontoPorPontos)}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => setUsePoints(!usePoints)}
                                className={cn(
                                  "relative w-14 h-8 rounded-full transition-colors",
                                  usePoints ? "bg-green-500" : "bg-slate-300"
                                )}
                              >
                                <div className={cn(
                                  "absolute top-1 w-6 h-6 rounded-full bg-white transition-transform shadow-md",
                                  usePoints ? "left-7" : "left-1"
                                )} />
                              </button>
                            </div>
                            {usePoints && descontoPontos > 0 && (
                              <div className="mt-3 pt-3 border-t border-amber-200">
                                <div className="flex justify-between text-sm">
                                  <span className="text-amber-700">Desconto ({pontosASeremUsados} pontos)</span>
                                  <span className="font-bold text-green-600">-{formatPrice(descontoPontos)}</span>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* STEP 4: Success */}
                {step === 'success' && (
                  <div className="p-8 text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="size-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
                    >
                      <Check className="size-10 text-green-500" />
                    </motion.div>

                    <h3 className="text-xl font-bold text-slate-900 mb-2">
                      Pedido #{orderId} Recebido!
                    </h3>
                    <p className="text-sm text-slate-600 mb-6">
                      Seu pedido foi enviado para produção. Você receberá atualizações pelo WhatsApp.
                    </p>

                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6">
                      <div className="flex items-center gap-2 justify-center text-amber-700">
                        <Star className="size-4" />
                        <span className="font-bold text-sm">Você ganhou {pontosGanhos} pontos!</span>
                      </div>
                      <p className="text-xs text-amber-600 mt-1">Pontos adicionados à sua conta</p>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 text-left mb-6">
                      <h4 className="font-bold text-slate-900 text-sm mb-2">Resumo do Pedido</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Subtotal</span>
                          <span className="font-medium">{formatPrice(subtotal)}</span>
                        </div>
                        {desconto > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Desconto cupom</span>
                            <span>-{formatPrice(desconto)}</span>
                          </div>
                        )}
                        {descontoPontos > 0 && (
                          <div className="flex justify-between text-amber-600">
                            <span>Desconto pontos</span>
                            <span>-{formatPrice(descontoPontos)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-base pt-2 border-t border-slate-200">
                          <span>Total</span>
                          <span>{formatPrice(totalFinal)}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={resetCart}
                      className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-2xl transition-all"
                    >
                      Fazer Novo Pedido
                    </button>
                  </div>
                )}
              </div>

              {/* Footer - Cart Step */}
              {step === 'cart' && items.length > 0 && (
                <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0 space-y-4">
                  {/* Cupom Input */}
                  <div>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                        <input
                          type="text"
                          value={cupomInput}
                          onChange={(e) => setCupomInput(e.target.value.toUpperCase())}
                          placeholder="Cupom de desconto"
                          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          disabled={!!cupom}
                        />
                      </div>
                      {cupom ? (
                        <button
                          onClick={removeCupom}
                          className="px-4 py-2.5 bg-red-100 text-red-600 rounded-xl text-sm font-bold hover:bg-red-200 transition-colors"
                        >
                          Remover
                        </button>
                      ) : (
                        <button
                          onClick={applyCupom}
                          disabled={loadingCupom || !cupomInput.trim()}
                          className="px-4 py-2.5 bg-green-500 text-white rounded-xl text-sm font-bold hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {loadingCupom ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                        </button>
                      )}
                    </div>
                    {cupomError && (
                      <p className="text-xs text-red-500 mt-1">{cupomError}</p>
                    )}
                    {cupom && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <Check className="size-3" />
                        Cupom {cupom.codigo}: {cupom.tipo === 'percentual' ? `${cupom.desconto}%` : formatPrice(cupom.desconto)} de desconto
                      </p>
                    )}
                  </div>

                  {/* Points Preview */}
                  {pontosGanhos > 0 && (
                    <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Star className="size-4 text-amber-500" />
                        <span className="text-sm text-slate-600">Você ganhará:</span>
                      </div>
                      <span className="text-sm font-bold text-amber-600">{pontosGanhos} pontos</span>
                    </div>
                  )}

                  {/* Totals */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{formatPrice(subtotal)}</span>
                    </div>
                    {cupom && desconto > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">Desconto ({cupom.codigo})</span>
                        <span className="font-medium text-green-600">-{formatPrice(desconto)}</span>
                      </div>
                    )}
                    {descontoPontos > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-amber-600">Desconto Pontos</span>
                        <span className="font-medium text-amber-600">-{formatPrice(descontoPontos)}</span>
                      </div>
                    )}
                    {deliveryFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Taxa de Entrega</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{formatPrice(deliveryFee)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                      <span className="text-base font-bold text-slate-900">Total</span>
                      <span className="text-xl font-black text-slate-900">{formatPrice(totalFinal)}</span>
                    </div>
                  </div>

                  {/* Continue Button */}
                  <button
                    onClick={proceedToCustomer}
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-green-500/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    Continuar
                    <ChevronRight className="size-5" />
                  </button>
                </div>
              )}

              {/* Footer - Customer Step */}
              {step === 'customer' && (
                <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0">
                  <button
                    onClick={proceedToPayment}
                    disabled={checkingCustomer || (!phoneChecked && customerData.telefone.replace(/\D/g, '').length < 10) || (phoneChecked && !isExistingCustomer && !customerData.nome) || (phoneChecked && !customerData.endereco)}
                    className="w-full bg-green-500 hover:bg-green-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
                  >
                    {checkingCustomer ? (
                      <>
                        <Loader2 className="size-5 animate-spin" />
                        Verificando...
                      </>
                    ) : !phoneChecked ? (
                      <>
                        Verificar Cadastro
                        <ChevronRight className="size-5" />
                      </>
                    ) : (
                      <>
                        Continuar para Pagamento
                        <ChevronRight className="size-5" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Footer - Payment Step */}
              {step === 'payment' && !showCardForm && (
                <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0 space-y-4">
                  {/* Order Summary */}
                  <div className="bg-white rounded-xl p-4 border border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-slate-500">Total do Pedido</span>
                      <span className="text-xl font-black text-slate-900">{formatPrice(totalFinal)}</span>
                    </div>
                    {descontoPontos > 0 && (
                      <div className="text-xs text-amber-600 mb-2">
                        Você economizou {formatPrice(descontoPontos)} usando {pontosASeremUsados} pontos!
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <Star className="size-3" />
                      <span>{pontosGanhos} pontos para esta compra</span>
                    </div>
                  </div>

                  <button
                    onClick={finishOrder}
                    disabled={loading || mpLoading}
                    className="w-full bg-green-500 hover:bg-green-600 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl shadow-lg shadow-green-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    {loading || mpLoading ? (
                      <>
                        <Loader2 className="size-5 animate-spin" />
                        {mpLoading ? 'Gerando pagamento...' : 'Enviando pedido...'}
                      </>
                    ) : (
                      <>
                        <Check className="size-5" />
                        {paymentData.forma === 'pix' ? 'Gerar Pagamento PIX' :
                          paymentData.forma === 'cartao' ? 'Iniciar Pagamento com Cartão' :
                            'Confirmar Pedido'}
                      </>
                    )}
                  </button>

                  <p className="text-center text-xs text-slate-400">
                    {paymentData.forma === 'pix'
                      ? 'Você será redirecionado para pagamento'
                      : paymentData.forma === 'cartao'
                        ? 'Pagamento seguro via Mercado Pago'
                        : 'Ao confirmar, seu pedido será enviado para produção'}
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
