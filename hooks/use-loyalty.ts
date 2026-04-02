'use client';

import { useState, useCallback, useMemo } from 'react';
import { getClientPoints, getLoyaltyConfig, type ClientPoints } from '@/app/actions/loyalty';

interface LoyaltyConfig {
  pontos_para_desconto: number;
  desconto_valor: number;
}

export function useLoyalty() {
  const [clientPoints, setClientPoints] = useState<number | null>(null);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const [checkingCustomer, setCheckingCustomer] = useState(false);
  const [phoneChecked, setPhoneChecked] = useState(false);
  const [usePoints, setUsePoints] = useState(false);
  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfig | null>(null);

  const loadClientPoints = useCallback(async (telefone: string) => {
    if (!telefone || telefone.length < 10) return;

    setLoadingPoints(true);
    try {
      const pointsData = await getClientPoints(telefone);
      if (pointsData !== null) {
        setClientPoints(pointsData.pontos_acumulados);
        setIsExistingCustomer(true);
      } else {
        setClientPoints(0);
        setIsExistingCustomer(false);
      }
    } catch (error) {
      console.error('Erro ao buscar pontos:', error);
      setClientPoints(0);
    } finally {
      setLoadingPoints(false);
      setPhoneChecked(true);
    }
  }, []);

  const loadLoyaltyConfig = useCallback(async () => {
    try {
      const config = await getLoyaltyConfig();
      if (config) {
        setLoyaltyConfig(config);
      }
    } catch (error) {
      console.error('Erro ao buscar config de fidelidade:', error);
    }
  }, []);

  const calculatePointsDiscount = useMemo(() => {
    return (subtotal: number, descontoAtual: number) => {
      if (!loyaltyConfig || !clientPoints) return { desconto: 0, pontosUsados: 0 };

      const pontosDisponiveis = clientPoints;
      if (pontosDisponiveis < loyaltyConfig.pontos_para_desconto) {
        return { desconto: 0, pontosUsados: 0 };
      }

      const maxDescontoPorPontos = useMemoCalcMaxDesconto(pontosDisponiveis, loyaltyConfig);
      const descontoPontos = Math.min(maxDescontoPorPontos, subtotal - descontoAtual);
      const pontosASeremUsados = Math.floor(descontoPontos / loyaltyConfig.desconto_valor) * loyaltyConfig.pontos_para_desconto;

      return {
        desconto: descontoPontos,
        pontosUsados: pontosASeremUsados
      };
    };
  }, [loyaltyConfig, clientPoints]);

  const resetLoyalty = useCallback(() => {
    setClientPoints(null);
    setIsExistingCustomer(false);
    setPhoneChecked(false);
    setUsePoints(false);
  }, []);

  return {
    clientPoints,
    loadingPoints,
    isExistingCustomer,
    checkingCustomer,
    setCheckingCustomer,
    phoneChecked,
    setPhoneChecked,
    usePoints,
    setUsePoints,
    loyaltyConfig,
    loadClientPoints,
    loadLoyaltyConfig,
    calculatePointsDiscount,
    resetLoyalty
  };
}

function useMemoCalcMaxDesconto(pontos: number, config: LoyaltyConfig): number {
  if (pontos < config.pontos_para_desconto) return 0;
  const blocosCompletos = Math.floor(pontos / config.pontos_para_desconto);
  return blocosCompletos * config.desconto_valor;
}
