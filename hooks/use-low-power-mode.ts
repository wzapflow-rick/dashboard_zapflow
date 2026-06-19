'use client';

import { useEffect, useState } from 'react';

/**
 * Detecta se o dispositivo deve rodar em "modo de baixa potencia":
 * - usuario pediu menos movimento (prefers-reduced-motion), OU
 * - hardware fraco (poucos nucleos de CPU ou pouca memoria).
 *
 * Usado para reduzir animacoes automaticamente em notebooks/PCs fracos,
 * mantendo a experiencia completa em maquinas normais.
 */
export function useLowPowerMode(): boolean {
  const [lowPower, setLowPower] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

    const computeWeakHardware = () => {
      const nav = navigator as Navigator & { deviceMemory?: number };
      // 4 nucleos ou menos = provavelmente maquina modesta.
      const fewCores = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 4;
      // 4 GB ou menos de RAM (quando exposto pelo navegador).
      const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
      return fewCores || lowMemory;
    };

    const update = () => {
      setLowPower(Boolean(prefersReducedMotion?.matches) || computeWeakHardware());
    };

    update();
    prefersReducedMotion?.addEventListener?.('change', update);

    return () => {
      prefersReducedMotion?.removeEventListener?.('change', update);
    };
  }, []);

  return lowPower;
}
