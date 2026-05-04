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
  CheckCircle,
  Edit2,
  MessageSquare
} from 'lucide-react';
import { useCart } from './cart-context';
import { cn } from '@/lib/utils';
import { validateCoupon } from '@/app/actions/coupons';
import { createPublicOrder } from '@/app/actions/public-orders';
import { getClientPoints, getLoyaltyConfig } from '@/app/actions/loyalty';
import { calculateDeliveryFee, geocodeAddress, getDeliveryConfig, getAvailableBairros, getDeliveryRateByBairro } from '@/app/actions/delivery';
import { createPayment } from '@/app/actions/mercadopago';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import Image from 'next/image';

const PaymentForm = dynamic(() => import('./payment-form'), { ssr: false });

interface CartProps {
  whatsappNumber: string;
  empresaNome: string;
  empresaId?: number;
  empresaCidade?: string | null;
  empresaEstado?: string | null;
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

const formatPhone = (value: string) => {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
};

export default function Cart({ whatsappNumber, empresaNome, empresaId, empresaCidade, empresaEstado, clienteTelefone, upsellProducts = [] }: CartProps) {
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
  const [deliveryInfo, setDeliveryInfo] = useState<{ distance?: number; duration?: number; tempo_estimado?: string } | null>(null);
  const [deliveryConfig, setDeliveryConfig] = useState<{ auto_radius: boolean; taxa_entrega_fixa: number } | null>(null);
  const [availableBairros, setAvailableBairros] = useState<Array<{ bairro: string; taxa: number; tempo_estimado: string }>>([]);

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

  // Fetch configs
  useEffect(() => {
    if (empresaId) {
      getDeliveryConfig(empresaId).then(setDeliveryConfig);
      getLoyaltyConfig(empresaId).then(setLoyaltyConfig);
      getAvailableBairros(empresaId).then(setAvailableBairros);
    }
  }, [empresaId]);

  const fetchClientPoints = async (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) return;

    setLoadingPoints(true);
    try {
      const points = await getClientPoints(cleanPhone);
      const pontosDisponiveis = (points?.pontos_acumulados || 0) - (points?.pontos_gastos || 0);
      setClientPoints(pontosDisponiveis);
    } catch (error) {
      setClientPoints(null);
    } finally {
      setLoadingPoints(false);
    }
  };

  useEffect(() => {
    if (customerData.telefone && step === 'customer' && phoneChecked) {
      fetchClientPoints(customerData.telefone);
    }
  }, [customerData.telefone, step, phoneChecked]);

  const calculateDelivery = async () => {
    if (!isDelivery || !customerData.bairro) {
      setDeliveryFee(0);
      setDeliveryCoords(null);
      setDeliveryInfo(null);
      return;
    }

    setDeliveryLoading(true);
    try {
      // Se NAO usa raio automatico, calcula por bairro
      if (!deliveryConfig?.auto_radius && empresaId) {
        const bairroRate = await getDeliveryRateByBairro(empresaId, customerData.bairro);
        if (bairroRate) {
          setDeliveryFee(bairroRate.taxa);
          setDeliveryInfo({ tempo_estimado: bairroRate.tempo_estimado });
          toast.success(`Taxa de entrega: R$ ${bairroRate.taxa.toFixed(2).replace('.', ',')}`);
        } else {
          // Bairro nao encontrado - verifica se tem bairros cadastrados
          if (availableBairros.length > 0) {
            toast.error('Bairro não atendido. Selecione um bairro da lista.');
            setDeliveryFee(0);
          } else {
            // Nenhum bairro cadastrado, usa taxa fixa se houver
            setDeliveryFee(deliveryConfig?.taxa_entrega_fixa || 0);
          }
        }
        setDeliveryLoading(false);
        return;
      }

      // Usa raio automatico (Google Maps)
      if (!customerData.endereco) {
        setDeliveryFee(0);
        setDeliveryLoading(false);
        return;
      }

      // Usa a cidade/estado da empresa para precisao no geocoding
      const cidadeParaGeocode = empresaCidade || customerData.cidade || '';
      const estadoParaGeocode = empresaEstado || '';
      const fullAddress = `${customerData.endereco}, ${customerData.bairro}, ${cidadeParaGeocode}`;
      
      const coords = await geocodeAddress(
        fullAddress,
        cidadeParaGeocode || undefined,
        estadoParaGeocode || undefined
      );

      if (!coords) {
        toast.error('Não foi possível localizar o endereço.');
        setDeliveryFee(0);
        return;
      }

      setDeliveryCoords(coords);
      const result = await calculateDeliveryFee(coords, empresaId);

      if (result.success && result.taxa_entrega !== undefined) {
        setDeliveryFee(result.taxa_entrega);
        setDeliveryInfo({
          distance: result.distance_km,
          duration: result.duration_min
        });
        toast.success(`Entrega: R$ ${result.taxa_entrega.toFixed(2).replace('.', ',')}`);
      } else {
        toast.warning(result.error || 'Não foi possível calcular a taxa.');
        setDeliveryFee(0);
      }
    } catch (error) {
      toast.error('Erro ao calcular taxa de entrega');
      setDeliveryFee(0);
    } finally {
      setDeliveryLoading(false);
    }
  };

