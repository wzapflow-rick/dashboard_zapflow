'use client';

import { useState, useCallback } from 'react';
import { calculateDeliveryFee, geocodeAddress, getDeliveryConfig } from '@/app/actions/delivery';
import { toast } from 'sonner';

interface DeliveryInfo {
  distance_km?: number;
  duration_min?: number;
}

interface DeliveryConfig {
  auto_radius: boolean;
  taxa_entrega_fixa: number;
  valor_por_km: number;
  raio_maximo_km: number;
}

export function useDeliveryCalculation() {
  const [isDelivery, setIsDelivery] = useState(true);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo | null>(null);
  const [deliveryConfig, setDeliveryConfig] = useState<DeliveryConfig | null>(null);

  const calculateFee = useCallback(async (address: string, bairro: string, cidade: string) => {
    if (!address || !cidade) {
      setDeliveryFee(0);
      return;
    }

    setDeliveryLoading(true);
    try {
      const fullAddress = `${address}, ${bairro}, ${cidade}`;
      const geocode = await geocodeAddress(fullAddress, cidade);

      if (geocode) {
        setDeliveryCoords({ lat: geocode.lat, lng: geocode.lng });

        const config = await getDeliveryConfig();
        if (config) {
          setDeliveryConfig(config);

          const feeResult = await calculateDeliveryFee({ lat: geocode.lat, lng: geocode.lng });
          if (feeResult.success) {
            setDeliveryFee(feeResult.taxa_entrega || 0);
            setDeliveryInfo({
              distance_km: feeResult.distance_km,
              duration_min: feeResult.duration_min
            });
          } else {
            toast.error(feeResult.error || 'Erro ao calcular entrega');
            setDeliveryFee(0);
          }
        }
      } else {
        toast.error('Não foi possível calcular a entrega para este endereço');
        setDeliveryFee(0);
      }
    } catch (error) {
      console.error('Erro ao calcular entrega:', error);
      setDeliveryFee(0);
    } finally {
      setDeliveryLoading(false);
    }
  }, []);

  const resetDelivery = useCallback(() => {
    setDeliveryFee(0);
    setDeliveryCoords(null);
    setDeliveryInfo(null);
  }, []);

  return {
    isDelivery,
    setIsDelivery,
    deliveryFee,
    setDeliveryFee,
    deliveryCoords,
    deliveryLoading,
    deliveryInfo,
    deliveryConfig,
    calculateFee,
    resetDelivery
  };
}