  const checkCustomerExists = async () => {
    const cleanPhone = customerData.telefone.replace(/\D/g, '');
    if (cleanPhone.length < 10) return;

    setCheckingCustomer(true);
    try {
      const { checkCustomerByPhone } = await import('@/app/actions/public-orders');
      const customer = await checkCustomerByPhone(empresaId || 0, cleanPhone);

      if (customer) {
        setIsExistingCustomer(true);
        setCustomerData(prev => ({
          ...prev,
          nome: String(customer.nome || ''),
          endereco: String(customer.endereco || ''),
          bairro: String(customer.bairro_entrega || ''),
          cidade: String(customer.cidade || ''),
        }));
      } else {
        setIsExistingCustomer(false);
      }
      setPhoneChecked(true);
    } catch (error) {
      setIsExistingCustomer(false);
      setPhoneChecked(true);
    } finally {
      setCheckingCustomer(false);
    }
  };

  const copyPixCode = () => {
    if (mpQrCode) {
      navigator.clipboard.writeText(mpQrCode);
      setMpCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setMpCopied(false), 2000);
    }
  };

  const checkPixPayment = async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const { getOrderStatus } = await import('@/app/actions/public-orders');
      const status = await getOrderStatus(orderId);
      if (status === 'pago' || status === 'producao') {
        setStep('success');
        clearCart();
        toast.success('Pagamento confirmado!');
      } else {
        toast.info('Ainda não recebemos a confirmação. Aguarde um instante.');
      }
    } catch (error) {
      toast.error('Erro ao verificar pagamento');
    } finally {
      setLoading(false);
    }
  };

  const finishOrder = async () => {
    if (!empresaId) {
      toast.error('Erro: empresa não identificada');
      return;
    }

    setLoading(true);
    try {
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
          tamanho: item.tamanho,
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
        troco: paymentData.troco || undefined,
        dataAgendamento: agendarPedido && dataAgendamento && horaAgendamento
          ? `${dataAgendamento}T${horaAgendamento}:00`
          : null,
      });

      const newOrderId = orderResult.orderId;
      setOrderId(newOrderId);

      if (paymentData.forma === 'pix') {
        const paymentResult = await createPayment({
          pedidoId: newOrderId,
          paymentMethodId: 'pix',
        });

        if (paymentResult.success) {
          setMpQrCode(paymentResult.qrCode || null);
          setMpQrCodeBase64(paymentResult.qrCodeBase64 || null);
        } else {
          toast.error(paymentResult.error || 'Erro ao gerar PIX');
        }
      } else if (paymentData.forma === 'cartao') {
        setShowCardForm(true);
      } else {
        // Dinheiro
        setStep('success');
        clearCart();
      }
    } catch (error) {
      toast.error('Erro ao finalizar pedido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Cart Button - Estilo iFood */}
      <AnimatePresence>
        {items.length > 0 && step !== 'success' && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-4 right-4 z-50"
          >
            <button
              onClick={() => setIsOpen(true)}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-3"
            >
              {/* Lado Esquerdo - Ver meu pedido */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="bg-[#22c55e] p-2.5 rounded-xl">
                    <ShoppingCart className="size-5 text-white" />
                  </div>
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold size-5 rounded-full flex items-center justify-center">
                    {itemCount}
                  </span>
                </div>
                <div className="text-left">
                  <p className="text-xs text-gray-400 font-medium">Ver meu pedido</p>
                  <p className="text-sm font-bold text-white">{itemCount} {itemCount === 1 ? 'item' : 'itens'}</p>
                </div>
              </div>

              {/* Lado Direito - Finalizar Pedido */}
              <div className="bg-[#22c55e] px-5 py-3 rounded-xl">
                <p className="text-[10px] text-white/80 font-semibold uppercase tracking-wider">Finalizar</p>
                <p className="text-sm font-black text-white">{formatPrice(totalFinal)}</p>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Bottom Sheet - Estilo iFood */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => step !== 'success' && setIsOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full sm:max-w-md md:max-w-lg bg-[#0a0a0a] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[80vh] sm:my-auto"
            >
              {/* Drag Handle - Mobile */}
              <div className="sm:hidden flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-[#2a2a2a] rounded-full" />
              </div>

              {/* Header */}
              <div className="px-5 py-4 sm:p-5 border-b border-[#1a1a1a] flex items-center justify-between shrink-0 bg-[#0a0a0a]">
                <div className="flex items-center gap-3">
                  {step !== 'cart' && step !== 'success' && (
                    <button
                      onClick={() => setStep(step === 'payment' ? 'customer' : 'cart')}
                      className="p-2 bg-[#1a1a1a] rounded-xl text-gray-400 hover:text-white transition-colors"
                    >
                      <ArrowLeft className="size-5" />
                    </button>
                  )}
                  <h2 className="text-lg font-black text-white uppercase tracking-tight">
                    {step === 'cart' && 'Carrinho'}
                    {step === 'customer' && 'Identificacao'}
                    {step === 'payment' && 'Pagamento'}
                    {step === 'success' && 'Tudo Pronto!'}
                  </h2>
                </div>
                {step !== 'success' && (
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2.5 bg-[#1a1a1a] rounded-full text-gray-500 hover:text-white transition-colors"
                  >
                    <X className="size-5" />
                  </button>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 sm:p-6">
                {step === 'cart' && (
                  <div className="space-y-5">
                    {items.length === 0 ? (
                      <div className="py-10 text-center">
                        <ShoppingCart className="size-14 text-[#1a1a1a] mx-auto mb-3" />
                        <p className="text-gray-500 font-bold">Seu carrinho esta vazio</p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2.5">
                          {items.map((item) => (
                            <div key={item.id} className="bg-[#1a1a1a] rounded-2xl p-4 border border-[#2a2a2a]">
                              <div className="flex justify-between items-start gap-4">
                                <div className="flex-1">
                                  <h4 className="font-bold text-white text-sm">{item.nome}</h4>
                                  {item.complementos?.map((grupo, idx) => (
                                    <p key={idx} className="text-[10px] text-gray-500 mt-0.5">
                                      {grupo.items.map(i => i.nome).join(', ')}
                                    </p>
                                  ))}
                                  <p className="text-xs font-black text-[#22c55e] mt-2">{formatPrice(item.preco * item.quantidade)}</p>
                                </div>
                                <div className="flex items-center bg-[#0a0a0a] rounded-xl border border-[#2a2a2a] p-1">
                                  <button onClick={() => updateQuantity(item.id, item.quantidade - 1)} className="p-1.5 text-gray-500 hover:text-red-500"><Minus className="size-3.5" /></button>
                                  <span className="w-8 text-center text-xs font-bold text-white">{item.quantidade}</span>
                                  <button onClick={() => updateQuantity(item.id, item.quantidade + 1)} className="p-1.5 text-gray-500 hover:text-[#22c55e]"><Plus className="size-3.5" /></button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Totais */}
                        <div className="bg-[#1a1a1a] rounded-2xl p-4 space-y-2.5 border border-[#2a2a2a]">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Subtotal</span>
                            <span className="font-bold text-white">{formatPrice(subtotal)}</span>
                          </div>
                          {desconto > 0 && (
                            <div className="flex justify-between text-sm text-[#22c55e]">
                              <span>Desconto</span>
                              <span className="font-bold">-{formatPrice(desconto)}</span>
                            </div>
                          )}
                          {deliveryFee > 0 && isDelivery && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Entrega</span>
                              <span className="font-bold text-white">{formatPrice(deliveryFee)}</span>
                            </div>
                          )}
                          <div className="pt-2.5 border-t border-[#2a2a2a] flex justify-between items-center">
                            <span className="font-black text-white uppercase tracking-wider text-sm">Total</span>
                            <span className="text-lg font-black text-[#22c55e]">{formatPrice(totalFinal)}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {step === 'customer' && (
                  <div className="space-y-4">
                    <div className="bg-[#22c55e]/10 p-3.5 rounded-xl border border-[#22c55e]/20">
                      <p className="text-[10px] font-bold text-[#22c55e] uppercase mb-0.5">Passo 2 de 3</p>
                      <p className="text-sm font-black text-white">Onde vamos entregar?</p>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => setIsDelivery(true)}
                          className={cn("p-3.5 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5", isDelivery ? "border-[#22c55e] bg-[#22c55e]/10" : "border-[#2a2a2a] bg-[#1a1a1a]")}
                        >
                          <span className="text-xl">🛵</span>
                          <span className="text-xs font-bold text-white">Delivery</span>
                        </button>
                        <button 
                          onClick={() => { setIsDelivery(false); setDeliveryFee(0); }}
                          className={cn("p-3.5 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5", !isDelivery ? "border-[#22c55e] bg-[#22c55e]/10" : "border-[#2a2a2a] bg-[#1a1a1a]")}
                        >
                          <span className="text-xl">🏪</span>
                          <span className="text-xs font-bold text-white">Retirada</span>
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        <input
                          type="text"
                          placeholder="Seu nome"
                          value={customerData.nome}
                          onChange={(e) => setCustomerData({ ...customerData, nome: e.target.value })}
                          className="w-full p-3.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#22c55e]/30 focus:border-[#22c55e] text-white placeholder:text-gray-600"
                        />
                        <input
                          type="tel"
                          placeholder="WhatsApp (com DDD)"
                          value={customerData.telefone}
                          onChange={(e) => setCustomerData({ ...customerData, telefone: formatPhone(e.target.value) })}
                          className="w-full p-3.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#22c55e]/30 focus:border-[#22c55e] text-white placeholder:text-gray-600"
                        />
                        {isDelivery && (
                          <>
                            {/* Seletor de Bairro */}
                            {availableBairros.length > 0 ? (
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bairro</label>
                                <select
                                  value={customerData.bairro}
                                  onChange={(e) => {
                                    const selectedBairro = e.target.value;
                                    setCustomerData({ ...customerData, bairro: selectedBairro });
                                    if (selectedBairro && empresaId) {
                                      setDeliveryLoading(true);
                                      getDeliveryRateByBairro(empresaId, selectedBairro).then((rate) => {
                                        if (rate) {
                                          setDeliveryFee(rate.taxa);
                                          setDeliveryInfo({ tempo_estimado: rate.tempo_estimado });
                                        }
                                        setDeliveryLoading(false);
                                      });
                                    }
                                  }}
                                  className="w-full p-3.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#22c55e]/30 focus:border-[#22c55e] text-white"
                                >
                                  <option value="">Selecione seu bairro</option>
                                  {availableBairros.map((b) => (
                                    <option key={b.bairro} value={b.bairro}>
                                      {b.bairro} - R$ {b.taxa.toFixed(2).replace('.', ',')} {b.tempo_estimado && `(${b.tempo_estimado} min)`}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <input
                                type="text"
                                placeholder="Bairro"
                                value={customerData.bairro}
                                onChange={(e) => setCustomerData({ ...customerData, bairro: e.target.value })}
                                className="w-full p-3.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#22c55e]/30 focus:border-[#22c55e] text-white placeholder:text-gray-600"
                              />
                            )}
                            
                            <input
                              type="text"
                              placeholder="Endereco (Rua, Numero, Complemento)"
                              value={customerData.endereco}
                              onChange={(e) => setCustomerData({ ...customerData, endereco: e.target.value })}
                              className="w-full p-3.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#22c55e]/30 focus:border-[#22c55e] text-white placeholder:text-gray-600"
                            />

                            {/* Botao para calcular entrega (raio automatico) */}
                            {deliveryConfig?.auto_radius && customerData.endereco && customerData.bairro && deliveryFee === 0 && !deliveryLoading && (
                              <button
                                type="button"
                                onClick={() => calculateDelivery()}
                                className="w-full p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400 text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-500/20 transition-colors"
                              >
                                <MapPin className="size-4" />
                                Calcular Taxa de Entrega
                              </button>
                            )}

                            {deliveryLoading && (
                              <div className="flex items-center justify-center gap-2 py-3 text-gray-500 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
                                <Loader2 className="size-4 animate-spin" />
                                <span className="text-sm">Calculando entrega...</span>
                              </div>
                            )}

                            {/* Mostrar taxa de entrega calculada */}
                            {deliveryFee > 0 && !deliveryLoading && (
                              <div className="bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-xl p-3 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className="size-9 bg-[#22c55e]/20 rounded-lg flex items-center justify-center">
                                    <MapPin className="size-4 text-[#22c55e]" />
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-gray-400">Taxa de Entrega</p>
                                    <p className="text-sm font-bold text-white">{customerData.bairro}</p>
                                    {deliveryInfo?.distance && (
                                      <p className="text-[10px] text-gray-500">{deliveryInfo.distance} km</p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-base font-black text-[#22c55e]">R$ {deliveryFee.toFixed(2).replace('.', ',')}</p>
                                  {deliveryInfo?.tempo_estimado && (
                                    <p className="text-[10px] text-gray-500">{deliveryInfo.tempo_estimado} min</p>
                                  )}
                                  {deliveryInfo?.duration && (
                                    <p className="text-[10px] text-gray-500">~{deliveryInfo.duration} min</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {step === 'payment' && (
                  <div className="space-y-4">
                    {mpQrCode ? (
                      <div className="text-center space-y-4">
                        <div className="bg-[#22c55e]/10 p-3 rounded-xl border border-[#22c55e]/30">
                          <p className="text-sm font-black text-[#22c55e]">PIX Gerado com Sucesso!</p>
                        </div>
                        {mpQrCodeBase64 && (
                          <div className="bg-white p-3 rounded-2xl shadow-xl inline-block">
                            <Image src={`data:image/png;base64,${mpQrCodeBase64}`} alt="PIX" width={180} height={180} />
                          </div>
                        )}
                        <button onClick={copyPixCode} className="w-full p-3.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl font-bold text-gray-300 text-sm flex items-center justify-center gap-2 hover:border-[#3a3a3a] transition-colors">
                          <Copy className="size-4" /> Copiar Codigo PIX
                        </button>
                        <button onClick={checkPixPayment} className="w-full p-4 bg-[#22c55e] text-white font-black rounded-xl shadow-lg shadow-green-900/30 hover:bg-[#1ea34d] transition-colors">JA PAGUEI</button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {['pix', 'cartao', 'dinheiro'].map((method) => (
                          <button
                            key={method}
                            onClick={() => setPaymentData({ ...paymentData, forma: method as any })}
                            className={cn("w-full p-5 rounded-2xl border-2 transition-all flex items-center gap-4", paymentData.forma === method ? "border-[#22c55e] bg-[#22c55e]/10" : "border-[#2a2a2a] bg-[#1a1a1a]")}
                          >
                            <div className={cn("size-12 rounded-xl flex items-center justify-center", paymentData.forma === method ? "bg-[#22c55e] text-white" : "bg-[#2a2a2a] text-gray-500")}>
                              {method === 'pix' && <QrCode />}
                              {method === 'cartao' && <CreditCard />}
                              {method === 'dinheiro' && <Banknote />}
                            </div>
                            <div className="text-left">
                              <p className="font-bold text-white uppercase text-xs tracking-wider">{method}</p>
                              <p className="text-[10px] text-gray-500">Pague na {isDelivery ? 'entrega' : 'retirada'}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {step === 'success' && (
                  <div className="py-10 text-center space-y-6">
                    <div className="size-24 bg-[#22c55e]/20 rounded-full flex items-center justify-center mx-auto">
                      <Check className="size-12 text-[#22c55e]" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white">Pedido Recebido!</h2>
                      <p className="text-gray-500 mt-2">Estamos preparando tudo com muito carinho.</p>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="w-full p-5 bg-white text-black font-black rounded-2xl hover:bg-gray-100 transition-colors">VOLTAR AO CARDÁPIO</button>
                  </div>
                )}
              </div>

  {/* Footer Button */}
  {step !== 'success' && !mpQrCode && (
    <div className="px-5 py-4 sm:p-5 border-t border-[#1a1a1a] bg-[#0a0a0a] pb-8 sm:pb-5">
      <button
        onClick={step === 'cart' ? () => setStep('customer') : step === 'customer' ? () => setStep('payment') : finishOrder}
        disabled={loading || items.length === 0}
        className="w-full p-4 bg-[#22c55e] hover:bg-[#1ea34d] disabled:bg-[#1a1a1a] disabled:text-gray-600 text-white font-black rounded-xl shadow-lg shadow-green-900/30 transition-all flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="animate-spin size-5" /> : (
          <>
            {step === 'cart' && 'CONTINUAR'}
            {step === 'customer' && 'IR PARA PAGAMENTO'}
            {step === 'payment' && `CONFIRMAR ${formatPrice(totalFinal)}`}
          </>
        )}
      </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
